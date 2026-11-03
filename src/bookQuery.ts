import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { Book } from './db';
import { starText } from './utils';

type Compare = (a: Book, b: Book) => number;
type Value = string | number | undefined;

const byText = (a = '', b = '') => a.localeCompare(b, undefined, { sensitivity: 'base' });

// Books missing the value always sort last, whichever direction is chosen
function by(get: (b: Book) => Value, dir: 'asc' | 'desc'): Compare {
  return (a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1;
    const order = x < y ? -1 : x > y ? 1 : 0;
    return dir === 'asc' ? order : -order;
  };
}

export const SORTS = {
  list: { label: 'List order' },
  added: { label: 'Recently logged', compare: by((b) => b.loggedAt ?? b.createdAt, 'desc') },
  'read-desc': {
    label: 'Date read: newest',
    // Same-day reads: most recently logged first
    compare: (a: Book, b: Book) =>
      by((x) => x.dateRead, 'desc')(a, b) || by((x) => x.loggedAt ?? x.createdAt, 'desc')(a, b),
  },
  'read-asc': { label: 'Date read: oldest', compare: by((b) => b.dateRead, 'asc') },
  'published-desc': { label: 'Published: newest', compare: by((b) => b.year, 'desc') },
  'published-asc': { label: 'Published: oldest', compare: by((b) => b.year, 'asc') },
  'rating-desc': { label: 'Rating: highest', compare: by((b) => b.rating, 'desc') },
  'rating-asc': { label: 'Rating: lowest', compare: by((b) => b.rating, 'asc') },
  title: { label: 'Title (A–Z)', compare: (a: Book, b: Book) => byText(a.title, b.title) },
  author: {
    label: 'Author (A–Z)',
    compare: (a: Book, b: Book) => byText(a.author, b.author) || byText(a.title, b.title),
  },
  'pages-desc': { label: 'Longest first', compare: by((b) => b.pages, 'desc') },
  'pages-asc': { label: 'Shortest first', compare: by((b) => b.pages, 'asc') },
} satisfies Record<string, { label: string; compare?: Compare }>;

export type SortKey = keyof typeof SORTS;

// The first key is the default: most recently read first
export const LIBRARY_SORTS: SortKey[] = [
  'read-desc',
  ...(Object.keys(SORTS) as SortKey[]).filter((k) => k !== 'list' && k !== 'read-desc'),
];
export const LIST_SORTS = Object.keys(SORTS) as SortKey[];
export const WISHLIST_SORTS: SortKey[] = ['published-desc', 'published-asc', 'added', 'title', 'author', 'pages-asc'];
export const WISHLIST_SORT_LABELS: Partial<Record<SortKey, string>> = {
  'published-desc': 'Release date: newest',
  'published-asc': 'Release date: oldest',
  added: 'Recently added',
};

/**
 * Rating filter values: '' = any, '4+' = at least 4 stars, '3.5' = exactly 3½ (set by
 * clicking a bar in the ratings chart), 'unrated'.
 */
export const RATING_FILTERS: [string, string][] = [
  ['', 'Any rating'],
  ['5', '★★★★★'],
  ['4+', '★★★★ & up'],
  ['3+', '★★★ & up'],
  ['2+', '★★ & up'],
  ['1+', '★ & up'],
  ['unrated', 'Unrated'],
];

export function ratingFilterLabel(filter: string): string {
  const preset = RATING_FILTERS.find(([value]) => value === filter);
  if (preset) return preset[1];
  return `${starText(Number(filter))} only`;
}

function matchesRating(book: Book, filter: string): boolean {
  if (!filter) return true;
  if (filter === 'unrated') return book.rating === undefined;
  if (filter.endsWith('+')) return (book.rating ?? 0) >= Number(filter.slice(0, -1));
  return book.rating === Number(filter);
}

function matchesText(book: Book, q: string): boolean {
  return !q || book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q);
}

/** Search, sort and rating filter for a set of books, kept in the URL so Back restores them. */
export function useBookQuery(
  books: Book[] | undefined,
  sortKeys: SortKey[],
  sortLabels: Partial<Record<SortKey, string>> = {},
) {
  const [params, setParams] = useSearchParams();
  const defaultSort = sortKeys[0];
  const query = params.get('q') ?? '';
  const sortParam = params.get('sort') as SortKey | null;
  const sort = sortParam && sortKeys.includes(sortParam) ? sortParam : defaultSort;
  const rating = params.get('rating') ?? '';

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== fallback) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const shown = useMemo(() => {
    if (!books) return [];
    const q = query.trim().toLowerCase();
    const filtered = books.filter((b) => matchesText(b, q) && matchesRating(b, rating));
    const { compare } = SORTS[sort] as { compare?: Compare };
    return compare ? [...filtered].sort(compare) : filtered;
  }, [books, query, sort, rating]);

  return {
    shown,
    query,
    sort,
    rating,
    sortKeys,
    sortLabel: (key: SortKey) => sortLabels[key] ?? SORTS[key].label,
    isFiltered: query.trim() !== '' || rating !== '',
    setQuery: (v: string) => setParam('q', v, ''),
    setSort: (v: string) => setParam('sort', v, defaultSort),
    setRating: (v: string) => setParam('rating', v, ''),
    clearFilters: () => {
      const next = new URLSearchParams(params);
      next.delete('q');
      next.delete('rating');
      setParams(next, { replace: true });
    },
    /** Back to the default sort with no search or filter. */
    reset: () => {
      const next = new URLSearchParams(params);
      ['q', 'rating', 'sort'].forEach((key) => next.delete(key));
      setParams(next, { replace: true });
    },
  };
}

export type BookQuery = ReturnType<typeof useBookQuery>;
