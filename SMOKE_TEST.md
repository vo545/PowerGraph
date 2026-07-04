# PowerGraph Smoke Test

Run this checklist before pushing large UI, storage, backup, sync, or PWA changes.

## Build

```bash
npm install
npm run build
```

Expected:

- Build completes without errors.
- No frontend secret keys are added to the bundle.
- `dist/` contains `index.html`, hashed assets, `manifest.json`, and `sw.js`.

## Local Profile And Data

1. Open the app.
2. Create or log into a local profile.
3. Confirm default language is English for a new profile.
4. Add one workout with multiple sets.
5. Use **Copy previous set** in the workout form.
6. Add one meal with calories and macros.
7. Add water with a quick button.
8. Add a body-weight entry.
9. Mark and unmark a rest day.
10. Mark and unmark a cheat day.

Expected:

- Existing localStorage keys still load.
- Dashboard updates without reload.
- History/progress pages show the new entries.
- No data disappears after page refresh.

## Backup And Import

1. Export a JSON backup from Settings.
2. Confirm the filename starts with `powergraph-backup-`.
3. Import the JSON backup.
4. Confirm the import preview shows counts before overwrite.
5. Cancel once, then import again and accept.
6. Try encrypted export if browser crypto is available.

Expected:

- Export works.
- Import preview appears before replacing local data.
- Recovery snapshot is created before import.
- Existing JSON backup format remains accepted.

## Data Safety

1. Open Settings > Data & Privacy.
2. Confirm Data Health renders.
3. Confirm local recovery snapshot actions work.
4. Click clear data.
5. Cancel the first confirmation.
6. Try again and type anything except `DELETE`.
7. Try again and type `DELETE` only after exporting.

Expected:

- Clear data cannot happen accidentally.
- Typing `DELETE` is required.
- Storage warning appears if localStorage is blocked.

## Mobile PWA

1. Test at `390x844` viewport.
2. Confirm no horizontal overflow.
3. Bottom navigation remains usable.
4. Quick Actions opens and all buttons are readable.
5. Dashboard Today Control Center remains scannable.
6. Install prompt/update banner still works where supported.

## Offline / Backend Optional

1. Load the app once.
2. Go offline.
3. Refresh.
4. Add local data.
5. Reconnect if backend is configured.

Expected:

- App still opens from cache.
- Local data remains usable.
- Backend sync failure does not block local-first usage.
- Gemini/AI features fail gracefully when backend is unavailable.
