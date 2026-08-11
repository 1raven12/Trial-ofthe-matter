'use strict';
/**
 * multiplayer-regression.js — verification only, no behaviour change.
 *
 *   node tests/multiplayer-regression.js
 *
 * Confirms the original team-size and participant-identity rules still hold
 * after this session's fixes. It asserts the product as implemented; it does
 * not propose or encode any new rule.
 *
 * Rules under verification:
 *   · a team is exactly 3, 4 or 5 players, chosen during the entry/PIN flow
 *   · that size is fixed once the game starts
 *   · a player beyond the selected size is rejected (4th of 3, 5th of 4, 6th of 5)
 *   · a roster player dropping pauses the game per the existing rule
 *   · that same participant may rejoin and the game resumes
 *   · an unrelated newcomer may not take the missing player's place
 *   · none of the above alters scoring, group or scoreboard state
 */

const ioClient = require('socket.io-client');
const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const BASE      = 'http://localhost:3000';
const DATA_FILE = path.join(ROOT, 'data', 'groups.json');
const ADMIN_PW  = 'QWAdmin2024';

let pass = 0, fail = 0;
const failures = [];
const ok  = l => { pass++; process.stdout.write('  ✓ ' + l + '\n'); };
const ko  = (l, d = '') => { fail++; failures.push({ l, d }); process.stdout.write('  ✗ ' + l + (d ? '\n      → ' + d : '') + '\n'); };
const sec = n => process.stdout.write('\n── ' + n + ' ──\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(pth, method = 'GET', body, tok) {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h['X-Auth-Token'] = tok;
  const r = await fetch(BASE + pth, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const admin = async () => (await api('/api/admin/login', 'POST', { password: ADMIN_PW })).body.token;

/** Connect a socket; resolves on state_init, rejects on a refused handshake. */
function connect(token, memberName) {
  return new Promise((resolve, reject) => {
    const s = ioClient(BASE, { auth: { token, memberName }, transports: ['websocket'], reconnection: false });
    s.on('state_init', () => resolve(s));
    s.on('connect_error', e => reject(new Error(e.message)));
    setTimeout(() => reject(new Error('state_init timeout')), 8000);
  });
}

/** Verify one team size end to end. */
async function verifySize(size, group, tok) {
  sec(`team size ${size} — ${group.id}`);
  const socks = [];
  try {
    await api('/api/admin/reset', 'POST', { groupId: group.id }, tok);
    await sleep(250);

    // ── selection preserved: exactly `size` players may enter ──────────────
    const tokens = [];
    for (let i = 0; i < size; i++) {
      const r = await api('/api/login', 'POST', { groupId: group.id, pin: group.pin, groupSize: size });
      if (r.status === 200 && r.body.token) tokens.push(r.body.token);
      else { ko(`${size}p: player ${i + 1} could not join`, JSON.stringify(r.body)); return; }
    }
    ok(`${size}p: all ${size} selected players joined`);

    const stored = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).groups.find(g => g.id === group.id);
    if (stored.requiredSize === size) ok(`${size}p: selected size recorded as ${size}`);
    else ko(`${size}p: size not recorded`, `requiredSize=${stored.requiredSize}`);

    // One beyond the selected size must not get a seat. The seat is taken when a
    // player actually joins, not when a token is issued, so the check below is
    // made where the product enforces it — at the connection.
    const extra = await api('/api/login', 'POST', { groupId: group.id, pin: group.pin, groupSize: size });
    const extraToken = extra.status === 200 ? extra.body.token : null;

    // a different size for the same group is refused
    const wrongSize = await api('/api/login', 'POST', { groupId: group.id, pin: group.pin, groupSize: size === 5 ? 3 : size + 1 });
    if (wrongSize.status === 400 && /size_mismatch/.test(wrongSize.body.code || '')) {
      ok(`${size}p: a different team size is refused once ${size} is set`);
    } else ko(`${size}p: size mismatch not refused`, JSON.stringify(wrongSize.body));

    // ── start the game with exactly the selected roster ────────────────────
    const names = Array.from({ length: size }, (_, i) => `P${i + 1}`);
    for (let i = 0; i < size; i++) socks.push(await connect(tokens[i], names[i]));

    // with the selected team seated, player size+1 must be turned away
    if (extraToken) {
      let refused = false, why = '';
      try { socks.push(await connect(extraToken, `P${size + 1}`)); }
      catch (e) { refused = true; why = e.message; }
      if (refused) ok(`${size}p: player ${size + 1} refused a seat (${why.slice(0, 46)})`);
      else ko(`${size}p: player ${size + 1} joined beyond the selected size`);
    } else {
      ok(`${size}p: player ${size + 1} refused at login`);
    }

    const started = new Promise(r => socks[0].on('game_start', r));
    socks.forEach(s => s.emit('player_ready'));
    await Promise.race([started, sleep(15000)]);

    const live = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).groups.find(g => g.id === group.id);
    if (live.status === 'playing') ok(`${size}p: game started with the selected roster`);
    else { ko(`${size}p: game did not start`, `status=${live.status}`); return; }

    // ── size stays fixed after start ───────────────────────────────────────
    const afterStart = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).groups.find(g => g.id === group.id);
    if (afterStart.requiredSize === size) ok(`${size}p: team size still ${size} after start`);
    else ko(`${size}p: team size changed after start`, `requiredSize=${afterStart.requiredSize}`);

    // ── a newcomer cannot enter a running game ─────────────────────────────
    let newcomerRejected = false, newcomerErr = '';
    try {
      const s = await connect(tokens[0], 'Interloper');   // valid token, unknown name
      socks.push(s);
    } catch (e) { newcomerRejected = true; newcomerErr = e.message; }
    if (newcomerRejected) ok(`${size}p: newcomer refused mid-game (${newcomerErr.slice(0, 48)})`);
    else ko(`${size}p: newcomer admitted mid-game`);

    // ── a roster player drops: the game pauses ─────────────────────────────
    const paused = new Promise(r => socks[1].on('game_paused', r));
    socks[0].disconnect();
    const pausedEvt = await Promise.race([paused, sleep(8000).then(() => null)]);
    if (pausedEvt) ok(`${size}p: game paused when a roster player dropped`);
    else ko(`${size}p: no pause on roster player drop`);

    // remaining players cannot finish without the missing teammate
    const submit = await api('/api/game/submit', 'POST', { won: true }, tokens[1]);
    if (submit.status === 400 && /paused/i.test(submit.body.error || '')) {
      ok(`${size}p: remaining players cannot complete while a teammate is missing`);
    } else ko(`${size}p: completion allowed while paused`, `status=${submit.status} ${JSON.stringify(submit.body)}`);

    // ── a stranger may not take the missing player's place ─────────────────
    let standInRejected = false;
    try {
      const s = await connect(tokens[1], 'StandIn');
      socks.push(s);
    } catch { standInRejected = true; }
    if (standInRejected) ok(`${size}p: an unrelated participant cannot replace the missing player`);
    else ko(`${size}p: stranger took the missing player's place`);

    // ── the same participant returns and play resumes ──────────────────────
    const resumed = new Promise(r => socks[1].on('game_resumed', r));
    const back = await connect(tokens[0], names[0]);      // same token, same name
    socks.push(back);
    const resumedEvt = await Promise.race([resumed, sleep(8000).then(() => null)]);
    if (resumedEvt) ok(`${size}p: the same participant rejoined and the game resumed`);
    else ko(`${size}p: game did not resume after the original player returned`);

    const afterResume = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).groups.find(g => g.id === group.id);
    if (afterResume.requiredSize === size && afterResume.status === 'playing')
      ok(`${size}p: team size still ${size} and game playing after resume`);
    else ko(`${size}p: state drifted after resume`, `size=${afterResume.requiredSize} status=${afterResume.status}`);

    // ── reload by an existing participant keeps their identity ─────────────
    const reload = await connect(tokens[1], names[1]);    // same token+name again
    socks.push(reload);
    await sleep(400);
    const stillPlaying = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).groups.find(g => g.id === group.id);
    if (stillPlaying.status === 'playing') ok(`${size}p: reload by an existing participant keeps the game running`);
    else ko(`${size}p: reload disrupted the game`, `status=${stillPlaying.status}`);

  } catch (e) {
    ko(`${size}p: threw`, (e && e.message ? e.message : String(e)).split('\n')[0]);
  } finally {
    for (const s of socks) { try { s.disconnect(); } catch {} }
    await sleep(400);
    await api('/api/admin/reset', 'POST', { groupId: group.id }, tok).catch(() => {});
  }
}

