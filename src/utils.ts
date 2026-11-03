export interface CoverImages {
  /** ~600px wide, shown on the book page. */
  cover: string;
  /** ~300px wide, shown in grids. Small so the whole library loads quickly on a phone. */
  thumb: string;
}

function renderJpeg(bitmap: ImageBitmap, maxWidth: number, quality: number): string {
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image.');
  // White backdrop so transparent PNGs don't turn black as JPEG
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Downscales an uploaded image into the two JPEG sizes the app stores. */
export async function makeCoverImages(file: Blob): Promise<CoverImages> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const bitmap = await createImageBitmap(file);
  try {
    return { cover: renderJpeg(bitmap, 600, 0.85), thumb: renderJpeg(bitmap, 300, 0.8) };
  } finally {
    bitmap.close();
  }
}

/** Builds the grid thumbnail for a cover that is already stored as a data URL. */
export async function makeThumb(coverDataUrl: string): Promise<string> {
  const bitmap = await createImageBitmap(await (await fetch(coverDataUrl)).blob());
  try {
    return renderJpeg(bitmap, 300, 0.8);
  } finally {
    bitmap.close();
  }
}

/** Letterboxd-style text rating, e.g. 3.5 → "★★★½". */
export function starText(rating: number | undefined): string {
  if (!rating) return '';
  return '★'.repeat(Math.floor(rating)) + (rating % 1 ? '½' : '');
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Stable muted color per title, for books without an uploaded cover. */
export function placeholderColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 32% 30%)`;
}

const isbn13CheckDigit = (first12: string) =>
  String((10 - ([...first12].reduce((sum, d, i) => sum + Number(d) * (i % 2 ? 3 : 1), 0) % 10)) % 10);

/**
 * Cleans up a typed ISBN and returns it as ISBN-13 digits (ISBN-10s are converted).
 * '' when the field is empty, null when it isn't a valid ISBN.
 */
export function normalizeIsbn(input: string): string | null {
  const raw = input.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (!raw) return '';
  if (/^\d{13}$/.test(raw)) return isbn13CheckDigit(raw.slice(0, 12)) === raw[12] ? raw : null;
  if (/^\d{9}[\dX]$/.test(raw)) {
    const sum = [...raw].reduce((s, c, i) => s + (c === 'X' ? 10 : Number(c)) * (10 - i), 0);
    if (sum % 11 !== 0) return null;
    const first12 = '978' + raw.slice(0, 9);
    return first12 + isbn13CheckDigit(first12);
  }
  return null;
}

export function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
