'use strict';
/**
 * result-durability.js — completed results must never be lost.
 *
 *   node tests/result-durability.js
 *
 * Guards the failure mode where several teams finish and only one result
 * survives. Results are persisted by reading the whole groups file, mutating
 * one group and writing the file back, so the question is whether two
 * completions landing together can clobber each other.
 *
 * They cannot, and the reason is structural: the window between load() and
 * save() in /api/game/submit contains no await, so on Node's single thread the
 * read-modify-write cannot interleave. This suite asserts that property holds
 * and that it keeps holding under real concurrent completions.
 */

const ioClient = require('socket.io-client');
const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const BASE      = 'http://localhost:3000';
const DATA_FILE = path.join(ROOT, 'data', 'groups.json');
const ADMIN_PW  = 'QWAdmin2024';
const PUZZLES = ['coa_verified','inspection_done','ncr_filed','calibration_done','capa_done',
  'iso15378_done','iso9001_done','motto_challenge','motto_production','motto_qaoffice',
  'batch_retrieved','game_won'];

let pass = 0, fail = 0;
const failures = [];
const ok  = l => { pass++; process.stdout.write('  ✓ ' + l + '\n'); };
const ko  = (l, d = '') => { fail++; failures.push({ l, d }); process.stdout.write('  ✗ ' + l + (d ? '\n      → ' + d : '') + '\n'); };
const sec = n => process.stdout.write('\n── ' + n + ' ──\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(p, m = 'GET', b, t) {
  const h = { 'Content-Type': 'application/json' };
  if (t) h['X-Auth-Token'] = t;
  const r = await fetch(BASE + p, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
}

/** Bring one group to the point where a single submit would complete it. */
async function arm(id, pin) {
  const toks = [];
  for (let i = 0; i < 3; i++) {
    const r = await api('/api/login', 'POST', { groupId: id, pin, groupSize: 3 });
    if (r.status !== 200 || !r.body.token) throw new Error(`${id} login: ${JSON.stringify(r.body)}`);
    toks.push(r.body.token);
  }
  const socks = await Promise.all(toks.map((t, i) => new Promise((res, rej) => {
    const s = ioClient(BASE, { auth: { token: t, memberName: 'P' + (i + 1) }, transports: ['websocket'] });
    s.on('state_init', () => res(s)); s.on('connect_error', rej);
    setTimeout(() => rej(new Error('socket timeout')), 8000);
  })));
  const started = new Promise(r => socks[0].on('game_start', r));
  socks.forEach(s => s.emit('player_ready'));
  await started;
  for (const k of PUZZLES) { socks.forEach(s => s.emit('player_puzzle_done', { key: k })); await sleep(60); }
  await sleep(250);
  return { id, token: toks[0], socks };
}

(async () => {
  process.stdout.write(`\n${'═'.repeat(66)}\nCOMPLETED-RESULT DURABILITY\n${'═'.repeat(66)}\n`);
  const tok = (await api('/api/admin/login', 'POST', { password: ADMIN_PW })).body.token;
  const all = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).groups;

  // ── A. the structural property that makes writes safe ────────────────────
  sec('A. persistence is atomic with respect to the event loop');
  const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const submit = srv.slice(srv.indexOf("app.post('/api/game/submit'"));
  const window = submit.slice(submit.indexOf('const data  = load()'), submit.indexOf('save(data)'));
  if (!/\bawait\b/.test(window)) ok('A1 no await between load() and save() — the read-modify-write cannot interleave');
  else ko('A1 await inside the load→save window: concurrent completions can clobber each other');

  const lb = srv.slice(srv.indexOf("app.get('/api/leaderboard'"), srv.indexOf("app.get('/api/leaderboard'") + 3400);
  if (!/LIMIT|\.slice\(0,\s*\d|\bfirst\(\)/.test(lb)) ok('A2 leaderboard applies no row limit');
  else ko('A2 leaderboard truncates rows');

  // ── B. concurrent completions ────────────────────────────────────────────
  sec('B. several teams finishing together');
  const TARGETS = ['g31', 'g32', 'g33', 'g34', 'g35', 'g36'];
  for (const id of TARGETS) await api('/api/admin/reset', 'POST', { groupId: id }, tok);
  await sleep(400);

  const armed = [];
  for (const id of TARGETS) armed.push(await arm(id, all.find(g => g.id === id).pin));
  ok(`B1 ${armed.length} groups armed at the point of completion`);

  const before = (await api('/api/leaderboard', 'GET', null, tok)).body.filter(r => r.played).length;
  const res = await Promise.all(armed.map(a => api('/api/game/submit', 'POST', { won: true }, a.token)));
  await sleep(700);
  armed.forEach(a => a.socks.forEach(s => { try { s.disconnect(); } catch {} }));

  if (res.every(r => r.status === 200)) ok('B2 every concurrent submit accepted');
  else ko('B2 a concurrent submit was rejected', res.map(r => r.status).join(','));

  const disk = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).groups;
  const persisted = TARGETS.filter(id => { const g = disk.find(x => x.id === id); return g.score !== null && g.score !== undefined; });
  if (persisted.length === TARGETS.length) ok(`B3 all ${TARGETS.length} results persisted — no lost update`);
  else ko('B3 results lost', `${persisted.length}/${TARGETS.length} survived: ${persisted.join(',')}`);

  const board = (await api('/api/leaderboard', 'GET', null, tok)).body;
  const visible = board.filter(r => TARGETS.includes(r.groupId) && r.played);
  if (visible.length === TARGETS.length) ok(`B4 all ${TARGETS.length} appear on the scoreboard together`);
  else ko('B4 missing from scoreboard', visible.map(r => r.groupId).join(','));

  const after = board.filter(r => r.played).length;
  if (after === before + TARGETS.length) ok(`B5 pre-existing results preserved (${before} → ${after}); nothing replaced`);
  else ko('B5 unrelated results changed', `expected ${before + TARGETS.length}, got ${after}`);

  // ── C. repeat submission is idempotent for 1–255 ─────────────────────────
  sec('C. repeat completion cannot duplicate or overwrite');
  const target = TARGETS[0];
  const first = board.find(r => r.groupId === target);
  await api('/api/game/submit', 'POST', { won: true }, armed[0].token);
  await sleep(300);
  const b2 = (await api('/api/leaderboard', 'GET', null, tok)).body;
  const rows = b2.filter(r => r.groupId === target);
  if (rows.length === 1 && rows[0].score === first.score)
    ok(`C1 resubmitting ${target} leaves exactly one row with its original score (${first.score})`);
  else ko('C1 resubmission changed the record', `rows=${rows.length} score=${rows[0] && rows[0].score}`);
  if (b2.filter(r => r.played).length === after) ok('C2 no other group affected by the resubmission');
  else ko('C2 other results changed');

  // ── D. durability across a refetch ───────────────────────────────────────
  sec('D. durability');
  const again = (await api('/api/leaderboard', 'GET', null, tok)).body;
  if (JSON.stringify(again.map(r => [r.groupId, r.score])) === JSON.stringify(b2.map(r => [r.groupId, r.score])))
    ok('D1 identical dataset on refetch');
  else ko('D1 dataset changed between fetches');

  const onDisk = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).groups.filter(g => g.score !== null && g.score !== undefined).length;
  if (onDisk === again.filter(r => r.played).length)
    ok(`D2 every served result is backed by the persisted file (${onDisk}) — not in-memory only`);
  else ko('D2 served results not backed by disk', `disk=${onDisk} api=${again.filter(r => r.played).length}`);

  const total = pass + fail;
  process.stdout.write(`\n${'═'.repeat(66)}\nRESULT DURABILITY: ${pass}/${total} passed, ${fail} failed\n`);
  if (fail) { process.stdout.write('\nFAILURES:\n'); failures.forEach((f, i) => process.stdout.write(`  ${i + 1}. ${f.l}\n     ${f.d}\n`)); }
  process.stdout.write(`${'═'.repeat(66)}\n`);
  process.exitCode = fail ? 1 : 0;
})();
