import type { ShelfData } from './db';

// The first version of the app kept everything in this browser's IndexedDB (database
// "shelf"). This reads it so it can be copied into the account; it is never modified.

const DONE_KEY = 'shelf:legacy-handled';

export function legacyHandled(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markLegacyHandled() {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    // Without storage the offer simply shows again next time
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readLegacyShelf(): Promise<ShelfData | null> {
  // Opening a database that doesn't exist would create it, so check first
  if (typeof indexedDB === 'undefined' || !indexedDB.databases) return null;
  const existing = await indexedDB.databases();
  if (!existing.some((d) => d.name === 'shelf')) return null;

  const idb = await request(indexedDB.open('shelf'));
  try {
    const stores = idb.objectStoreNames;
    if (!stores.contains('books')) return null;
    const books = await request(idb.transaction('books').objectStore('books').getAll());
    const lists = stores.contains('lists') ? await request(idb.transaction('lists').objectStore('lists').getAll()) : [];
    return books.length ? { books, lists } : null;
  } finally {
    idb.close();
  }
}
