import { useState } from 'react';
import { Link } from 'react-router';
import { saveQueueOrder, type Book } from '../db';
import { useShelf } from '../shelf';
import { BookGrid } from '../components/BookGrid';
import { Cover } from '../components/Cover';
import { LogBookDialog } from '../components/LogBookDialog';
import { ReorderList } from '../components/ReorderList';
import { plural } from '../utils';

/** Books you own but haven't read, in the order you plan to read them. */
export function Queue() {
  const { queue, wishlist } = useShelf();
  const [reordering, setReordering] = useState(false);
  const [logging, setLogging] = useState<Book | null>(null);

  return (
    <div className="page">
      <div className="toolbar">
        <div>
          <h1 className="page-title">Queue</h1>
          <p className="page-subtitle">
            Books you own but haven't read yet{queue.length > 0 && ` · ${plural(queue.length, 'book')}`}
          </p>
        </div>
        <div className="toolbar-buttons">
          {reordering ? (
            <button type="button" className="btn btn-primary" onClick={() => setReordering(false)}>
              Done
            </button>
          ) : (
            <>
              {queue.length > 1 && (
                <button type="button" className="btn" onClick={() => setReordering(true)}>
                  Reorder
                </button>
              )}
              <Link to="/new?to=queue" className="btn btn-primary">
                Add book
              </Link>
            </>
          )}
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="empty-state compact">
          <p>
            Your queue is empty. Add books you own but haven't read yet
            {wishlist.length > 0 && ', or move them here from your wishlist'}.
          </p>
          <Link to="/new?to=queue" className="btn btn-primary btn-large">
            Add a book
          </Link>
        </div>
      ) : reordering ? (
        <>
          <p className="reorder-hint muted">Drag the handles to set your reading order. Changes save automatically.</p>
          <ReorderList
            items={queue}
            getId={(book) => book.id}
            itemLabel={(book) => book.title}
            onReorder={saveQueueOrder}
            renderItem={(book) => (
              <>
                <span className="reorder-thumb" aria-hidden="true">
                  <Cover book={book} />
                </span>
                <span className="reorder-text">
                  <span className="reorder-name">{book.title}</span>
                  <span className="reorder-sub">{[book.author, book.year].filter(Boolean).join(' · ')}</span>
                </span>
              </>
            )}
          />
        </>
      ) : (
        <BookGrid
          books={queue}
          numbered
          renderMeta={(book) => (
            <button type="button" className="card-action" onClick={() => setLogging(book)}>
              Add to log
            </button>
          )}
        />
      )}

      {logging && <LogBookDialog book={logging} onClose={() => setLogging(null)} />}
    </div>
  );
}
