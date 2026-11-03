import { useState } from 'react';
import { createList } from '../db';
import { useShelf } from '../shelf';

interface ListPickerProps {
  selected: string[];
  onToggle: (listId: string) => void;
}

/** Toggleable chips for every list, plus inline creation of a new list (which is selected immediately). */
export function ListPicker({ selected, onToggle }: ListPickerProps) {
  // Same order as the Lists page
  const { lists } = useShelf();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onToggle(createList(trimmed));
    setName('');
    setCreating(false);
  };

  return (
    <div className="list-picker">
      {lists.map((list) => {
        const on = selected.includes(list.id);
        return (
          <button
            type="button"
            key={list.id}
            className={`chip${on ? ' on' : ''}`}
            aria-pressed={on}
            onClick={() => onToggle(list.id)}
          >
            <span aria-hidden="true">{on ? '✓' : '+'}</span> {list.name}
          </button>
        );
      })}
      {creating ? (
        <span className="chip-create">
          <input
            autoFocus
            value={name}
            placeholder="New list name"
            aria-label="New list name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                create();
              } else if (e.key === 'Escape') {
                setCreating(false);
              }
            }}
          />
          <button type="button" className="btn btn-small btn-primary" onClick={create} disabled={!name.trim()}>
            Create
          </button>
          <button type="button" className="link-button" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" className="chip chip-new" onClick={() => setCreating(true)}>
          New list…
        </button>
      )}
    </div>
  );
}
