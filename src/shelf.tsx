import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth } from './firebase';
import {
  booksCol,
  coversCol,
  feedMetaDoc,
  listOrderDoc,
  listsCol,
  orderLists,
  orderQueue,
  queueDoc,
  reportError,
  type Book,
  type BookList,
} from './db';
import { syncFeed, type FeedMeta } from './feed';

interface Shelf {
  user: User;
  /** Every book, whatever tab it's on. */
  books: Book[];
  /** Books that have been read: the Books tab. */
  read: Book[];
  /** Owned but unread, in queue order. */
  queue: Book[];
  wishlist: Book[];
  /** In the order chosen on the Lists page. */
  lists: BookList[];
  bookById: Map<string, Book>;
  /** The reading feed for AI assistants: null when off, undefined while loading. */
  feed: FeedMeta | null | undefined;
}

const ShelfContext = createContext<Shelf | null>(null);

export function useShelf(): Shelf {
  const shelf = useContext(ShelfContext);
  if (!shelf) throw new Error('useShelf must be used inside <ShelfProvider>');
  return shelf;
}

/** undefined while Firebase is still restoring the session. */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(() => (auth.currentUser ? auth.currentUser : undefined));
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

/** Subscribes once to the user's books and lists; renders children when both have loaded. */
export function ShelfProvider({ user, children }: { user: User; children: ReactNode }) {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [lists, setLists] = useState<BookList[] | null>(null);
  const [listOrder, setListOrder] = useState<string[] | null>(null);
  const [queueOrder, setQueueOrder] = useState<string[] | null>(null);
  const [feed, setFeed] = useState<FeedMeta | null | undefined>();
  const [error, setError] = useState('');

  useEffect(() => {
    const onError = (err: Error) => setError(err.message);
    const unsubBooks = onSnapshot(
      booksCol(user.uid),
      (snap) => setBooks(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Book)),
      onError,
    );
    const unsubLists = onSnapshot(
      listsCol(user.uid),
      (snap) => setLists(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as BookList)),
      onError,
    );
    const unsubOrder = onSnapshot(
      listOrderDoc(user.uid),
      (snap) => setListOrder((snap.data()?.ids as string[] | undefined) ?? []),
      onError,
    );
    const unsubQueue = onSnapshot(
      queueDoc(user.uid),
      (snap) => setQueueOrder((snap.data()?.ids as string[] | undefined) ?? []),
      onError,
    );
    const unsubFeed = onSnapshot(
      feedMetaDoc(user.uid),
      (snap) => setFeed(snap.exists() ? (snap.data() as FeedMeta) : null),
      onError,
    );
    return () => {
      unsubBooks();
      unsubLists();
      unsubOrder();
      unsubQueue();
      unsubFeed();
    };
  }, [user.uid]);

  const value = useMemo(
    () =>
      books && lists && listOrder && queueOrder
        ? {
            user,
            books,
            read: books.filter((b) => !b.status),
            queue: orderQueue(books, queueOrder),
            wishlist: books.filter((b) => b.status === 'wishlist'),
            lists: orderLists(lists, listOrder),
            bookById: new Map(books.map((b) => [b.id, b])),
            feed,
          }
        : null,
    [user, books, lists, listOrder, queueOrder, feed],
  );

  // Keep the reading feed current. Debounced so a burst of edits causes one rewrite;
  // syncFeed itself skips the write when nothing in the feed changed.
  useEffect(() => {
    if (!value?.feed) return;
    const { feed: meta } = value;
    let cancelled = false;
    const timer = setTimeout(() => {
      syncFeed(user.uid, meta, value, () => cancelled).catch(reportError);
    }, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, user.uid]);

  if (error) {
    return (
      <div className="empty-state">
        <h1>Couldn't load your shelf</h1>
        <p className="muted">{error}</p>
        <button type="button" className="btn" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  }
  if (!value) return <div className="loading" aria-label="Loading" />;
  return <ShelfContext.Provider value={value}>{children}</ShelfContext.Provider>;
}

/** The full-size cover for a book: a data URL, null if it has none, undefined while loading. */
export function useCover(bookId: string | undefined): string | null | undefined {
  const { user } = useShelf();
  const [cover, setCover] = useState<{ bookId: string; data: string | null }>();

  useEffect(() => {
    if (!bookId) return;
    return onSnapshot(
      doc(coversCol(user.uid), bookId),
      (snap) => setCover({ bookId, data: snap.exists() ? (snap.data().data as string) : null }),
      () => setCover({ bookId, data: null }),
    );
  }, [user.uid, bookId]);

  return cover && cover.bookId === bookId ? cover.data : undefined;
}
