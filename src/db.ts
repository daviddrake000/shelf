import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';
import { auth, firestore } from './firebase';
import { makeThumb, type CoverImages } from './utils';

// Everything lives under users/{uid}/ — books, covers (full-size images, kept apart so
// grids only download thumbnails), lists, and meta/ (list order, queue order). Security
// rules limit each path to its owner.

/** Unset means read (shown under Books); 'queue' = owned but unread; 'wishlist' = want to read. */
export type BookStatus = 'queue' | 'wishlist';

export interface Book {
  id: string;
  title: string;
  author: string;
  year?: number;
  pages?: number;
  /** ISBN-13, digits only. */
  isbn?: string;
  /** 0.5–5 in half-star steps; undefined means unrated. */
  rating?: number;
  /** A review for read books; notes for queue and wishlist books. */
  review?: string;
  /** YYYY-MM-DD */
  dateRead?: string;
  /** Small JPEG data URL for grids; the full-size image is in the covers collection. */
  thumb?: string;
  status?: BookStatus;
  createdAt: number;
  updatedAt: number;
  /** When a queue book was logged as read, so it sorts as recently logged. */
  loggedAt?: number;
}

export interface BookList {
  id: string;
  name: string;
  description?: string;
  /** Ordered: position in this array is the book's position in the list. */
  bookIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type BookInput = Pick<
  Book,
  'title' | 'author' | 'year' | 'pages' | 'isbn' | 'rating' | 'review' | 'dateRead' | 'status'
>;

function currentUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('You are signed out. Sign in again to save changes.');
  return user.uid;
}

export const booksCol = (uid = currentUid()) => collection(firestore, 'users', uid, 'books');
export const coversCol = (uid = currentUid()) => collection(firestore, 'users', uid, 'covers');
export const listsCol = (uid = currentUid()) => collection(firestore, 'users', uid, 'lists');
/** { ids: string[] } — the order of lists chosen on the Lists page. */
export const listOrderDoc = (uid = currentUid()) => doc(firestore, 'users', uid, 'meta', 'listOrder');
/** { ids: string[] } — the order of the reading queue. */
export const queueDoc = (uid = currentUid()) => doc(firestore, 'users', uid, 'meta', 'queue');
/** The reading feed's secret token and state (see feed.ts). */
export const feedMetaDoc = (uid = currentUid()) => doc(firestore, 'users', uid, 'meta', 'feed');

/** Queue books in the saved order; any missing from it (shouldn't happen) go last, oldest first. */
export function orderQueue(books: Book[], order: string[]): Book[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return books
    .filter((b) => b.status === 'queue')
    .sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity) || a.createdAt - b.createdAt);
}

/**
 * Puts lists in the user's chosen order. Lists that were never placed (created since the
 * last reorder) come first, newest first, so a new list is easy to find.
 */
export function orderLists(lists: BookList[], order: string[]): BookList[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...lists].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra === undefined || rb === undefined) {
      if (ra === rb) return b.createdAt - a.createdAt;
      return ra === undefined ? -1 : 1;
    }
    return ra - rb;
  });
}

/** Shows a failed background save in the app's error banner. */
export function reportError(err: unknown) {
  console.error(err);
  const message = err instanceof Error ? err.message : String(err);
  window.dispatchEvent(new CustomEvent('shelf:error', { detail: message }));
}

export interface Notice {
  message: string;
  link?: { to: string; label: string };
}

/** Shows a short confirmation, optionally with a link, in the app's status area. */
export function notify(notice: Notice) {
  window.dispatchEvent(new CustomEvent<Notice>('shelf:notice', { detail: notice }));
}

// Writes are applied to the local cache immediately, so the UI updates at once and keeps
// working offline. They are not awaited: offline, the promise only settles once back online.
function commit(batch: WriteBatch) {
  batch.commit().catch(reportError);
}

function syncMembership(batch: WriteBatch, bookId: string, wanted: string[], lists: BookList[], now: number) {
  for (const list of lists) {
    const has = list.bookIds.includes(bookId);
    const want = wanted.includes(list.id);
    if (want !== has) {
      batch.update(doc(listsCol(), list.id), {
        bookIds: want ? arrayUnion(bookId) : arrayRemove(bookId),
        updatedAt: now,
      });
    }
  }
}

interface SaveBookParams {
  input: BookInput;
  /** Undefined leaves the cover as it is; null removes it. */
  cover: CoverImages | null | undefined;
  listIds: string[];
  lists: BookList[];
  existing?: Book;
}

