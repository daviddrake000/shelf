import type { Book } from '../db';
import { placeholderColor } from '../utils';

interface CoverProps {
  book: Pick<Book, 'title' | 'author' | 'thumb'>;
  /** A specific image to show instead of the book's grid thumbnail (e.g. the full-size cover). */
  src?: string | null;
  className?: string;
}

/** A 2:3 book cover; falls back to a generated title card when no image was uploaded. */
export function Cover({ book, src, className = '' }: CoverProps) {
  const image = src ?? book.thumb;
  if (image) {
    return <img className={`cover ${className}`} src={image} alt={`Cover of ${book.title}`} loading="lazy" />;
  }
  return (
    <div
      className={`cover cover-placeholder ${className}`}
      style={{ backgroundColor: placeholderColor(book.title || '?') }}
      role="img"
      aria-label={`${book.title}${book.author ? ` by ${book.author}` : ''}`}
    >
      <span className="ph-title">{book.title || 'Untitled'}</span>
      {book.author && <span className="ph-author">{book.author}</span>}
    </div>
  );
}
