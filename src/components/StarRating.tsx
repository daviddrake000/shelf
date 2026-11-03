import { useState, type KeyboardEvent } from 'react';
import { starText } from '../utils';

const STAR_PATH = 'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';

function StarIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={STAR_PATH} />
    </svg>
  );
}

/** Read-only rating, rendered the Letterboxd way: ★★★½ */
export function Stars({ rating, className = '' }: { rating?: number; className?: string }) {
  if (!rating) return null;
  return (
    <span className={`stars ${className}`} aria-label={`${rating} out of 5 stars`} title={`${rating} / 5`}>
      {starText(rating)}
    </span>
  );
}

interface StarInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  size?: number;
}

/** Half-star rating input. Click the left or right half of a star; click the current value again to clear. */
export function StarInput({ value, onChange, size = 30 }: StarInputProps) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  const pick = (v: number) => onChange(v === value ? undefined : v);

  const onKeyDown = (e: KeyboardEvent) => {
    const current = value ?? 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(5, current + 0.5));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = current - 0.5;
      onChange(next > 0 ? next : undefined);
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onChange(undefined);
    }
  };

  return (
    <div className="star-input-wrap">
      <div
        className={`star-input${hover !== null ? ' is-hovering' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label="Rating"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value ?? 0}
        aria-valuetext={value ? `${value} out of 5 stars` : 'Unrated'}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = shown >= i ? 100 : shown >= i - 0.5 ? 50 : 0;
          return (
            <span key={i} className="star-slot" style={{ width: size, height: size }}>
              <span className="star-empty">
                <StarIcon size={size} />
              </span>
              <span className="star-fill" style={{ width: `${fill}%` }}>
                <StarIcon size={size} />
              </span>
              <span className="star-hit left" onMouseEnter={() => setHover(i - 0.5)} onClick={() => pick(i - 0.5)} />
              <span className="star-hit right" onMouseEnter={() => setHover(i)} onClick={() => pick(i)} />
            </span>
          );
        })}
      </div>
      <span className="star-input-label">{shown ? `${shown} / 5` : 'Unrated'}</span>
      {value !== undefined && hover === null && (
        <button type="button" className="link-button" onClick={() => onChange(undefined)}>
          Clear
        </button>
      )}
    </div>
  );
}
