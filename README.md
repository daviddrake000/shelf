# Shelf

A Letterboxd-style tracker for the books you read: log books with a cover, author, year and page count, rate them out of five stars (half stars allowed), write a review, and group them into lists. Sort and filter your library or any list by date read, publication date or rating.

## Using it

Open the app at its Firebase address:

`https://<project-id>.firebaseapp.com`

Sign in with Google. Your shelf syncs between every device you sign in on.

**On your phone:** open that address, then add it to your home screen. In Safari, tap Share, then Add to Home Screen. In Chrome, open the ⋮ menu and choose Add to Home screen or Install app. It then opens full-screen like a normal app, and still works when you're offline; changes sync once you reconnect.

When a new version is published, an open copy of the app (a home-screen app on your phone, a tab left open) moves to it the next time you open or switch back to it, so every device runs the same version. If you're adding or editing a book at the time, it waits until you leave that page. The code is in `src/version.ts`.

## Where your data lives

Books, covers and lists are stored in Firestore (Google's cloud database) under your Google account. Security rules (`firestore.rules`) allow only you to read or change them. Each device also keeps a local copy, so the app opens instantly and works offline.

As a second copy, use **Export backup** in the footer now and then. It downloads one `.json` file with everything, covers included. **Restore from backup** replaces the shelf with the contents of a backup file.

## Reading feed for AI assistants

**Settings → Reading feed** creates a private, read-only link an AI assistant can fetch with a plain GET: no sign-in, no browser. **Copy instructions for your assistant** puts the link and the format below on the clipboard.

Shelf has no server of its own, so this isn't an `/api/...` route. The app keeps a JSON copy of the shelf in Firestore at `feeds/{secret}` and rewrites it whenever the shelf changes. The security rules let anyone fetch that exact document, but nobody can list feeds, and only the owner can write. **Make a new link** deletes the old copy, so the old link stops working (404) immediately. **Turn off** deletes it.

```
GET https://firestore.googleapis.com/v1/projects/<project-id>/databases/(default)/documents/feeds/<secret>?mask.fieldPaths=json
```

The response is a Firestore document: parse `fields.json.stringValue` as JSON. Its `updateTime` only changes when the shelf changes. Each item looks like this:

```json
{
  "id": "permanent book id",
  "book": { "title": "…", "authors": ["…"], "year": 1999, "isbn13": "9780676972658", "pages": 160 },
  "shelf": "read | queue | wishlist",
  "rating": 4.5,
  "date_finished": "2026-10-05",
  "date_logged": "2026-10-08T17:00:00.000Z",
  "date_added": "2026-09-01T12:00:00.000Z",
  "review": "for read books",
  "notes": "for queue and wishlist books",
  "lists": ["Favourites"],
  "queue_position": null
}
```

Items are newest first. `rating` is `null` when unrated. Very large shelves are split into pages; follow `next_page_url`.

## Developing

Shelf needs your own Firebase project with Firestore, Hosting and Google sign-in turned on.

1. Install the Firebase CLI (`npm install -g firebase-tools`), run `firebase login`, then link the project with `firebase use --add`.
2. Copy `.env.example` to `.env.local` and fill in your project's web app settings. `.env.local` and `.firebaserc` stay on your computer; they aren't in the repo.
3. Run the app:

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The dev server uses the same Firebase project and data as the live site.

To publish changes:

```bash
npm run deploy
```

## Project layout

| Path | What it is |
| --- | --- |
| `src/db.ts` | Data model, all writes to Firestore, backup export/import |
| `src/shelf.tsx` | Sign-in state and the live subscription to your books and lists |
| `src/firebase.ts`, `src/firebaseConfig.ts` | Firebase setup (settings come from `.env.local`) and Google sign-in |
| `src/bookQuery.ts` | Sorting and rating filters (kept in the URL) |
| `src/legacy.ts` | One-time import of books saved by the first, browser-only version |
| `src/pages/` | Library, Log/Edit book, Book detail, Lists, List detail |
| `src/components/` | Star rating, cover, book grid, sort/filter controls, list picker |
| `firestore.rules`, `firebase.json` | Database security rules and hosting config |
