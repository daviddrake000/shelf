import { RATING_FILTERS, ratingFilterLabel, type BookQuery } from '../bookQuery';

/** Search box, sort menu and (for read books) rating filter, driven by useBookQuery(). */
export function BookControls({ q, showRating = true }: { q: BookQuery; showRating?: boolean }) {
  // An exact rating picked from the chart isn't one of the presets; show it as an extra option
  const ratingOptions = RATING_FILTERS.some(([value]) => value === q.rating)
    ? RATING_FILTERS
    : [...RATING_FILTERS, [q.rating, ratingFilterLabel(q.rating)] as [string, string]];

  return (
    <div className="toolbar-controls">
      <input
        type="search"
        className="search"
        placeholder="Search title or author"
        aria-label="Search title or author"
        value={q.query}
        onChange={(e) => q.setQuery(e.target.value)}
      />
      <label className="control">
        <span>Sort</span>
        <select value={q.sort} onChange={(e) => q.setSort(e.target.value)}>
          {q.sortKeys.map((key) => (
            <option key={key} value={key}>
              {q.sortLabel(key)}
            </option>
          ))}
        </select>
      </label>
      {showRating && (
        <label className={`control${q.rating ? ' is-active' : ''}`}>
          <span>Rating</span>
          <select value={q.rating} onChange={(e) => q.setRating(e.target.value)}>
            {ratingOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

/** Shown in place of the grid when filters hide every book. */
export function NoMatches({ q }: { q: BookQuery }) {
  return (
    <div className="no-matches">
      <p className="muted">No books match these filters.</p>
      <button type="button" className="btn btn-small" onClick={q.clearFilters}>
        Clear filters
      </button>
    </div>
  );
}
