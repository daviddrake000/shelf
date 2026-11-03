import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Book } from '../db';
import { Cover } from './Cover';
import { Stars } from './StarRating';

interface BookGridProps {
  books: Book[];
  /** When provided, each card gets a remove button (used inside lists). */
  onRemove?: (book: Book) => void;
  removeLabel?: string;
  /** Show each book's position on its cover (the queue). */
  numbered?: boolean;
  /** Replaces what's under each cover (stars by default). */
  renderMeta?: (book: Book) => ReactNode;
}

const STATUS_LABEL = { queue: 'In queue', wishlist: 'Wishlist' } as const;

function DefaultMeta({ book }: { book: Book }) {
  if (book.status) return <span className="status-tag">{STATUS_LABEL[book.status]}</span>;
  return <Stars rating={book.rating} />;
}

export function BookGrid({ books, onRemove, removeLabel = 'Remove', numbered, renderMeta }: BookGridProps) {
  return (
    <ul className="book-grid">
      {books.map((book, i) => (
        <li key={book.id} className="book-card">
          <Link to={`/book/${book.id}`} className="cover-frame" title={`${book.title}${book.year ? ` (${book.year})` : ''}`}>
            <Cover book={book} />
            <span className="hover-info">
              <span className="hover-title">{book.title}</span>
              {book.author && <span className="hover-author">{book.author}</span>}
            </span>
          </Link>
          {numbered && (
            <span className="position-badge" aria-label={`Number ${i + 1}`}>
              {i + 1}
            </span>
          )}
          {onRemove && (
            <button
              type="button"
              className="card-remove"
              onClick={() => onRemove(book)}
              aria-label={`${removeLabel}: ${book.title}`}
              title={removeLabel}
            >
              ×
            </button>
          )}
          <div className="card-meta">{renderMeta ? renderMeta(book) : <DefaultMeta book={book} />}</div>
        </li>
      ))}
    </ul>
  );
}
