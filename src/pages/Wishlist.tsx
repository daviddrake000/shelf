import { Link } from 'react-router';
import { moveToQueue } from '../db';
import { useShelf } from '../shelf';
import { WISHLIST_SORTS, WISHLIST_SORT_LABELS, useBookQuery } from '../bookQuery';
import { BookGrid } from '../components/BookGrid';
import { BookControls, NoMatches } from '../components/BookControls';
import { plural } from '../utils';

/** Books you'd like to read, by release date. */
export function Wishlist() {
  const { wishlist, queue } = useShelf();
  const q = useBookQuery(wishlist, WISHLIST_SORTS, WISHLIST_SORT_LABELS);

  return (
    <div className="page">
      <div className="toolbar">
        <div>
          <h1 className="page-title">Wishlist</h1>
          <p className="page-subtitle">Books you'd like to read</p>
        </div>
        <Link to="/new?to=wishlist" className="btn btn-primary">
          Add book
        </Link>
      </div>

      {wishlist.length === 0 ? (
        <div className="empty-state compact">
          <p>Your wishlist is empty. Add books you'd like to read; when you get a copy, move them to your queue.</p>
          <Link to="/new?to=wishlist" className="btn btn-primary btn-large">
            Add a book
          </Link>
        </div>
      ) : (
        <>
          <div className="toolbar ruled">
            <h2 className="section-heading">
              {plural(wishlist.length, 'book')}
              {q.isFiltered && <span className="muted">{`${q.shown.length} shown`}</span>}
            </h2>
            {wishlist.length > 1 && <BookControls q={q} showRating={false} />}
          </div>

          {q.shown.length ? (
            <BookGrid
              books={q.shown}
              renderMeta={(book) => (
                <>
                  {book.year !== undefined && <span className="card-year">{book.year}</span>}
                  <button type="button" className="card-action" onClick={() => moveToQueue(book, queue.length)}>
                    Add to queue
                  </button>
                </>
              )}
            />
          ) : (
            <NoMatches q={q} />
          )}
        </>
      )}
    </div>
  );
}
