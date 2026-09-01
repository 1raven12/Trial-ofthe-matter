'use strict';
/**
 * restore-to-render.js — push a stored backup back onto the live service.
 *
 *   GAME_URL=https://your-service.onrender.com ADMIN_PASSWORD=... \
 *     node scripts/restore-to-render.js                 # dry run, shows the diff
 *     node scripts/restore-to-render.js --yes           # actually restore
 *     node scripts/restore-to-render.js --file backups/history/groups-….json --yes
 *
 * Dry run is the default on purpose. Nothing is sent until --yes is passed.
 *
 * The server refuses a restore that would reduce the number of completed
 * results; --force overrides that, and should only ever be used deliberately.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const has  = f => argv.includes(f);
const val  = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const GAME_URL = (process.env.GAME_URL || '').replace(/\/+$/, '');
const ADMIN_PW = process.env.ADMIN_PASSWORD || '';
const FILE     = path.resolve(ROOT, val('--file') || 'backups/groups.latest.json');
const APPLY    = has('--yes');
const FORCE    = has('--force');

const log = (...a) => process.stdout.write(a.join(' ') + '\n');
const die = m => { process.stdout.write('ERROR: ' + m + '\n'); process.exit(2); };

const completed = gs => gs.filter(g => g.score !== null && g.score !== undefined).length;

(async () => {
  if (!GAME_URL) die('GAME_URL is not set.');
  if (!ADMIN_PW) die('ADMIN_PASSWORD is not set.');
  if (!fs.existsSync(FILE)) die(`no such backup: ${path.relative(ROOT, FILE)}`);

  const snapshot = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const data = snapshot.data || snapshot;
  if (!Array.isArray(data.groups) || data.groups.length !== 256) {
    die(`${path.relative(ROOT, FILE)} does not contain a 256-group roster`);
  }

  log(`backup : ${path.relative(ROOT, FILE)}`);
  log(`taken  : ${snapshot.exportedAt || 'unknown'}`);
  log(`holds  : ${data.groups.length} groups, ${completed(data.groups)} completed`);

  const login = await fetch(`${GAME_URL}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PW }),
  });
  if (!login.ok) die(`admin login failed (HTTP ${login.status})`);
  const { token } = await login.json();

  const liveRes = await fetch(`${GAME_URL}/api/admin/backup`, { headers: { 'x-auth-token': token } });
  if (!liveRes.ok) die(`could not read the live dataset (HTTP ${liveRes.status})`);
  const live = await liveRes.json();
  log(`live   : ${live.groupCount} groups, ${live.completed} completed`);

  const gain = completed(data.groups) - live.completed;
  log(`effect : ${gain >= 0 ? '+' : ''}${gain} completed games`);

  if (!APPLY) {
    log('\ndry run — nothing was sent. Re-run with --yes to restore.');
    return;
  }
  if (gain < 0 && !FORCE) {
    die(`this restore would discard ${-gain} completed games. Re-run with --force if that is intended.`);
  }

  const r = await fetch(`${GAME_URL}/api/admin/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
    body: JSON.stringify({ data, force: FORCE }),
  });
  const out = await r.json();
  if (!r.ok) die(`restore refused (HTTP ${r.status}): ${out.error || JSON.stringify(out)}`);

  log(`\nrestored ${out.restored} groups — completed ${out.completedBefore} → ${out.completedAfter}`);
  log(`the previous live file was kept at ${out.previousFile}`);
})().catch(e => die(e.message));
