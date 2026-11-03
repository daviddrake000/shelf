import { doc, writeBatch, type WriteBatch } from 'firebase/firestore';
import { firestore } from './firebase';
import { firebaseConfig } from './firebaseConfig';
import { feedMetaDoc, reportError, type Book, type BookList } from './db';

// The reading feed: a read-only JSON copy of the shelf for AI assistants.
//
// Shelf has no server, so there is no /api route to check a token. Instead the app writes
// the feed into Firestore at feeds/{token}, and the security rules let anyone *get* that
// exact document but never list or search the collection. The token is the secret; making
// a new one deletes the old documents, so the old link stops working at once.
//
// The feed is rewritten whenever the shelf's content changes (compared by hash), from
// whichever signed-in device made the change.

export interface FeedMeta {
  token: string;
  /** SHA-256 of the items last written, to skip rewriting an unchanged feed. */
  hash: string | null;
  /** Number of feed documents (pages) last written. */
  pages: number;
  updatedAt: number | null;
}

interface FeedData {
  books: Book[];
  lists: BookList[];
  queue: Book[];
}

const feedDoc = (id: string) => doc(firestore, 'feeds', id);
const pageId = (token: string, page: number) => (page === 1 ? token : `${token}_p${page}`);

/** The URL an assistant fetches; `mask` limits the response to the feed itself. */
export function feedUrl(token: string, page = 1): string {
  return (
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/` +
    `feeds/${pageId(token, page)}?mask.fieldPaths=json`
  );
}

const SHELVES = {
  read: 'Finished reading',
  queue: 'Owned but not read yet; queue_position is the planned reading order',
  wishlist: 'Wants to read',
};

// "Alexander C. Karp and Nicholas W. Zamiska" → two authors
const splitAuthors = (author: string) =>
  author
    .split(/\s+(?:and|&)\s+|\s*;\s*/i)
    .map((a) => a.trim())
    .filter(Boolean);

const iso = (ms: number | undefined) => (ms ? new Date(ms).toISOString() : null);

export function buildFeedItems({ books, lists, queue }: FeedData) {
  const listNames = new Map<string, string[]>();
  for (const list of lists) {
    for (const id of list.bookIds) listNames.set(id, [...(listNames.get(id) ?? []), list.name]);
  }
  const queuePosition = new Map(queue.map((b, i) => [b.id, i + 1]));

  return books
    .map((b) => {
      const read = !b.status;
      return {
        id: b.id,
        book: {
          title: b.title,
          authors: splitAuthors(b.author),
          year: b.year ?? null,
          isbn13: b.isbn ?? null,
          pages: b.pages ?? null,
        },
        shelf: b.status ?? 'read',
        rating: read ? (b.rating ?? null) : null,
        date_finished: read ? (b.dateRead ?? null) : null,
        date_logged: read ? iso(b.loggedAt ?? b.createdAt) : null,
        date_added: iso(b.createdAt),
        review: read ? (b.review ?? null) : null,
        notes: read ? null : (b.review ?? null),
        lists: listNames.get(b.id) ?? [],
        queue_position: queuePosition.get(b.id) ?? null,
      };
    })
    .sort((a, b) => (b.date_logged ?? b.date_added ?? '').localeCompare(a.date_logged ?? a.date_added ?? ''));
}

type FeedItem = ReturnType<typeof buildFeedItems>[number];

// A Firestore string field holds up to ~1 MiB; stay well under it per page
const PAGE_BYTES = 800_000;

function paginate(items: FeedItem[]): FeedItem[][] {
  const encoder = new TextEncoder();
  const pages: FeedItem[][] = [[]];
  let size = 0;
  for (const item of items) {
    const bytes = encoder.encode(JSON.stringify(item)).length + 1;
    if (size + bytes > PAGE_BYTES && pages[pages.length - 1].length) {
      pages.push([]);
      size = 0;
    }
    pages[pages.length - 1].push(item);
    size += bytes;
  }
  return pages;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const base64url = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `shelf-${base64url}`;
}

function deletePages(batch: WriteBatch, token: string, from: number, to: number) {
  for (let page = from; page <= to; page++) batch.delete(feedDoc(pageId(token, page)));
}

/** Writes the feed pages and its meta into `batch`. */
async function writeFeed(batch: WriteBatch, uid: string, token: string, previousPages: number, data: FeedData) {
  const items = buildFeedItems(data);
  const hash = await sha256(JSON.stringify(items));
  const pages = paginate(items);
  const updatedAt = new Date().toISOString();

  pages.forEach((pageItems, i) => {
    const page = i + 1;
    const json = JSON.stringify({
      app: 'shelf',
      version: 1,
      updated_at: updatedAt,
      page,
      pages: pages.length,
      next_page_url: page < pages.length ? feedUrl(token, page + 1) : null,
      shelves: SHELVES,
      items: pageItems,
    });
    batch.set(feedDoc(pageId(token, page)), { uid, json, updatedAt: Date.now() });
  });
  deletePages(batch, token, pages.length + 1, previousPages);
  batch.set(feedMetaDoc(uid), { token, hash, pages: pages.length, updatedAt: Date.now() } satisfies FeedMeta);
  return hash;
}

/**
 * Rewrites the feed if the shelf changed since it was last written. `cancelled` is checked
 * just before saving, so a feed turned off meanwhile isn't written back.
 */
export async function syncFeed(uid: string, meta: FeedMeta, data: FeedData, cancelled: () => boolean) {
  const hash = await sha256(JSON.stringify(buildFeedItems(data)));
  if (hash === meta.hash) return;
  const batch = writeBatch(firestore);
  await writeFeed(batch, uid, meta.token, meta.pages, data);
  if (cancelled()) return;
  // Not awaited, like other saves: it completes once online
  batch.commit().catch(reportError);
}

/** Creates the feed, or replaces it under a new token so the old link stops working. */
export async function startFeed(uid: string, data: FeedData, previous?: FeedMeta | null) {
  const batch = writeBatch(firestore);
  if (previous) deletePages(batch, previous.token, 1, Math.max(1, previous.pages));
  await writeFeed(batch, uid, newToken(), 0, data);
  batch.commit().catch(reportError);
}

export function stopFeed(uid: string, meta: FeedMeta) {
  const batch = writeBatch(firestore);
  deletePages(batch, meta.token, 1, Math.max(1, meta.pages));
  batch.delete(feedMetaDoc(uid));
  batch.commit().catch(reportError);
}

/** Plain-text instructions to paste into the assistant. */
export function feedInstructions(token: string): string {
  return [
    'Shelf reading feed (read-only)',
    `GET ${feedUrl(token)}`,
    '',
    'No auth header: the link itself is the secret. The response is a Firestore document;',
    'parse fields.json.stringValue as JSON. updateTime changes only when the shelf changes.',
    '404 means the link was revoked or replaced.',
    '',
    'items[] (newest first): id (permanent), book {title, authors[], year, isbn13|null, pages},',
    'shelf: "read" | "queue" (owned, not read; queue_position = planned order) | "wishlist" (wants to read),',
    'rating: 0.5–5 in half steps, null = unrated; date_finished: YYYY-MM-DD|null;',
    'date_logged / date_added: ISO 8601 UTC; review (read books); notes (unread books); lists[].',
    'If pages > 1, follow next_page_url.',
  ].join('\n');
}
