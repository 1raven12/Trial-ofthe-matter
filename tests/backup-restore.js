'use strict';
/**
 * backup-restore.js — proves the automated GitHub backup can never destroy
 * data, in either direction.
 *
 *   node tests/backup-restore.js
 *
 * Runs against a throwaway copy of the app on its own port and its own data
 * directory, so the real data/groups.json is never touched. The copy is
 * deliberately wiped mid-suite to reproduce the ephemeral-filesystem failure
 * that lost the original results.
 */

const { spawn, spawnSync } = require('child_process');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3997;
const BASE = `http://127.0.0.1:${PORT}`;
const PW   = 'QWAdmin2024';

let pass = 0, fail = 0;
const failures = [];
const check = (label, ok, detail = '') => {
  if (ok) { pass++; process.stdout.write(`  ✓ ${label}\n`); }
  else { fail++; failures.push(`${label} — ${detail}`); process.stdout.write(`  ✗ ${label}\n      → ${detail}\n`); }
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const completed = gs => gs.filter(g => g.score !== null && g.score !== undefined).length;

/**
 * fetch with a short retry.
 *
 * The suite shells out to the backup scripts with spawnSync, which blocks this
 * process for seconds at a time. A pooled keep-alive socket goes stale in that
 * window and the next fetch fails on a dead connection rather than on anything
 * the server did. Retrying on a transport error keeps the suite measuring the
 * product instead of the connection pool; a real refusal still returns a
 * response and is never retried.
 */
async function req(url, opts = {}) {
  let last;
  for (let i = 0; i < 3; i++) {
    try { return await fetch(url, { ...opts, headers: { connection: 'close', ...(opts.headers || {}) } }); }
    catch (e) { last = e; await sleep(200); }
  }
  throw last;
}

let dir, child;

function readLive()  { return JSON.parse(fs.readFileSync(path.join(dir, 'data', 'groups.json'), 'utf8')); }
function writeLive(d){ fs.writeFileSync(path.join(dir, 'data', 'groups.json'), JSON.stringify(d, null, 2)); }
function bkPath(...p){ return path.join(dir, 'backups', ...p); }

/** Run one of the scripts inside the sandbox copy. */
function runScript(name, args = [], env = {}) {
  const r = spawnSync('node', [path.join('scripts', name), ...args], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, GAME_URL: BASE, ADMIN_PASSWORD: PW, ...env },
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

async function adminToken() {
  const r = await req(`${BASE}/api/admin/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PW }),
  });
  return (await r.json()).token;
}

async function setup() {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-suite-'));
  for (const f of ['server.js', 'translations.js', 'index.html', 'admin.html', 'package.json']) {
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  }
  for (const d of ['data', 'seed', 'scripts', 'node_modules']) {
    fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true });
  }

  // Start from the pristine roster so the suite controls exactly how many
  // completed games exist — the repo fixture carries results of its own.
  const data = JSON.parse(fs.readFileSync(path.join(dir, 'seed', 'groups.json'), 'utf8'));
  data.groups.slice(0, 5).forEach((g, i) => {
    Object.assign(g, {
      status: 'completed', score: 3000 + i * 10, puzzlesDone: 11, won: true,
      wrongAnswers: i, hintPenalty: 50, secondsRemaining: 2000, timeSpentSec: 1600,
      completedAt: `2026-09-0${i + 1}T10:00:00.000Z`, permanentlyLocked: true,
    });
  });
  writeLive(data);

  const logFd = fs.openSync(path.join(dir, 'server.log'), 'a');
  child = spawn('node', ['server.js'], { cwd: dir, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', logFd, logFd] });
  for (let i = 0; i < 60; i++) {
    try { const r = await req(`${BASE}/`); if (r.ok) return; } catch {}
    await sleep(250);
  }
  throw new Error('sandbox server did not come up');
}

function teardown() {
  if (child) try { child.kill(); } catch {}
  if (dir) try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

(async () => {
  process.stdout.write(`\n${'═'.repeat(66)}\nBACKUP / RESTORE SAFETY\n${'═'.repeat(66)}\n`);
  try {
    await setup();

    // ── A. the backup endpoint ────────────────────────────────────────────
    process.stdout.write('\n── A. backup endpoint ──\n');
    check('A1 unauthenticated backup refused',
      (await req(`${BASE}/api/admin/backup`)).status === 401);
    check('A2 bad token refused',
      (await req(`${BASE}/api/admin/backup`, { headers: { 'x-auth-token': 'nope' } })).status === 401);

    const token = await adminToken();
    const snap  = await (await req(`${BASE}/api/admin/backup`, { headers: { 'x-auth-token': token } })).json();
    check('A3 returns the full 256-group roster', snap.data.groups.length === 256, `got ${snap.data.groups.length}`);
    check('A4 reports the completed count', snap.completed === 5, `got ${snap.completed}`);
    check('A5 the admin password is never exported',
      !('adminPassword' in snap.data) && !JSON.stringify(snap).includes(PW));
    check('A6 PINs are preserved so a restore can rebuild the roster',
      snap.data.groups.every(g => /^\d{4}$/.test(g.pin)));

    // ── B. taking a backup ────────────────────────────────────────────────
    process.stdout.write('\n── B. taking a backup ──\n');
    let r = runScript('backup-from-render.js');
    check('B1 first run succeeds', r.code === 0, r.out.trim().split('\n').pop());
    check('B2 groups.latest.json written', fs.existsSync(bkPath('groups.latest.json')));
    check('B3 a history snapshot is written', fs.readdirSync(bkPath('history')).length === 1);

    const firstHash = fs.readFileSync(bkPath('groups.latest.json'), 'utf8');
    r = runScript('backup-from-render.js');
    check('B4 an unchanged dataset writes nothing new',
      r.code === 0 && fs.readdirSync(bkPath('history')).length === 1 && r.out.includes('no change'));

    r = runScript('backup-from-render.js', [], { ADMIN_PASSWORD: 'wrong' });
    check('B5 a wrong password fails without touching the stored backup',
      r.code === 2 && fs.readFileSync(bkPath('groups.latest.json'), 'utf8') === firstHash);

    r = runScript('backup-from-render.js', [], { GAME_URL: 'http://127.0.0.1:1' });
    check('B6 an unreachable service fails without touching the stored backup',
      r.code === 2 && fs.readFileSync(bkPath('groups.latest.json'), 'utf8') === firstHash);

    // ── C. the filesystem wipe that started all this ──────────────────────
    process.stdout.write('\n── C. live results disappear ──\n');
    writeLive(JSON.parse(fs.readFileSync(path.join(dir, 'seed', 'groups.json'), 'utf8')));
    check('C1 the live service is now empty', completed(readLive().groups) === 0);

    r = runScript('backup-from-render.js');
    check('C2 the backup run fails loudly instead of succeeding quietly', r.code === 1, `exit ${r.code}`);
    check('C3 groups.latest.json was NOT overwritten',
      fs.readFileSync(bkPath('groups.latest.json'), 'utf8') === firstHash);
    check('C4 no history snapshot was added', fs.readdirSync(bkPath('history')).length === 1);
    check('C5 the rejected snapshot is quarantined for inspection',
      fs.existsSync(bkPath('quarantine')) && fs.readdirSync(bkPath('quarantine')).length === 1);

    // ── D. recovery ───────────────────────────────────────────────────────
    process.stdout.write('\n── D. recovery ──\n');
    r = runScript('restore-to-render.js');
    check('D1 restore is a dry run by default',
      r.code === 0 && r.out.includes('dry run') && completed(readLive().groups) === 0);

    r = runScript('restore-to-render.js', ['--yes']);
    check('D2 --yes restores the results', r.code === 0, r.out.trim().split('\n').pop());
    const back = readLive();
    check('D3 all 5 completed games are back', completed(back.groups) === 5, `got ${completed(back.groups)}`);
    check('D4 scores restored exactly', back.groups.slice(0, 5).every((g, i) => g.score === 3000 + i * 10));
    check('D5 timestamps restored exactly',
      back.groups[0].completedAt === '2026-09-01T10:00:00.000Z');
    check('D6 the live admin password survives the restore', back.adminPassword === PW);
    check('D7 the pre-restore file is kept aside',
      fs.readdirSync(path.join(dir, 'data')).some(f => f.startsWith('groups.pre-restore-')));

    // ── E. a restore can never quietly discard results ────────────────────
    process.stdout.write('\n── E. destructive restores refused ──\n');
    const quarantined = path.join('backups', 'quarantine', fs.readdirSync(bkPath('quarantine'))[0]);
    r = runScript('restore-to-render.js', ['--file', quarantined, '--yes']);
    check('E1 the client refuses to restore a smaller snapshot',
      r.code === 2 && completed(readLive().groups) === 5);

    const t2 = await adminToken();
    const empty = JSON.parse(fs.readFileSync(path.join(dir, quarantined), 'utf8'));
    let res = await req(`${BASE}/api/admin/restore`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': t2 },
      body: JSON.stringify({ data: empty.data }),
    });
    check('E2 the server refuses it too, with no client involved',
      res.status === 409 && completed(readLive().groups) === 5, `HTTP ${res.status}`);

    res = await req(`${BASE}/api/admin/restore`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': t2 },
      body: JSON.stringify({ data: { groups: back.groups.slice(0, 10) } }),
    });
    check('E3 a partial roster is refused', res.status === 400 && completed(readLive().groups) === 5);

    res = await req(`${BASE}/api/admin/restore`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: empty.data }),
    });
    check('E4 restore requires an admin token', res.status === 401);

    res = await req(`${BASE}/api/admin/restore`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-auth-token': t2 },
      body: JSON.stringify({ data: empty.data, force: true }),
    });
    check('E5 force:true is honoured when it is explicit',
      res.status === 200 && completed(readLive().groups) === 0, `HTTP ${res.status}`);

  } catch (e) {
    fail++; failures.push(`suite aborted: ${e.message}`);
    process.stdout.write(`\n  ✗ suite aborted: ${e.stack}\n`);
    try {
      const l = fs.readFileSync(path.join(dir, 'server.log'), 'utf8').trim().split('\n').slice(-15);
      process.stdout.write('  sandbox server log:\n' + l.map(x => '      ' + x).join('\n') + '\n');
    } catch {}
  } finally {
    teardown();
  }

  const total = pass + fail;
  process.stdout.write(`\n${'═'.repeat(66)}\n`);
  process.stdout.write(`BACKUP / RESTORE SAFETY: ${pass}/${total} passed, ${fail} failed\n`);
  if (fail) { process.stdout.write('\nFAILURES:\n'); failures.forEach((f, i) => process.stdout.write(`  ${i + 1}. ${f}\n`)); }
  process.stdout.write(`${'═'.repeat(66)}\n`);
  process.exitCode = fail ? 1 : 0;
})();
