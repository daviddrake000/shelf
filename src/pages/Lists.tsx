import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { createList, saveListOrder } from '../db';
import { useShelf } from '../shelf';
import { Cover } from '../components/Cover';
import { ReorderList } from '../components/ReorderList';
import { plural } from '../utils';

const STACK_SIZE = 5;

export function Lists() {
  const { lists, bookById } = useShelf();
  const [creating, setCreating] = useState(false);
  const [reordering, setReordering] = useState(false);

  return (
    <div className="page">
      <div className="toolbar">
        <h1 className="page-title">Lists</h1>
        <div className="toolbar-buttons">
          {reordering ? (
            <button type="button" className="btn btn-primary" onClick={() => setReordering(false)}>
              Done
            </button>
          ) : (
            !creating && (
              <>
                {lists.length > 1 && (
                  <button type="button" className="btn" onClick={() => setReordering(true)}>
                    Reorder
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                  New list
                </button>
              </>
            )
          )}
        </div>
      </div>

      {creating && <NewListForm onCancel={() => setCreating(false)} />}

      {reordering ? (
        <>
          <p className="reorder-hint muted">Drag the handles to put your lists in order. Changes save automatically.</p>
          <ReorderList
            items={lists}
            getId={(list) => list.id}
            itemLabel={(list) => list.name}
            onReorder={saveListOrder}
            renderItem={(list) => (
              <>
                <span className="reorder-stack" aria-hidden="true">
                  {Array.from({ length: 3 }, (_, i) => {
                    const book = bookById.get(list.bookIds[i]);
                    return book ? <Cover key={i} book={book} /> : <span key={i} className="cover cover-empty" />;
                  })}
                </span>
                <span className="reorder-text">
                  <span className="reorder-name">{list.name}</span>
                  <span className="reorder-sub">{plural(list.bookIds.length, 'book')}</span>
                </span>
              </>
            )}
          />
        </>
      ) : lists.length === 0 && !creating ? (
        <div className="empty-state">
          <p>Lists let you group books however you like: favourites, a genre, books for a trip, a reading challenge.</p>
          <button type="button" className="btn btn-primary btn-large" onClick={() => setCreating(true)}>
            Start your first list
          </button>
        </div>
      ) : (
        <ul className="list-cards">
          {lists.map((list) => {
            const stack = list.bookIds.slice(0, STACK_SIZE).map((id) => bookById.get(id));
            return (
              <li key={list.id}>
                <Link to={`/lists/${list.id}`} className="list-card">
                  <div className="cover-stack">
                    {Array.from({ length: STACK_SIZE }, (_, i) => {
                      const book = stack[i];
                      return (
                        <div key={i} className="stack-item" style={{ zIndex: STACK_SIZE - i }}>
                          {book ? <Cover book={book} /> : <div className="cover cover-empty" />}
                        </div>
                      );
                    })}
                  </div>
                  <h2 className="list-card-name">{list.name}</h2>
                  <p className="list-card-count">{plural(list.bookIds.length, 'book')}</p>
                  {list.description && <p className="list-card-desc">{list.description}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NewListForm({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    navigate(`/lists/${createList(name.trim(), description.trim() || undefined)}`);
  };

  return (
    <form className="panel list-form" onSubmit={onSubmit}>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required placeholder="e.g. All-time favourites" />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="form-actions">
        <span className="spacer" />
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          Create list
        </button>
      </div>
    </form>
  );
}
