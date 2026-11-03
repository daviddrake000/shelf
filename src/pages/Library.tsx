import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { importShelf, reportError, type Book, type ShelfData } from '../db';
import { useShelf } from '../shelf';
import { LIBRARY_SORTS, useBookQuery, type BookQuery } from '../bookQuery';
import { BookGrid } from '../components/BookGrid';
import { BookControls, NoMatches } from '../components/BookControls';
import { legacyHandled, markLegacyHandled, readLegacyShelf } from '../legacy';
import { plural, starText } from '../utils';

export function Library() {
  // Only books that have been read; queue and wishlist books have their own tabs
  const { read: books } = useShelf();
  const q = useBookQuery(books, LIBRARY_SORTS);

  if (books.length === 0) {
    return (
      <>
        <LegacyImportBanner />
        <div className="empty-state">
          <h1>Your shelf is empty</h1>
          <p>Log the books you read, rate them, and gather them into lists.</p>
          <Link to="/new" className="btn btn-primary btn-large">
            Log your first book
          </Link>
        </div>
      </>
    );
  }

  return (
    <div className="page">
      <LegacyImportBanner />
      <section className="profile-header">
        <Stats books={books} />
        <RatingHistogram books={books} q={q} />
      </section>

      <div className="toolbar ruled">
        <h2 className="section-heading">
          Books
          {q.isFiltered && <span className="muted">{`${q.shown.length} of ${books.length}`}</span>}
        </h2>
        <BookControls q={q} />
      </div>

      {q.shown.length ? <BookGrid books={q.shown} /> : <NoMatches q={q} />}
    </div>
  );
}

function Stats({ books }: { books: Book[] }) {
  const thisYear = String(new Date().getFullYear());
  const pages = books.reduce((sum, b) => sum + (b.pages ?? 0), 0);
  const readThisYear = books.filter((b) =>
    b.dateRead ? b.dateRead.startsWith(thisYear) : new Date(b.createdAt).getFullYear() === Number(thisYear),
  ).length;

  return (
    <dl className="stats">
      <div>
        <dt>Books</dt>
        <dd>{books.length.toLocaleString()}</dd>
      </div>
      <div>
        <dt>This year</dt>
        <dd>{readThisYear.toLocaleString()}</dd>
      </div>
      <div>
        <dt>Pages</dt>
        <dd>{pages.toLocaleString()}</dd>
      </div>
    </dl>
  );
}

/** Letterboxd-style ratings spread; clicking a bar shows only books with that rating. */
function RatingHistogram({ books, q }: { books: Book[]; q: BookQuery }) {
  const counts = Array.from({ length: 10 }, (_, i) => books.filter((b) => b.rating === (i + 1) / 2).length);
  const rated = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);
  const average = rated ? books.reduce((s, b) => s + (b.rating ?? 0), 0) / rated : 0;

  return (
    <div className="histogram">
      <h2 className="section-heading">
        Ratings <span className="muted">{rated ? `avg ${average.toFixed(1)}` : 'none yet'}</span>
      </h2>
      <div className="histogram-body">
        <span className="stars histogram-end">★</span>
        <div className="histogram-bars">
          {counts.map((count, i) => {
            const value = String((i + 1) / 2);
            const active = q.rating === value;
            return (
              <button
                type="button"
                key={i}
                className={`histogram-bar${active ? ' active' : ''}`}
                style={{ height: `${Math.max(3, (count / max) * 100)}%` }}
                title={`${plural(count, 'book')} rated ${starText((i + 1) / 2)}`}
                aria-label={`${active ? 'Stop showing only' : 'Show only'} books rated ${(i + 1) / 2} (${count})`}
                aria-pressed={active}
                onClick={() => q.setRating(active ? '' : value)}
              />
            );
          })}
        </div>
        <span className="stars histogram-end">★★★★★</span>
      </div>
    </div>
  );
}

/** Offers to copy books saved in this browser by the first, offline-only version of the app. */
function LegacyImportBanner() {
  const [legacy, setLegacy] = useState<ShelfData | null>(null);
  const [progress, setProgress] = useState<string>('');

  useEffect(() => {
    if (legacyHandled()) return;
    readLegacyShelf().then(setLegacy, () => setLegacy(null));
  }, []);

  if (!legacy) return null;

  const run = async () => {
    setProgress('Starting…');
    try {
      await importShelf(legacy, 'merge', (done, total) => setProgress(`Copying ${done} of ${total}…`));
      markLegacyHandled();
      setLegacy(null);
    } catch (err) {
      reportError(err);
      setProgress('');
    }
  };

  return (
    <div className="banner">
      <p>
        <strong>{plural(legacy.books.length, 'book')}</strong>
        {legacy.lists.length > 0 && <> and {plural(legacy.lists.length, 'list')}</>} from before are saved only in
        this browser. Copy them to your account so they're on all your devices?
      </p>
      <div className="banner-actions">
        {progress ? (
          <span className="muted">{progress}</span>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-small" onClick={run}>
              Copy to my account
            </button>
            {/* Not remembered: the offer returns next visit, so old books can't be forgotten by accident */}
            <button type="button" className="link-button" onClick={() => setLegacy(null)}>
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
