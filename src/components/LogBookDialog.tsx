import { useEffect, useRef, useState, type FormEvent } from 'react';
import { logBook, notify, type Book } from '../db';
import { todayISO } from '../utils';
import { Cover } from './Cover';
import { StarInput } from './StarRating';

/** Asks for a rating (plus date read and a review), then moves the book to Books. */
export function LogBookDialog({ book, onClose }: { book: Book; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [rating, setRating] = useState<number | undefined>();
  const [dateRead, setDateRead] = useState(todayISO());
  // Notes written while it was queued carry over, so nothing is lost; replace them with a review
  const [review, setReview] = useState(book.review ?? '');

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    logBook(book, { rating, dateRead: dateRead || undefined, review: review.trim() || undefined });
    notify({ message: `“${book.title}” is now in your Books.`, link: { to: `/book/${book.id}`, label: 'View' } });
    ref.current?.close();
  };

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="log-dialog-title"
      onClose={onClose}
      // A click on the backdrop lands on the dialog element itself
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <form className="dialog-body" onSubmit={onSubmit}>
        <div className="dialog-head">
          <span className="dialog-cover" aria-hidden="true">
            <Cover book={book} />
          </span>
          <div>
            <p className="dialog-kicker">Finished reading</p>
            <h2 id="log-dialog-title" className="dialog-title">
              {book.title}
            </h2>
            {book.author && <p className="muted">by {book.author}</p>}
          </div>
        </div>

        <div className="field">
          <span>Your rating</span>
          <StarInput value={rating} onChange={setRating} size={34} />
        </div>
        <label className="field">
          <span>Date read</span>
          <input type="date" value={dateRead} onChange={(e) => setDateRead(e.target.value)} />
        </label>
        <label className="field">
          <span>Review</span>
          <textarea rows={4} value={review} onChange={(e) => setReview(e.target.value)} placeholder="What did you think?" />
        </label>

        <div className="form-actions">
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Add to log
          </button>
        </div>
      </form>
    </dialog>
  );
}
