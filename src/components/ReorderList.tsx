import { useEffect, useState, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ReorderListProps<T> {
  items: T[];
  getId: (item: T) => string;
  /** Spoken name of an item, for screen readers and the handle's label. */
  itemLabel: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onReorder: (ids: string[]) => void;
}

/**
 * Rows that can be dragged into a new order by their handle: with a mouse, by touch, or from
 * the keyboard (focus a handle, Space to pick up, arrow keys to move, Space to drop).
 */
export function ReorderList<T>({ items, getId, itemLabel, renderItem, onReorder }: ReorderListProps<T>) {
  // Kept locally so a dropped row stays where it was put while the save reaches the shelf
  const incoming = items.map(getId).join('\n');
  const [ids, setIds] = useState(() => items.map(getId));
  useEffect(() => {
    setIds(incoming ? incoming.split('\n') : []);
  }, [incoming]);

  const byId = new Map(items.map((item) => [getId(item), item]));
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const name = (id: UniqueIdentifier) => {
    const item = byId.get(String(id));
    return item ? itemLabel(item) : 'Item';
  };
  const position = (id: UniqueIdentifier) => `position ${ids.indexOf(String(id)) + 1} of ${ids.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}, ${position(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${name(active.id)} moved to ${position(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) => `${name(active.id)} dropped${over ? ` at ${position(over.id)}` : ''}.`,
    onDragCancel: ({ active }) => `Cancelled moving ${name(active.id)}.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    setIds(next);
    onReorder(next);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To move an item, press Space or Enter. Use the arrow keys to move it, Space or Enter to drop it, or Escape to cancel.',
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className="reorder-list">
          {ids.map((id, i) => {
            const item = byId.get(id);
            if (!item) return null;
            return (
              <SortableRow key={id} id={id} position={i + 1} label={itemLabel(item)}>
                {renderItem(item)}
              </SortableRow>
            );
          })}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

interface SortableRowProps {
  id: string;
  position: number;
  label: string;
  children: ReactNode;
}

function SortableRow({ id, position, label, children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <li
      ref={setNodeRef}
      className={`reorder-row${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="drag-handle"
        {...attributes}
        {...listeners}
        aria-label={`Move ${label} (position ${position})`}
      >
        <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden="true">
          {[3, 10, 17].map((y) =>
            [4, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.7" fill="currentColor" />),
          )}
        </svg>
      </button>
      <span className="reorder-pos">{position}</span>
      {children}
    </li>
  );
}
