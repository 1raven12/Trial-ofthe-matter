'use strict';
/**
 * backup-from-render.js — pull the live dataset off the running service and
 * store it in the repository.
 *
 *   GAME_URL=https://your-service.onrender.com \
 *   ADMIN_PASSWORD=... \
 *   node scripts/backup-from-render.js
 *
 * Writes:
 *   backups/groups.latest.json          the newest good snapshot
 *   backups/history/groups-<stamp>.json one file per change, never rewritten
 *   backups/quarantine/<stamp>.json     a rejected snapshot, kept for inspection
 *
 * Safety rule that matters more than anything else here: a backup that
 * blindly overwrites is worse than no backup. If the live service comes back
 * with FEWER completed results than the stored snapshot, that is the symptom
 * of a wiped filesystem, not of progress. The new snapshot is quarantined,
 * groups.latest.json is left untouched and the process exits non-zero so the
 * scheduled job fails loudly instead of silently destroying the good copy.
 *
 * Exit codes
 *   0  snapshot stored, or nothing changed
 *   1  the live dataset regressed — quarantined, latest untouched
 *   2  the service could not be reached or answered with something unusable
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const DIR        = path.join(ROOT, 'backups');
const LATEST     = path.join(DIR, 'groups.latest.json');
const HISTORY    = path.join(DIR, 'history');
const QUARANTINE = path.join(DIR, 'quarantine');

const GAME_URL = (process.env.GAME_URL || '').replace(/\/+$/, '');
const ADMIN_PW = process.env.ADMIN_PASSWORD || '';

// Render puts idle free instances to sleep; a cold start can take a minute.
const ATTEMPTS   = 5;
const BACKOFF_MS = [2000, 4000, 8000, 16000];
const TIMEOUT_MS = 90000;

const log  = (...a) => process.stdout.write(a.join(' ') + '\n');
const fail = (code, msg) => { process.stdout.write('ERROR: ' + msg + '\n'); process.exit(code); };

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function request(url, opts = {}) {
  const ctl = new AbortController();
  const t   = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...opts, signal: ctl.signal }); }
  finally { clearTimeout(t); }
}

/** Run fn with backoff. Only network/5xx faults are retried. */
async function withRetry(label, fn) {
  let last;
  for (let i = 0; i < ATTEMPTS; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      if (e.fatal) throw e;
      if (i < ATTEMPTS - 1) {
        const wait = BACKOFF_MS[Math.min(i, BACKOFF_MS.length - 1)];
        log(`  ${label} failed (${e.message}) — retrying in ${wait / 1000}s`);
        await sleep(wait);
      }
    }
  }
  throw last;
}

async function login() {
  return withRetry('login', async () => {
    const r = await request(`${GAME_URL}/api/admin/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: ADMIN_PW }),
    });
    if (r.status === 401) {
      const e = new Error('admin password rejected by the live service');
      e.fatal = true;                       // retrying a bad password is pointless
      throw e;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (!j.token) throw new Error('no token in the login response');
    return j.token;
  });
}

async function fetchBackup(token) {
  return withRetry('backup', async () => {
    const r = await request(`${GAME_URL}/api/admin/backup`, { headers: { 'x-auth-token': token } });
    if (r.status === 404) {
      const e = new Error('the live service has no /api/admin/backup route — deploy the current server.js first');
      e.fatal = true;
      throw e;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

function countCompleted(groups) {
  return groups.filter(g => g.score !== null && g.score !== undefined).length;
}

/** Stable comparison that ignores the export timestamp. */
function fingerprint(snapshot) {
  return JSON.stringify(snapshot.data);
}

(async () => {
  if (!GAME_URL) fail(2, 'GAME_URL is not set. Point it at the live service, e.g. https://your-service.onrender.com');
  if (!ADMIN_PW) fail(2, 'ADMIN_PASSWORD is not set. Store it as a repository secret, never in the workflow file.');

  log(`Backing up ${GAME_URL}`);

  let snapshot;
  try {
    const token = await login();
    snapshot = await fetchBackup(token);
  } catch (e) {
    fail(2, `could not read the live dataset: ${e.message}`);
  }

  // ── validate before anything is written ──────────────────────────────────
  if (!snapshot || !snapshot.data || !Array.isArray(snapshot.data.groups)) {
    fail(2, 'the response was not a recognisable backup payload');
  }
  const groups = snapshot.data.groups;
  if (groups.length !== 256) {
    fail(2, `expected 256 groups, the service returned ${groups.length} — refusing to store a partial roster`);
  }

  const fresh = countCompleted(groups);
  log(`  live dataset: ${groups.length} groups, ${fresh} completed`);

  fs.mkdirSync(HISTORY, { recursive: true });

  // ── regression guard ─────────────────────────────────────────────────────
  let previous = null;
  if (fs.existsSync(LATEST)) {
    try { previous = JSON.parse(fs.readFileSync(LATEST, 'utf8')); }
    catch { log('  stored snapshot is unreadable — treating this run as the first backup'); }
  }

  if (previous && Array.isArray(previous.data && previous.data.groups)) {
    const stored = countCompleted(previous.data.groups);
    log(`  stored snapshot: ${stored} completed (${previous.exportedAt})`);

    if (fresh < stored) {
      fs.mkdirSync(QUARANTINE, { recursive: true });
      const q = path.join(QUARANTINE, `${snapshot.exportedAt.replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(q, JSON.stringify(snapshot, null, 2));
      process.stdout.write(
        `\nERROR: the live service reports ${fresh} completed games but the stored backup has ${stored}.\n` +
        `Results have disappeared from the live filesystem. groups.latest.json was NOT overwritten.\n` +
        `The rejected snapshot is at ${path.relative(ROOT, q)} for inspection.\n` +
        `Restore with: node scripts/restore-to-render.js --dry-run\n`);
      process.exit(1);
    }

    if (fingerprint(previous) === fingerprint(snapshot)) {
      log('  no change since the last backup — nothing written');
      process.exit(0);
    }
  }

  // ── store ────────────────────────────────────────────────────────────────
  const body  = JSON.stringify(snapshot, null, 2);
  const stamp = snapshot.exportedAt.replace(/[:.]/g, '-');
  const hist  = path.join(HISTORY, `groups-${stamp}.json`);

  fs.writeFileSync(hist, body);       // history is append-only, never rewritten
  fs.writeFileSync(LATEST, body);

  log(`  wrote ${path.relative(ROOT, LATEST)}`);
  log(`  wrote ${path.relative(ROOT, hist)}`);
  process.exit(0);
})();
