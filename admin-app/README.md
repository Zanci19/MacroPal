# MacroPal Firebase Admin Console

This is a standalone admin UI for editing MacroPal Firestore data. It lets you
load a user by UID and update profile data, meals, and any document under
`users/{uid}`.

## Setup

1. Open `admin-app/app.js` and replace `REPLACE_WITH_FIREBASE_API_KEY` with the
   same Firebase API key used by the main app.
2. Serve this folder with any static server (e.g. `npx serve admin-app`).

## Usage

- **Login (UID)**: enter the user UID you want to edit.
- **Profile**: edits the root document at `users/{uid}`.
- **Meals**: edits a daily meals document at `users/{uid}/foods/{dateKey}`.
- **Custom document**: supply any document path under `users/{uid}` such as
  `workouts/2024-02-09` or `mealPresets/abc123`.

Saving replaces the entire document at the chosen path.