(async () => {
  process.stdout.write(`\n${'═'.repeat(66)}\nMULTIPLAYER RULE REGRESSION — verification only\n${'═'.repeat(66)}\n`);
  const tok  = await admin();
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  // ── entry-flow rules that bound team size ────────────────────────────────
  sec('team-size selection bounds');
  const g = data.groups.find(x => x.id === 'g60');
  await api('/api/admin/reset', 'POST', { groupId: g.id }, tok);
  for (const bad of [1, 2, 6, 7, 0, -1]) {
    const r = await api('/api/login', 'POST', { groupId: g.id, pin: g.pin, groupSize: bad });
    if (r.status === 400) ok(`size ${bad} refused`);
    else ko(`size ${bad} accepted`, `status=${r.status}`);
  }
  for (const good of [3, 4, 5]) {
    await api('/api/admin/reset', 'POST', { groupId: g.id }, tok);
    await sleep(150);
    const r = await api('/api/login', 'POST', { groupId: g.id, pin: g.pin, groupSize: good });
    if (r.status === 200 && r.body.token) ok(`size ${good} accepted`);
    else ko(`size ${good} refused`, JSON.stringify(r.body));
  }
  await api('/api/admin/reset', 'POST', { groupId: g.id }, tok);

  // ── credential rules unchanged ───────────────────────────────────────────
  sec('credential rules');
  const g2 = data.groups.find(x => x.id === 'g61');
  const badPin = await api('/api/login', 'POST', { groupId: g2.id, pin: '0000', groupSize: 3 });
  if (badPin.status === 401) ok('invalid PIN refused');
  else ko('invalid PIN accepted', `status=${badPin.status}`);

  const other = data.groups.find(x => x.id === 'g62');
  const crossPin = await api('/api/login', 'POST', { groupId: g2.id, pin: other.pin, groupSize: 3 });
  if (crossPin.status === 401) ok("another group's PIN refused");
  else ko("another group's PIN accepted", `status=${crossPin.status}`);

  const noGroup = await api('/api/login', 'POST', { groupId: 'g999', pin: '1234', groupSize: 3 });
  if (noGroup.status === 401 || noGroup.status === 404) ok('unknown group refused');
  else ko('unknown group accepted', `status=${noGroup.status}`);

  const stale = await api('/api/game/submit', 'POST', { won: true }, 'stale-token-value');
  if (stale.status === 401) ok('stale session refused');
  else ko('stale session accepted', `status=${stale.status}`);

  // ── the three supported team sizes ───────────────────────────────────────
  const groups = { 3: data.groups.find(x => x.id === 'g70'),
                   4: data.groups.find(x => x.id === 'g71'),
                   5: data.groups.find(x => x.id === 'g72') };
  for (const size of [3, 4, 5]) await verifySize(size, groups[size], tok);

  // ── unrelated subsystems untouched ───────────────────────────────────────
  sec('scoring / group / scoreboard untouched');
  const board = (await api('/api/leaderboard', 'GET', null, tok)).body;
  if (Array.isArray(board) && board.length === 256) ok('scoreboard still represents all 256 groups');
  else ko('scoreboard shape changed', `length=${board && board.length}`);

  const groupsApi = (await api('/api/groups')).body;
  if (groupsApi.length === 256 && groupsApi.filter(x => x.trialGroup).length === 1)
    ok('256 groups, exactly one trial group');
  else ko('group configuration changed', `n=${groupsApi.length}`);

  const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const constants = { REG_SECS: '30 * 60', MAX_SECS: '60 * 60', WRONG_PTS: '50', HINT_PTS: '50', HQ_BONUS: '20' };
  const drift = Object.entries(constants).filter(([k, v]) => !new RegExp(`const ${k}\\s*=\\s*${v.replace(/[*]/g, '\\*')}`).test(srv));
  if (!drift.length) ok('scoring constants unchanged (REG_SECS, MAX_SECS, WRONG_PTS, HINT_PTS, HQ_BONUS)');
  else ko('scoring constants drifted', drift.map(d => d[0]).join(', '));

  if (/\[3, 4, 5\]\.includes\(size\)/.test(srv)) ok('team-size rule still exactly [3, 4, 5] in the entry flow');
  else ko('team-size rule changed in the entry flow');

  const total = pass + fail;
  process.stdout.write(`\n${'═'.repeat(66)}\nMULTIPLAYER REGRESSION: ${pass}/${total} passed, ${fail} failed\n`);
  if (fail) { process.stdout.write('\nFAILURES:\n'); failures.forEach((f, i) => process.stdout.write(`  ${i + 1}. ${f.l}\n     ${f.d}\n`)); }
  process.stdout.write(`${'═'.repeat(66)}\n`);
  process.exitCode = fail ? 1 : 0;
})();