/** Creates or updates a book and syncs which lists it belongs to. Returns the book id. */
export function saveBook({ input, cover, listIds, lists, existing }: SaveBookParams): string {
  const ref = existing ? doc(booksCol(), existing.id) : doc(booksCol());
  const now = Date.now();
  const batch = writeBatch(firestore);
  // set() replaces the whole document, so fields cleared in the form are removed
  batch.set(ref, {
    ...input,
    thumb: cover === undefined ? existing?.thumb : cover?.thumb,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    loggedAt: existing?.loggedAt,
  });
  if (cover) batch.set(doc(coversCol(), ref.id), { data: cover.cover });
  else if (cover === null) batch.delete(doc(coversCol(), ref.id));
  syncMembership(batch, ref.id, listIds, lists, now);
  // A new queue book joins the end of the queue
  if (!existing && input.status === 'queue') batch.set(queueDoc(), { ids: arrayUnion(ref.id) }, { merge: true });
  commit(batch);
  return ref.id;
}

/** Marks a queue (or wishlist) book as read, moving it to Books. */
export function logBook(book: Book, read: { rating?: number; dateRead?: string; review?: string }) {
  const now = Date.now();
  const batch = writeBatch(firestore);
  batch.update(doc(booksCol(), book.id), {
    status: deleteField(),
    rating: read.rating ?? deleteField(),
    dateRead: read.dateRead ?? deleteField(),
    review: read.review ?? deleteField(),
    loggedAt: now,
    updatedAt: now,
  });
  if (book.status === 'queue') batch.set(queueDoc(), { ids: arrayRemove(book.id) }, { merge: true });
  commit(batch);
}

/** Moves a wishlist book to the end of the queue and confirms where it landed. */
export function moveToQueue(book: Book, queueLength: number) {
  const batch = writeBatch(firestore);
  batch.update(doc(booksCol(), book.id), { status: 'queue', updatedAt: Date.now() });
  batch.set(queueDoc(), { ids: arrayUnion(book.id) }, { merge: true });
  commit(batch);
  notify({
    message: `“${book.title}” is now #${queueLength + 1} in your queue.`,
    link: { to: '/queue', label: 'View queue' },
  });
}

export function saveQueueOrder(bookIds: string[]) {
  setDoc(queueDoc(), { ids: bookIds, updatedAt: Date.now() }).catch(reportError);
}

export function setRating(bookId: string, rating: number | undefined) {
  updateDoc(doc(booksCol(), bookId), { rating: rating ?? deleteField(), updatedAt: Date.now() }).catch(reportError);
}

export function deleteBook(book: Book, lists: BookList[]) {
  const batch = writeBatch(firestore);
  batch.delete(doc(booksCol(), book.id));
  batch.delete(doc(coversCol(), book.id));
  syncMembership(batch, book.id, [], lists, Date.now());
  if (book.status === 'queue') batch.set(queueDoc(), { ids: arrayRemove(book.id) }, { merge: true });
  commit(batch);
}

export function createList(name: string, description?: string): string {
  const ref = doc(listsCol());
  const now = Date.now();
  setDoc(ref, { name, description, bookIds: [], createdAt: now, updatedAt: now }).catch(reportError);
  return ref.id;
}

export function updateList(id: string, { name, description }: { name: string; description?: string }) {
  updateDoc(doc(listsCol(), id), { name, description: description ?? deleteField(), updatedAt: Date.now() }).catch(
    reportError,
  );
}

export function setBookInList(listId: string, bookId: string, inList: boolean) {
  updateDoc(doc(listsCol(), listId), {
    bookIds: inList ? arrayUnion(bookId) : arrayRemove(bookId),
    updatedAt: Date.now(),
  }).catch(reportError);
}

export function deleteList(id: string) {
  writeBatch(firestore).delete(doc(listsCol(), id)).commit().catch(reportError);
}

export function saveListOrder(listIds: string[]) {
  setDoc(listOrderDoc(), { ids: listIds, updatedAt: Date.now() }).catch(reportError);
}

/** Replaces the order of books in a list. */
export function setListBooks(listId: string, bookIds: string[]) {
  updateDoc(doc(listsCol(), listId), { bookIds, updatedAt: Date.now() }).catch(reportError);
}

// ---------- Backup & import ----------

// Version 1 backups came from the browser-only first version (numeric ids); version 2
// from this one. Both have the same shape, with full-size covers inline.
interface BackupBook extends Partial<Omit<Book, 'id' | 'thumb'>> {
  id: string | number;
  cover?: string;
}

interface BackupList extends Partial<Omit<BookList, 'id' | 'bookIds'>> {
  id: string | number;
  bookIds: (string | number)[];
}

export interface ShelfData {
  books: BackupBook[];
  lists: BackupList[];
  /** Book ids in queue order. */
  queue?: (string | number)[];
}

