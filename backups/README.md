# Automatic backups of the live results

Every 30 minutes a GitHub Action pulls the dataset off the running Render
service and commits it here, so a completed game is never held in only one
place.

| Path | What it is |
|---|---|
| `groups.latest.json` | the newest good snapshot — this is what a restore uses |
| `history/groups-<timestamp>.json` | one file per change, never rewritten |
| `quarantine/<timestamp>.json` | a snapshot that was **rejected** because results had disappeared |

Snapshots contain the full 256-group roster with every result and every PIN.
They never contain the admin password.

## One-time setup

Add two repository secrets under **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `GAME_URL` | `https://<your-service>.onrender.com` |
| `ADMIN_PASSWORD` | the admin password the live service accepts |

That is all. The workflow (`.github/workflows/backup-live-results.yml`) runs on
a schedule and can also be started by hand from the **Actions** tab.

## When the backup job fails

A failure is not noise — it is the alarm. The job fails on purpose when the
live service reports **fewer** completed games than the stored snapshot, which
means results have disappeared from the live filesystem. In that case:

* `groups.latest.json` is **not** overwritten — the good copy is safe;
* the rejected snapshot is written to `quarantine/` so you can see what the
  service was serving;
* the run is marked failed so GitHub notifies you.

## Restoring

Preview first — this sends nothing:

```bash
GAME_URL=https://<your-service>.onrender.com ADMIN_PASSWORD=… \
  node scripts/restore-to-render.js
```

Then apply it:

```bash
GAME_URL=… ADMIN_PASSWORD=… node scripts/restore-to-render.js --yes
```

To restore an older snapshot, add `--file backups/history/groups-<timestamp>.json`.

A restore that would *reduce* the number of completed games is refused by both
the script and the server; `--force` overrides that and should only be used
deliberately. Before overwriting anything the server copies the current live
file to `data/groups.pre-restore-<epoch>.json`, so a mistaken restore is always
reversible from the Render shell.

## Guarantees under test

`node tests/backup-restore.js` (29 checks, part of the global audit) starts a
throwaway copy of the app, wipes it mid-run to reproduce the original data
loss, and asserts that the backup refuses to overwrite good data, that the
quarantine is written, that a restore brings back every score and timestamp
exactly, and that a destructive restore is refused at both the client and the
server.
