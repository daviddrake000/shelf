import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { deleteBook, notify, saveBook, type Book, type BookStatus } from '../db';
import { useCover, useShelf } from '../shelf';
import { StarInput } from '../components/StarRating';
import { ListPicker } from '../components/ListPicker';
import { Cover } from '../components/Cover';
import { makeCoverImages, normalizeIsbn, todayISO, type CoverImages } from '../utils';

const NEW_TITLES = { queue: 'Add to queue', wishlist: 'Add to wishlist' } as const;
const TAB_PATHS = { queue: '/queue', wishlist: '/wishlist' } as const;

/** Add a new book (/new, or /new?to=queue|wishlist) or edit an existing one (/book/:id/edit). */
export function BookForm() {
  const { id } = useParams();
  const { bookById } = useShelf();
  const navigate = useNavigate();
  const existing = id ? bookById.get(id) : undefined;

  useEffect(() => {
    if (id && !existing) navigate('/', { replace: true });
  }, [id, existing, navigate]);

  if (id && !existing) return null;
  // Keyed so switching between books starts from fresh form state
  return <BookFormFields key={id ?? 'new'} existing={existing} />;
}

function BookFormFields({ existing }: { existing?: Book }) {
  const { lists } = useShelf();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const savedCover = useCover(existing?.id);
  // Queue and wishlist books haven't been read, so they have no rating or date read
  const to = searchParams.get('to');
  const status: BookStatus | undefined = existing
    ? existing.status
    : to === 'queue' || to === 'wishlist'
      ? to
      : undefined;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [author, setAuthor] = useState(existing?.author ?? '');
  const [year, setYear] = useState(existing?.year?.toString() ?? '');
  const [pages, setPages] = useState(existing?.pages?.toString() ?? '');
  const [isbn, setIsbn] = useState(existing?.isbn ?? '');
  const [rating, setRating] = useState(existing?.rating);
  const [review, setReview] = useState(existing?.review ?? '');
  const [dateRead, setDateRead] = useState(existing ? (existing.dateRead ?? '') : todayISO());
  // undefined = unchanged, null = removed
  const [newCover, setNewCover] = useState<CoverImages | null | undefined>();
  const [listIds, setListIds] = useState<string[]>(() => {
    if (existing) return lists.filter((l) => l.bookIds.includes(existing.id)).map((l) => l.id);
    const fromList = searchParams.get('list');
    return fromList ? [fromList] : [];
  });
  const [error, setError] = useState('');

  // What the cover box shows: a new upload, the saved full-size cover, or its thumbnail while that loads
  const shownCover = newCover === undefined ? (savedCover ?? existing?.thumb) : newCover?.cover;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('A title is required.');
      return;
    }
    const isbn13 = normalizeIsbn(isbn);
    if (isbn13 === null) {
      setError("That ISBN doesn't look right. It should be the 10 or 13 digits printed by the barcode.");
      return;
    }
    try {
      const id = saveBook({
        input: {
          title: title.trim(),
          author: author.trim(),
          year: year ? Number(year) : undefined,
          pages: pages ? Number(pages) : undefined,
          isbn: isbn13 || undefined,
          rating: status ? undefined : rating,
          review: review.trim() || undefined,
          dateRead: status ? undefined : dateRead || undefined,
          status,
        },
        cover: newCover,
        listIds,
        lists,
        existing,
      });
      if (!existing && status) {
        // Back to the tab, ready to add another
        notify({ message: `Added “${title.trim()}”.`, link: { to: `/book/${id}`, label: 'View' } });
        navigate(TAB_PATHS[status], { replace: true });
      } else {
        navigate(`/book/${id}`, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the book.');
    }
  };

  const onDelete = () => {
    if (!existing) return;
    if (!confirm(`Delete “${existing.title}” from your shelf? This also removes it from all lists.`)) return;
    deleteBook(existing, lists);
    navigate(existing.status ? TAB_PATHS[existing.status] : '/', { replace: true });
  };

  const toggleList = (id: string) =>
    setListIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <div className="page narrow">
      <h1 className="page-title">{existing ? 'Edit book' : status ? NEW_TITLES[status] : 'Log a book'}</h1>

      <form className="book-form" onSubmit={onSubmit}>
        <CoverField
          cover={shownCover ?? undefined}
          title={title}
          author={author}
          onChange={setNewCover}
          onError={setError}
        />

        <div className="form-fields">
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus={!existing} />
          </label>
          <label className="field">
            <span>Author</span>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
          <div className={`field-row${status ? ' two' : ''}`}>
            <label className="field">
              <span>Year published</span>
              <input type="number" inputMode="numeric" step={1} value={year} onChange={(e) => setYear(e.target.value)} />
            </label>
            <label className="field">
              <span>Pages</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={pages}
                onChange={(e) => setPages(e.target.value)}
              />
            </label>
            {!status && (
              <label className="field">
                <span>Date read</span>
                <input type="date" value={dateRead} onChange={(e) => setDateRead(e.target.value)} />
              </label>
            )}
          </div>

          <label className="field">
            <span>ISBN (optional)</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="978…, from the back cover or copyright page"
            />
          </label>

          {!status && (
            <div className="field">
              <span>Rating</span>
              <StarInput value={rating} onChange={setRating} />
            </div>
          )}

          <label className="field">
            <span>{status ? 'Notes' : 'Review'}</span>
            <textarea
              rows={status ? 4 : 6}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder={status ? 'Why you want to read it, who recommended it…' : 'What did you think?'}
            />
          </label>

          <div className="field">
            <span>Lists</span>
            <ListPicker selected={listIds} onToggle={toggleList} />
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="form-actions">
            {existing && (
              <button type="button" className="btn btn-danger" onClick={onDelete}>
                Delete
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

interface CoverFieldProps {
  cover: string | undefined;
  title: string;
  author: string;
  onChange: (cover: CoverImages | null) => void;
  onError: (message: string) => void;
}

function CoverField({ cover, title, author, onChange, onError }: CoverFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await makeCoverImages(file));
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not read that image.');
    } finally {
      setBusy(false);
    }
  };

  // Paste an image from the clipboard anywhere on the form page
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        handleFile(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="cover-field">
      <button
        type="button"
        className={`dropzone${dragging ? ' dragging' : ''}${cover ? ' has-cover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-label={cover ? 'Replace cover image' : 'Upload cover image'}
      >
        {cover ? (
          <Cover book={{ title, author }} src={cover} />
        ) : (
          <span className="dropzone-hint">
            {busy ? (
              'Processing…'
            ) : (
              <>
                <strong>Add cover</strong>
                <span>Tap to choose a photo, or drop or paste an image</span>
              </>
            )}
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {cover && (
        <div className="cover-actions">
          <button type="button" className="link-button" onClick={() => inputRef.current?.click()}>
            Replace
          </button>
          <button type="button" className="link-button" onClick={() => onChange(null)}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