export async function exportBackup(): Promise<Blob> {
  const [books, covers, lists, order, queue] = await Promise.all([
    getDocs(booksCol()),
    getDocs(coversCol()),
    getDocs(listsCol()),
    getDoc(listOrderDoc()),
    getDoc(queueDoc()),
  ]);
  const coverById = new Map(covers.docs.map((d) => [d.id, d.data().data as string]));
  // Lists are written in the user's chosen order; import restores that order
  const orderedLists = orderLists(
    lists.docs.map((d) => ({ ...d.data(), id: d.id }) as BookList),
    (order.data()?.ids as string[] | undefined) ?? [],
  );
  const backup = {
    app: 'shelf',
    version: 2,
    exportedAt: new Date().toISOString(),
    books: books.docs.map((d) => {
      const data = d.data();
      delete data.thumb; // rebuilt from the cover on import
      return { ...data, id: d.id, cover: coverById.get(d.id) };
    }),
    lists: orderedLists,
    queue: (queue.data()?.ids as string[] | undefined) ?? [],
  };
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

export function parseBackup(text: string): ShelfData {
  let data: { app?: unknown; books?: unknown; lists?: unknown; queue?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  if (data.app !== 'shelf' || !Array.isArray(data.books) || !Array.isArray(data.lists)) {
    throw new Error("This doesn't look like a Shelf backup file.");
  }
  return { books: data.books, lists: data.lists, queue: Array.isArray(data.queue) ? data.queue : undefined };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

// Firestore commits are limited to 10 MiB; full-size covers are ~100 KB each
const BOOKS_PER_BATCH = 25;

async function deleteEverything(uid: string) {
  const snaps = await Promise.all([getDocs(booksCol(uid)), getDocs(coversCol(uid)), getDocs(listsCol(uid))]);
  const refs = [...snaps.flatMap((s) => s.docs.map((d) => d.ref)), listOrderDoc(uid), queueDoc(uid)];
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(firestore);
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

/**
 * Writes books and lists from a backup (or the old browser-only storage) to the account.
 * 'replace' deletes everything currently on the shelf first; 'merge' adds alongside it.
 * Needs a connection: unlike everyday edits, this waits for the server.
 */
export async function importShelf(
  data: ShelfData,
  mode: 'merge' | 'replace',
  onProgress?: (done: number, total: number) => void,
): Promise<{ books: number; lists: number }> {
  const uid = currentUid();
  if (mode === 'replace') await deleteEverything(uid);

  const newIds = new Map<string, string>();
  let batch = writeBatch(firestore);
  let pending = 0;
  const flush = async () => {
    if (pending) await batch.commit();
    batch = writeBatch(firestore);
    pending = 0;
  };

  for (const [i, b] of data.books.entries()) {
    const ref = doc(booksCol(uid));
    newIds.set(String(b.id), ref.id);
    const cover = str(b.cover);
    const now = Date.now();
    batch.set(ref, {
      title: str(b.title) ?? 'Untitled',
      author: str(b.author) ?? '',
      year: num(b.year),
      pages: num(b.pages),
      isbn: str(b.isbn),
      rating: num(b.rating),
      review: str(b.review),
      dateRead: str(b.dateRead),
      status: b.status === 'queue' || b.status === 'wishlist' ? b.status : undefined,
      thumb: cover ? await makeThumb(cover) : undefined,
      createdAt: num(b.createdAt) ?? now,
      updatedAt: num(b.updatedAt) ?? now,
      loggedAt: num(b.loggedAt),
    });
    if (cover) batch.set(doc(coversCol(uid), ref.id), { data: cover });
    if (++pending === BOOKS_PER_BATCH) await flush();
    onProgress?.(i + 1, data.books.length);
  }

  const newListIds: string[] = [];
  for (const l of data.lists) {
    const now = Date.now();
    const ref = doc(listsCol(uid));
    newListIds.push(ref.id);
    batch.set(ref, {
      name: str(l.name) ?? 'Untitled list',
      description: str(l.description),
      bookIds: l.bookIds.map((id) => newIds.get(String(id))).filter((id): id is string => !!id),
      createdAt: num(l.createdAt) ?? now,
      updatedAt: num(l.updatedAt) ?? now,
    });
    pending++;
  }
  // Keep the backup's list order. A merge puts the imported lists after the existing ones.
  if (newListIds.length) {
    const existing = mode === 'merge' ? (((await getDoc(listOrderDoc(uid))).data()?.ids as string[]) ?? []) : [];
    batch.set(listOrderDoc(uid), { ids: [...existing, ...newListIds], updatedAt: Date.now() });
  }
  // Same for the queue: imported queue books go after any already queued
  const newQueue = (data.queue ?? []).map((id) => newIds.get(String(id))).filter((id): id is string => !!id);
  if (newQueue.length) {
    const existing = mode === 'merge' ? (((await getDoc(queueDoc(uid))).data()?.ids as string[]) ?? []) : [];
    batch.set(queueDoc(uid), { ids: [...existing, ...newQueue], updatedAt: Date.now() });
  }
  await flush();
  return { books: data.books.length, lists: data.lists.length };
}
