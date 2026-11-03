import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { deleteList, setBookInList, setListBooks, updateList, type Book, type BookList } from '../db';
import { useShelf } from '../shelf';
import { LIST_SORTS, useBookQuery } from '../bookQuery';
import { BookGrid } from '../components/BookGrid';
import { BookControls, NoMatches } from '../components/BookControls';
import { Cover } from '../components/Cover';
import { ReorderList } from '../components/ReorderList';
import { plural } from '../utils';

export function ListDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { lists, bookById } = useShelf();
  const list = lists.find((l) => l.id === id);
  const books = useMemo(
    () => (list?.bookIds ?? []).map((bookId) => bookById.get(bookId)).filter((b): b is Book => !!b),
    [list, bookById],
  );
  const q = useBookQuery(books, LIST_SORTS);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [reordering, setReordering] = useState(false);

  if (!list) {
    return (
      <div className="empty-state">
        <h1>List not found</h1>
        <Link to="/lists" className="btn">
          All lists
        </Link>
      </div>
    );
  }

  const onDelete = () => {
    if (!confirm(`Delete the list “${list.name}”? The books themselves stay in your library.`)) return;
    deleteList(id);
    navigate('/lists', { replace: true });
  };

  return (
    <div className="page">
      <Link to="/lists" className="back-link">
        ← All lists
      </Link>

      {editing ? (
        <EditListForm list={list} onDone={() => setEditing(false)} />
      ) : (
        <header className="list-header">
          <div>
            <h1 className="page-title">{list.name}</h1>
            {list.description && <p className="list-description">{list.description}</p>}
            <p className="muted">{plural(books.length, 'book')}</p>
          </div>
          <div className="list-header-actions">
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="btn btn-danger" onClick={onDelete}>
              Delete
            </button>
          </div>
        </header>
      )}

      <div className="toolbar ruled">
        <h2 className="section-heading">
          Books
          {q.isFiltered && !reordering && <span className="muted">{`${q.shown.length} of ${books.length}`}</span>}
        </h2>
        {reordering ? (
          <button type="button" className="btn btn-primary" onClick={() => setReordering(false)}>
            Done
          </button>
        ) : (
          <>
            {books.length > 1 && <BookControls q={q} />}
            <div className="toolbar-buttons">
              {books.length > 1 && !adding && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    // The list's own order is what's being edited, so show it unsorted and unfiltered
                    q.reset();
                    setReordering(true);
                  }}
                >
                  Reorder
                </button>
              )}
              <button
                type="button"
                className={`btn${adding ? '' : ' btn-primary'}`}
                onClick={() => setAdding((a) => !a)}
              >
                {adding ? 'Done adding' : 'Add books'}
              </button>
            </div>
          </>
        )}
      </div>

      {adding && <AddBooksPanel list={list} />}

      {reordering ? (
        <>
          <p className="reorder-hint muted">
            Drag the handles to set this list's order. Changes save automatically.
          </p>
          <ReorderList
            items={books}
            getId={(book) => book.id}
            itemLabel={(book) => book.title}
            onReorder={(ids) => setListBooks(id, ids)}
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
      ) : books.length === 0 ? (
        !adding && <p className="muted center pad">This list is empty. Use “Add books” to fill it.</p>
      ) : q.shown.length ? (
        <BookGrid
          books={q.shown}
          onRemove={(book) => setBookInList(id, book.id, false)}
          removeLabel="Remove from list"
        />
      ) : (
        <NoMatches q={q} />
      )}
    </div>
  );
}

function EditListForm({ list, onDone }: { list: BookList; onDone: () => void }) {
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? '');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateList(list.id, { name: name.trim(), description: description.trim() || undefined });
    onDone();
  };

  return (
    <form className="panel list-form" onSubmit={onSubmit}>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="form-actions">
        <span className="spacer" />
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          Save
        </button>
      </div>
    </form>
  );
}

function AddBooksPanel({ list }: { list: BookList }) {
  const { books } = useShelf();
  const [query, setQuery] = useState('');

  const candidates = useMemo(() => {
    const inList = new Set(list.bookIds);
    const q = query.trim().toLowerCase();
    return books
      .filter((b) => !inList.has(b.id))
      .filter((b) => !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [books, list.bookIds, query]);

  return (
    <div className="panel add-panel">
      <div className="add-panel-head">
        <input
          type="search"
          className="search"
          placeholder="Search your library"
          aria-label="Search your library"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <Link to={`/new?list=${list.id}`} className="link-button">
          Log a new book into this list →
        </Link>
      </div>
      {candidates.length ? (
        <ul className="pick-grid">
          {candidates.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                className="pick-item"
                onClick={() => setBookInList(list.id, book.id, true)}
                title={`Add “${book.title}”`}
              >
                <span className="pick-cover">
                  <Cover book={book} />
                  <span className="pick-plus" aria-hidden="true">
                    +
                  </span>
                </span>
                <span className="pick-title">{book.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted center">
          {query.trim()
            ? 'No matches.'
            : books.length
              ? 'Every book in your library is already in this list.'
              : 'Your library is empty.'}
        </p>
      )}
    </div>
  );
}
