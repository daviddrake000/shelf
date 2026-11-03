import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { moveToQueue, setBookInList, setRating } from '../db';
import { useCover, useShelf } from '../shelf';
import { Cover } from '../components/Cover';
import { StarInput } from '../components/StarRating';
import { ListPicker } from '../components/ListPicker';
import { LogBookDialog } from '../components/LogBookDialog';
import { formatDate, plural } from '../utils';

export function BookDetail() {
  const { id = '' } = useParams();
  const { bookById, lists, queue } = useShelf();
  const book = bookById.get(id);
  const fullCover = useCover(book ? id : undefined);
  const [logging, setLogging] = useState(false);

  if (!book) {
    return (
      <div className="empty-state">
        <h1>Book not found</h1>
        <Link to="/" className="btn">
          Back to library
        </Link>
      </div>
    );
  }

  // Show the thumbnail until the full-size cover arrives
  const cover = fullCover ?? book.thumb;
  const inLists = lists.filter((l) => l.bookIds.includes(id)).map((l) => l.id);

  return (
    <div className="book-detail">
      {cover && <div className="backdrop" style={{ backgroundImage: `url("${cover}")` }} aria-hidden="true" />}

      <div className="page detail-layout">
        <div className="detail-cover">
          <Cover book={book} src={cover} />
        </div>

        <div className="detail-main">
          <h1 className="detail-title">
            {book.title} {book.year !== undefined && <span className="detail-year">{book.year}</span>}
          </h1>
          {book.author && (
            <p className="detail-author">
              by{' '}
              <Link to={`/?q=${encodeURIComponent(book.author)}`} className="author-link">
                {book.author}
              </Link>
            </p>
          )}

          <p className="detail-meta">
            {[
              book.pages && plural(book.pages, 'page'),
              book.dateRead && `Read ${formatDate(book.dateRead)}`,
              book.isbn && `ISBN ${book.isbn}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>

          {book.status === 'queue' ? (
            <section className="detail-section status-panel">
              <p>
                <strong>#{queue.findIndex((b) => b.id === id) + 1}</strong> in your{' '}
                <Link to="/queue">queue</Link>
              </p>
              <button type="button" className="btn btn-primary" onClick={() => setLogging(true)}>
                Add to log
              </button>
            </section>
          ) : book.status === 'wishlist' ? (
            <section className="detail-section status-panel">
              <p>
                On your <Link to="/wishlist">wishlist</Link>
              </p>
              <button type="button" className="btn btn-primary" onClick={() => moveToQueue(book, queue.length)}>
                Add to queue
              </button>
            </section>
          ) : (
            <section className="detail-section">
              <h2 className="section-heading">Your rating</h2>
              <StarInput value={book.rating} onChange={(rating) => setRating(id, rating)} size={34} />
            </section>
          )}

          {book.review && (
            <section className="detail-section">
              <h2 className="section-heading">{book.status ? 'Notes' : 'Review'}</h2>
              <div className="review">
                {book.review.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          )}

          <section className="detail-section">
            <h2 className="section-heading">Lists</h2>
            <ListPicker
              selected={inLists}
              onToggle={(listId) => setBookInList(listId, id, !inLists.includes(listId))}
            />
          </section>

          <div className="detail-actions">
            <Link to={`/book/${id}/edit`} className="btn">
              Edit details
            </Link>
          </div>
        </div>
      </div>

      {logging && <LogBookDialog book={book} onClose={() => setLogging(false)} />}
    </div>
  );
}
