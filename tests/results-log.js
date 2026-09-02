'use strict';
/**
 * results-log.js — a completed game must be recoverable even after the thing
 * that normally erases it.
 *
 *   node tests/results-log.js        (needs the server on :3000)
 *
 * groups.json keeps one row per group, so an admin reset or a trial-group
 * replay replaces what that row said. The append-only log is the record that
 * outlives both, and it travels inside the backup so GitHub holds it too.
 */

const ioClient = require('socket.io-client');
const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const BASE     = 'http://localhost:3000';
const LOG      = path.join(ROOT, 'data', 'results.log');
const ADMIN_PW = 'QWAdmin2024';
const PUZZLES = ['coa_verified','inspection_done','ncr_filed','calibration_done','capa_done',
  'iso15378_done','iso9001_done','motto_challenge','motto_production','motto_qaoffice',
  'batch_retrieved','game_won'];

let pass = 0, fail = 0;
const failures = [];
const ok = l => { pass++; process.stdout.write('  ✓ ' + l + '\n'); };
const ko = (l, d = '') => { fail++; failures.push(l + (d ? ' — ' + d : '')); process.stdout.write('  ✗ ' + l + (d ? '\n      → ' + d : '') + '\n'); };
const sec = n => process.stdout.write('\n── ' + n + ' ──\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(p, m = 'GET', b, t) {
  const h = { 'Content-Type': 'application/json', connection: 'close' };
  if (t) h['X-Auth-Token'] = t;
  const r = await fetch(BASE + p, { method: m, headers: h, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const adminTok = async () => (await api('/api/admin/login', 'POST', { password: ADMIN_PW })).body.token;

/** Play a group all the way to a submitted result. */
async function play(id, pin, mistakes = 0) {
  const toks = [];
  for (let i = 0; i < 3; i++) {
    const r = await api('/api/login', 'POST', { groupId: id, pin, groupSize: 3 });
    if (r.status !== 200 || !r.body.token) throw new Error(`${id} login: ${JSON.stringify(r.body)}`);
    toks.push(r.body.token);
  }
  const socks = await Promise.all(toks.map((t, i) => new Promise((res, rej) => {
    const s = ioClient(BASE, { auth: { token: t, memberName: 'P' + (i + 1) }, transports: ['websocket'] });
    s.on('state_init', () => res(s)); s.on('connect_error', rej);
    setTimeout(() => rej(new Error('socket timeout')), 10000);
  })));
  const started = new Promise(r => socks[0].on('game_start', r));
  socks.forEach(s => s.emit('player_ready'));
  await started;
  for (let i = 0; i < mistakes; i++) { socks[0].emit('wrong_answer'); await sleep(2100); }
  for (const k of PUZZLES) { socks.forEach(s => s.emit('player_puzzle_done', { key: k })); await sleep(70); }
  const r = await api('/api/game/submit', 'POST', { won: true }, toks[0]);
  socks.forEach(s => s.disconnect());
  await sleep(150);
  return r.body;
}

const logLines = () => fs.existsSync(LOG)
  ? fs.readFileSync(LOG, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : [];

(async () => {
  process.stdout.write(`\n${'═'.repeat(66)}\nAPPEND-ONLY RESULTS LOG\n${'═'.repeat(66)}\n`);
  const before = logLines().length;

  try {
    sec('A. a finished game is recorded');
    const r1 = await play('g60', '1060', 2);
    const l1 = logLines();
    l1.length === before + 1 ? ok('exactly one line appended') : ko('one line appended', `${before} → ${l1.length}`);
    const e1 = l1[l1.length - 1];
    e1 && e1.groupId === 'g60' ? ok('the line names the group') : ko('line names the group');
    e1.score === r1.score ? ok(`score matches what the player was shown (${e1.score})`) : ko('score matches', `${e1.score} vs ${r1.score}`);
    e1.wrongAnswers === 2 ? ok('mistakes recorded (2)') : ko('mistakes', `got ${e1.wrongAnswers}`);
    e1.completedAt && e1.timeSpentSec >= 0 ? ok('timestamp and duration recorded') : ko('timestamp/duration');
    Array.isArray(e1.roster) && e1.roster.length === 3 ? ok('the three players are named') : ko('roster recorded');
    e1.via === 'submit' ? ok('records how the game ended') : ko('via recorded');

    sec('B. an admin reset cannot erase the record');
    const t = await adminTok();
    const reset = await api('/api/admin/reset', 'POST', { groupId: 'g60' }, t);
    reset.status === 200 ? ok('g60 reset by admin') : ko('reset', `HTTP ${reset.status}`);
    const board = (await api('/api/leaderboard', 'GET', null, t)).body;
    const row = board.find(r => r.groupId === 'g60');
    row && row.played === false ? ok('the scoreboard row is cleared, as designed') : ko('row cleared');
    const l2 = logLines();
    l2.some(e => e.groupId === 'g60' && e.score === r1.score)
      ? ok(`the result is still in the log after the reset (${r1.score})`)
      : ko('result survives the reset');
    l2.length === l1.length ? ok('the log was appended to, never rewritten') : ko('log not rewritten', `${l1.length} → ${l2.length}`);

    sec('C. a replay adds a line, it does not replace one');
    const a = await play('g61', '1061');
    const t2 = await adminTok();
    await api('/api/admin/reset', 'POST', { groupId: 'g61' }, t2);
    const b = await play('g61', '1061', 1);
    const mine = logLines().filter(e => e.groupId === 'g61');
    mine.length === 2 ? ok('both plays are in the log') : ko('both plays logged', `got ${mine.length}`);
    mine[0].score === a.score && mine[1].score === b.score
      ? ok(`both scores preserved (${a.score}, then ${b.score})`)
      : ko('both scores preserved', `${mine[0].score}/${mine[1].score} vs ${a.score}/${b.score}`);

    sec('D. the log is reachable to an admin and travels in the backup');
    const t3 = await adminTok();
    const viaApi = await api('/api/admin/results-log', 'GET', null, t3);
    viaApi.status === 200 && viaApi.body.count === logLines().length
      ? ok(`admin route returns all ${viaApi.body.count} entries`)
      : ko('admin route', `HTTP ${viaApi.status}`);
    const anon = await api('/api/admin/results-log');
    anon.status === 401 ? ok('the log is not readable without an admin token') : ko('log requires auth', `HTTP ${anon.status}`);
    const backup = await api('/api/admin/backup', 'GET', null, t3);
    Array.isArray(backup.body.resultsLog) && backup.body.resultsLog.length === logLines().length
      ? ok('the backup carries the full history, so GitHub stores it too')
      : ko('backup carries the log');

  } catch (e) {
    ko('run aborted', e.message);
    process.stdout.write(e.stack + '\n');
  }

  const total = pass + fail;
  process.stdout.write(`\n${'═'.repeat(66)}\n`);
  process.stdout.write(`RESULTS LOG: ${pass}/${total} passed, ${fail} failed\n`);
  if (fail) { process.stdout.write('\nFAILURES:\n'); failures.forEach((f, i) => process.stdout.write(`  ${i + 1}. ${f}\n`)); }
  process.stdout.write(`${'═'.repeat(66)}\n`);
  process.exitCode = fail ? 1 : 0;
})();
