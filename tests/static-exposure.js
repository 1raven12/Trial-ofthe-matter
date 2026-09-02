'use strict';
/**
 * static-exposure.js — nothing private may be reachable over plain HTTP.
 *
 *   node tests/static-exposure.js        (needs the server on :3000)
 *
 * The site is served from the repository root, so express.static would
 * otherwise hand out data/groups.json — all 256 PINs and the admin password —
 * to anyone with the URL. This suite asserts the block holds, that the player
 * site still works, and that the authenticated routes still return the data.
 */

const BASE     = 'http://localhost:3000';
const ADMIN_PW = 'QWAdmin2024';

let pass = 0, fail = 0;
const failures = [];
const ok = l => { pass++; process.stdout.write('  ✓ ' + l + '\n'); };
const ko = (l, d = '') => { fail++; failures.push(l + (d ? ' — ' + d : '')); process.stdout.write('  ✗ ' + l + (d ? '\n      → ' + d : '') + '\n'); };
const sec = n => process.stdout.write('\n── ' + n + ' ──\n');

async function get(p, headers = {}) {
  const r = await fetch(BASE + p, { headers: { connection: 'close', ...headers } });
  const body = await r.text();
  return { status: r.status, body };
}

/** Blocked means: not 200, and the response carries none of the secrets. */
async function assertBlocked(p) {
  const r = await get(p);
  const leaks = r.status === 200 &&
    (r.body.includes(ADMIN_PW) || /"pin"\s*:/.test(r.body) || /"lockedRoster"/.test(r.body));
  if (r.status === 200 && leaks) return ko(`${p} is blocked`, 'returned 200 with secret content');
  if (r.status === 200)          return ko(`${p} is blocked`, 'returned 200');
  ok(`${p} → ${r.status}`);
}

(async () => {
  process.stdout.write(`\n${'═'.repeat(66)}\nSTATIC EXPOSURE\n${'═'.repeat(66)}\n`);

  sec('A. private paths are not served');
  for (const p of [
    '/data/groups.json', '/data/sessions.json', '/data/',
    '/seed/groups.json', '/backups/groups.latest.json',
    '/scripts/backup-from-render.js', '/tests/scoring-tests.js',
    '/.gitignore', '/.env', '/.git/config',
    '/node_modules/express/package.json',
  ]) await assertBlocked(p);

  sec('B. no credential is reachable anywhere unauthenticated');
  for (const p of ['/data/groups.json', '/seed/groups.json', '/backups/groups.latest.json']) {
    const r = await get(p);
    r.body.includes(ADMIN_PW)
      ? ko(`${p} does not leak the admin password`)
      : ok(`${p} does not leak the admin password`);
  }

  sec('C. the player site still works');
  for (const [p, needle] of [['/', '<html'], ['/index.html', '<html'], ['/admin.html', '<html'], ['/translations.js', 'TRANSLATIONS']]) {
    const r = await get(p);
    r.status === 200 && r.body.includes(needle)
      ? ok(`${p} still served`)
      : ko(`${p} still served`, `HTTP ${r.status}`);
  }

  sec('D. the API is unaffected');
  const groups = await get('/api/groups');
  let list = [];
  try { list = JSON.parse(groups.body); } catch {}
  groups.status === 200 && list.length === 256
    ? ok('/api/groups returns all 256 groups')
    : ko('/api/groups works', `HTTP ${groups.status}, ${list.length} rows`);
  !groups.body.includes('"pin"')
    ? ok('/api/groups does not expose PINs')
    : ko('/api/groups does not expose PINs');

  const login = await fetch(BASE + '/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', connection: 'close' },
    body: JSON.stringify({ password: ADMIN_PW }),
  });
  const tok = (await login.json()).token;
  tok ? ok('admin login still works') : ko('admin login still works');

  const board = await get('/api/leaderboard', { 'x-auth-token': tok });
  let rows = [];
  try { rows = JSON.parse(board.body); } catch {}
  rows.length === 256 ? ok('authenticated leaderboard still returns 256 rows') : ko('leaderboard', `${rows.length} rows`);

  const backup = await get('/api/admin/backup', { 'x-auth-token': tok });
  let snap = null;
  try { snap = JSON.parse(backup.body); } catch {}
  snap && snap.data && snap.data.groups.length === 256
    ? ok('authenticated backup route still returns the full dataset')
    : ko('backup route still works', `HTTP ${backup.status}`);

  const total = pass + fail;
  process.stdout.write(`\n${'═'.repeat(66)}\n`);
  process.stdout.write(`STATIC EXPOSURE: ${pass}/${total} passed, ${fail} failed\n`);
  if (fail) { process.stdout.write('\nFAILURES:\n'); failures.forEach((f, i) => process.stdout.write(`  ${i + 1}. ${f}\n`)); }
  process.stdout.write(`${'═'.repeat(66)}\n`);
  process.exitCode = fail ? 1 : 0;
})();
