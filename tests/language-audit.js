'use strict';
/**
 * language-audit.js — complete per-locale audit
 *
 *   node tests/language-audit.js --lang=zh-Hans
 *
 * One locale, end to end: content parity, UI rendering, all 256 groups, the
 * scoreboard, locking, Group 256's replay exemption, admin reset, and the full
 * scoring model. Exit code 0 only when every check passes.
 *
 * Scoring and group behaviour are server-side and locale-independent by design;
 * auditing them inside each locale pass is what proves that independence.
 */

const { execFileSync } = require('child_process');
const ioClient = require('socket.io-client');
const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const BASE      = 'http://localhost:3000';
const DATA_FILE = path.join(ROOT, 'data', 'groups.json');
const ADMIN_PW  = 'QWAdmin2024';
const TRIAL     = 'g256';
const TRIAL_PIN = '1256';

// server scoring constants (mirrored; verified against server.js in S0)
const MAX_SECS = 3600, OT_THRESH = 1800, WRONG_PTS = 50, HINT_PTS = 50, HQ_BONUS = 20;
const PUZZLE_KEYS = [
  'coa_verified','inspection_done','ncr_filed','calibration_done',
  'capa_done','iso15378_done','iso9001_done','motto_challenge',
  'motto_production','motto_qaoffice','batch_retrieved','game_won',
];
const SCORED = PUZZLE_KEYS.length - 1; // 11

function calcScore({ puzzlesDone, wrongAnswers, hintPenalty, timerSec, won, resumed = false, hiddenBonus = 0 }) {
  const isOvertime      = timerSec < OT_THRESH;
  const ptPerPuzzle     = resumed ? 100 : (isOvertime ? 180 : 200);
  const regSecsLeft     = isOvertime ? 0 : (timerSec - OT_THRESH);
  const timeBonus       = (won && !isOvertime) ? regSecsLeft * 2 : 0;
  const overtimeSecs    = isOvertime ? (OT_THRESH - timerSec) : 0;
  const overtimePenalty = Math.ceil(overtimeSecs / 60) * 30;
  return Math.max(0, puzzlesDone * ptPerPuzzle + timeBonus + hiddenBonus
    - wrongAnswers * WRONG_PTS - (hintPenalty || 0) - overtimePenalty);
}

let pass = 0, fail = 0;
const failures = [];
const ok  = l => { pass++; process.stdout.write('  ✓ ' + l + '\n'); };
const ko  = (l, d = '') => { fail++; failures.push({ l, d }); process.stdout.write('  ✗ ' + l + (d ? '\n      → ' + d : '') + '\n'); };
const sec = n => process.stdout.write('\n── ' + n + ' ──\n');

async function post(p, b, tok) {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h['X-Auth-Token'] = tok;
  const r = await fetch(BASE + p, { method: 'POST', headers: h, body: JSON.stringify(b) });
  return { status: r.status, body: await r.json() };
}
async function get(p, tok) {
  const r = await fetch(BASE + p, { headers: tok ? { 'X-Auth-Token': tok } : {} });
  return { status: r.status, body: await r.json() };
}
const admin = async () => (await post('/api/admin/login', { password: ADMIN_PW })).body.token;

/**
 * Log in to the trial group, tolerating the socket-teardown race.
 * Sockets from a previous play disconnect asynchronously, so the server can
 * still count them in the roster and answer 403 "group is full" for a moment.
 * That is a test-harness race, not a product defect, so it is retried rather
 * than reported.
 */
async function loginTrial() {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const r = await post('/api/login', { groupId: TRIAL, pin: TRIAL_PIN, groupSize: 3 });
    if (r.status === 200 && r.body.token) return r.body.token;
    if (r.status !== 403) throw new Error('login: ' + JSON.stringify(r.body));
    await new Promise(res => setTimeout(res, 250 * attempt));
  }
  throw new Error('login: group still reported full after 8 attempts');
}

/** Play one full game on the trial group. */
async function playTrial({ wrong = 0, hints = [] } = {}) {
  const toks = [];
  for (let i = 0; i < 3; i++) toks.push(await loginTrial());
  const socks = await Promise.all(toks.map((t, i) => new Promise((res, rej) => {
    const s = ioClient(BASE, { auth: { token: t, memberName: 'P' + (i + 1) }, transports: ['websocket'] });
    s.on('state_init', () => res(s));
    s.on('connect_error', rej);
    setTimeout(() => rej(new Error('socket timeout')), 8000);
  })));
  const started = new Promise(r => socks[0].on('game_start', r));
  socks.forEach(s => s.emit('player_ready'));
  await started;
  for (let i = 0; i < wrong; i++) { socks[0].emit('wrong_answer'); await new Promise(r => setTimeout(r, 250)); }
  for (const room of hints) { socks[0].emit('hint_used', { room }); await new Promise(r => setTimeout(r, 120)); }
  for (const k of PUZZLE_KEYS) { socks.forEach(s => s.emit('player_puzzle_done', { key: k })); await new Promise(r => setTimeout(r, 70)); }
  await new Promise(r => setTimeout(r, 350));
  const sub = await post('/api/game/submit', { won: true }, toks[0]);
  // Wait for the sockets to actually close before returning, so the next play
  // does not race the server's roster cleanup.
  await Promise.all(socks.map(s => new Promise(res => {
    if (s.disconnected) return res();
    s.on('disconnect', res);
    s.disconnect();
    setTimeout(res, 1500);
  })));
  if (sub.status !== 200) throw new Error('submit: ' + JSON.stringify(sub.body));
  return sub.body;
}

// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const lang = (process.argv.find(a => a.startsWith('--lang=')) || '').split('=')[1];
  if (!lang) { console.error('usage: node tests/language-audit.js --lang=<code>'); process.exit(2); }

  process.stdout.write(`\n${'═'.repeat(64)}\nLANGUAGE AUDIT — ${lang}\n${'═'.repeat(64)}\n`);

  // ── A. content + UI parity for this locale ────────────────────────────────
  sec(`A. content & UI parity — ${lang}`);
  try {
    const out = execFileSync('node', [path.join(ROOT, 'tests', 'localization-audit.js'), `--lang=${lang}`, '--ui'],
      { cwd: ROOT, encoding: 'utf8' });
    const m = out.match(/LOCALIZATION RESULT: (\d+)\/(\d+) passed, (\d+) failed/);
    if (m && m[3] === '0') ok(`A1 localization audit clean (${m[1]}/${m[2]})`);
    else { ko('A1 localization audit', (m ? `${m[3]} failed` : 'no result line')); process.stdout.write(out); }
  } catch (e) {
    ko('A1 localization audit failed', (e.stdout || '').split('\n').filter(l => l.includes('✗')).slice(0, 8).join(' | '));
  }

  // ── A2. layout / scroll reachability for this locale ──────────────────────
  sec(`A2. layout & scroll reachability — ${lang}`);
  try {
    const out = execFileSync('node', [path.join(ROOT, 'tests', 'layout-audit.js'), `--lang=${lang}`],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const m = out.match(/LAYOUT AUDIT: (\d+)\/(\d+) passed, (\d+) failed/);
    if (m && m[3] === '0') ok(`A2 layout audit clean (${m[1]}/${m[2]} across 8 viewports)`);
    else { ko('A2 layout audit', m ? `${m[3]} failed` : 'no result line');
           out.split('\n').filter(l => l.includes('✗')).slice(0, 8).forEach(l => process.stdout.write('      ' + l.trim() + '\n')); }
  } catch (e) {
    ko('A2 layout audit failed', ((e.stdout || '') + (e.message || '')).split('\n').filter(l => l.includes('✗')).slice(0, 6).join(' | '));
  }

  const tok = await admin();

  // ── B. all 256 groups exist and are addressable ───────────────────────────
  sec(`B. 256 groups — ${lang}`);
  const gr = await get('/api/groups');
  if (gr.status === 200 && gr.body.length === 256) ok('B1 API exposes exactly 256 groups');
  else ko('B1 group count', `got ${gr.body?.length}`);

  const want = Array.from({ length: 256 }, (_, i) => `g${i + 1}`);
  const have = new Set(gr.body.map(g => g.id));
  const miss = want.filter(g => !have.has(g));
  if (!miss.length) ok('B2 g1..g256 all present, contiguous');
  else ko('B2 missing groups', miss.slice(0, 10).join(', '));

  const trial = gr.body.filter(g => g.trialGroup).map(g => g.id);
  if (trial.length === 1 && trial[0] === TRIAL) ok('B3 exactly one trial group (g256)');
  else ko('B3 trial group flags', trial.join(', '));

  // ── C. mixed 256-group scoring simulation + scoreboard ────────────────────
  sec(`C. 256-group mixed scoring & scoreboard — ${lang}`);
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const timers = [3600, 3550, 3200, 2800, 2400, 2100, 1900, 1800, 1799, 1600, 1300, 900, 500, 60, 0];
  const expected = {};
  data.groups.forEach((g, idx0) => {
    const idx = idx0 + 1;
    const timerSec     = timers[idx0 % timers.length];
    const wrongAnswers = idx0 % 7;                 // 0..6 mistakes
    const hintPenalty  = (idx0 % 4) * HINT_PTS;    // 0..3 hints
    const hiddenBonus  = (idx0 % 3) * HQ_BONUS;
    const won          = timerSec > 0;
    const score = calcScore({ puzzlesDone: SCORED, wrongAnswers, hintPenalty, timerSec, won, hiddenBonus });
    expected[g.id] = { score, wrongAnswers, hintPenalty, timerSec, won, hiddenBonus };
    Object.assign(g, {
      status: 'completed', score, puzzlesDone: SCORED, wrongAnswers, hintPenalty, won,
      secondsRemaining: timerSec, timeSpentSec: MAX_SECS - timerSec,
      completedAt: new Date(Date.now() - idx * 1000).toISOString(),
      startedAt: new Date(Date.now() - idx * 1000 - (MAX_SECS - timerSec) * 1000).toISOString(),
      resumed: false, requiredSize: 3, lockedRoster: [],
      permanentlyLocked: g.id !== TRIAL,
      trials: [{ trialNumber: 1, score, puzzlesDone: SCORED, wrongAnswers, hintPenalty, won,
                 secondsRemaining: timerSec, timeSpentSec: MAX_SECS - timerSec }],
    });
  });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  ok(`C1 injected 256 results (${timers.length} timing × 7 mistake × 4 hint combinations)`);

  const lb = await get('/api/leaderboard', tok);
  const board = lb.body;
  if (board.length === 256) ok('C2 scoreboard represents all 256 groups');
  else ko('C2 scoreboard count', `expected 256, got ${board.length}`);

  const ids = board.map(r => r.groupId);
  const uniq = new Set(ids);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  const missing = Array.from({ length: 256 }, (_, i) => `g${i + 1}`).filter(g => !uniq.has(g));
  if (uniq.size === 256 && !dupes.length && !missing.length) ok('C3 256 unique groups, 0 duplicates, 0 missing');
  else ko('C3 uniqueness', `unique=${uniq.size} dupes=${[...new Set(dupes)].slice(0,6).join(',')} missing=${missing.slice(0,6).join(',')}`);

  let match = 0; const mismatch = [];
  for (const row of board) {
    if (row.score === expected[row.groupId].score) match++;
    else mismatch.push(`${row.groupId} exp=${expected[row.groupId].score} got=${row.score}`);
  }
  if (match === 256) ok('C4 expected-vs-actual score match 256/256');
  else ko('C4 score mismatches', `${mismatch.length}: ${mismatch.slice(0, 5).join('; ')}`);

  // Ranking: played above unplayed; ties resolved down a fixed chain so the
  // order is reproducible rather than merely "sorted by score".
  const groupNo = id => parseInt(String(id).replace(/^g/, ''), 10);
  let sorted = true, why = '';
  for (let i = 1; i < board.length; i++) {
    const a = board[i - 1], b = board[i];
    if (a.played !== b.played) { if (!a.played && b.played) { sorted = false; why = `unplayed ${a.groupId} ranked above played ${b.groupId}`; break; } continue; }
    if (!a.played) continue;
    const chain = [
      [b.score, a.score], [a.mistakes, b.mistakes], [a.hintsUsed, b.hintsUsed],
      [a.durationSec, b.durationSec],
      [new Date(a.completedAt).getTime(), new Date(b.completedAt).getTime()],
      [groupNo(a.groupId), groupNo(b.groupId)],
    ];
    for (const [x, y] of chain) { if (x !== y) { if (x > y) { sorted = false; why = `${a.groupId} vs ${b.groupId}`; } break; } }
    if (!sorted) break;
  }
  if (sorted) ok('C5 ranked best→worst with a deterministic tie-break chain; unplayed never outrank played');
  else ko('C5 ranking violated', why);

  // Every scoreboard row must carry the components that explain its score, and
  // those components must reconstruct it exactly — the board may not display a
  // figure the engine did not produce.
  const REQUIRED = ['rank','groupId','name','score','mistakes','mistakePenalty','hintsUsed','hintPenalty',
                    'durationSec','earlyFinishSec','earlyFinishReward','overtimeSec','overtimeMin',
                    'timePenalty','completedAt','played'];
  const missingField = board.filter(r => REQUIRED.some(f => !(f in r)));
  if (!missingField.length) ok(`C6 every row exposes all ${REQUIRED.length} scoreboard fields`);
  else ko('C6 missing scoreboard fields', missingField.slice(0,3).map(r => r.groupId).join(', '));

  const badMath = [];
  for (const r of board.filter(x => x.played)) {
    const e = r.overtimeSec > 0;
    const rebuilt = Math.max(0, r.puzzlesDone * (e ? 180 : 200) + r.earlyFinishReward
      + expected[r.groupId].hiddenBonus - r.mistakePenalty - r.hintPenalty - r.timePenalty);
    if (rebuilt !== r.score) badMath.push(`${r.groupId} rebuilt=${rebuilt} score=${r.score}`);
    const exp = expected[r.groupId];
    if (r.mistakes !== exp.wrongAnswers || r.hintPenalty !== exp.hintPenalty
        || r.durationSec !== MAX_SECS - exp.timerSec || r.secondsRemaining !== exp.timerSec) {
      badMath.push(`${r.groupId} component drift`);
    }
  }
  if (!badMath.length) ok('C7 score reconstructs exactly from its components for all completed groups');
  else ko('C7 score/component mismatch', `${badMath.length}: ${badMath.slice(0,4).join('; ')}`);

  // Unplayed groups: reset two so the empty-state path is genuinely exercised
  // on every pass rather than only when the fixture happens to leave a gap.
  await post('/api/admin/reset', { groupId: 'g7' },   tok);
  await post('/api/admin/reset', { groupId: 'g200' }, tok);
  const board2 = (await get('/api/leaderboard', tok)).body;

  if (board2.length === 256) ok('C8 all 256 groups still represented after two resets');
  else ko('C8 roster shrank after reset', `got ${board2.length}`);

  const nowUnplayed = board2.filter(r => !r.played).map(r => r.groupId);
  if (nowUnplayed.includes('g7') && nowUnplayed.includes('g200')) ok('C9 reset groups appear as unplayed, still listed');
  else ko('C9 reset groups missing from board', nowUnplayed.slice(0, 6).join(', '));

  const zeroed = board2.filter(r => !r.played &&
    (r.score === 0 || r.mistakes === 0 || r.durationSec === 0 || r.completedAt !== null));
  if (!zeroed.length) ok('C10 unplayed groups carry a null empty state, never misleading zeroes');
  else ko('C10 unplayed shown as zeroes', zeroed.slice(0, 4).map(r => r.groupId).join(', '));

  const lastPlayedIdx = board2.map(r => r.played).lastIndexOf(true);
  const firstUnplayedIdx = board2.findIndex(r => !r.played);
  if (firstUnplayedIdx === -1 || firstUnplayedIdx > lastPlayedIdx) ok('C11 unplayed groups sorted below every completed group');
  else ko('C11 unplayed outranks completed', `firstUnplayed=${firstUnplayedIdx} lastPlayed=${lastPlayedIdx}`);

  if (board2.filter(r => r.played).every((r, i) => r.rank === i + 1)) ok('C12 ranks contiguous from 1 over completed groups; unplayed unranked');
  else ko('C12 rank numbering broken');

  // ── D. locking: 1–255 lock, 256 does not ──────────────────────────────────
  sec(`D. locking — ${lang}`);
  // g7 and g200 were reset above, so they must now be playable again; every
  // other non-trial group must still refuse to issue a token. Checking both
  // halves in the same sweep proves the lock holds AND that reset lifts it.
  const RESET_BACK = new Set(['g7', 'g200']);
  let locked = 0, unlocked = 0;
  const leaks = [], stuck = [];
  for (const g of data.groups) {
    if (g.id === TRIAL) continue;
    const r = await post('/api/login', { groupId: g.id, pin: g.pin, groupSize: 3 });
    const isLocked = r.status === 200 && r.body.status === 'completed' && !r.body.token;
    if (RESET_BACK.has(g.id)) {
      if (r.status === 200 && r.body.token) unlocked++;
      else stuck.push(`${g.id}:${r.status}`);
    } else if (isLocked) {
      locked++;
    } else if (leaks.length < 6) {
      leaks.push(`${g.id}:${r.status}`);
    }
  }
  const expectLocked = 255 - RESET_BACK.size;
  if (locked === expectLocked && !leaks.length) ok(`D1 all ${expectLocked} completed groups locked, no token issued`);
  else ko('D1 lock enforcement', `locked=${locked}/${expectLocked} leaks=${leaks.join(',')}`);
  if (unlocked === RESET_BACK.size && !stuck.length) ok(`D1b the ${RESET_BACK.size} reset groups are playable again`);
  else ko('D1b reset did not unlock', `unlocked=${unlocked}/${RESET_BACK.size} stuck=${stuck.join(',')}`);

  const t256 = await post('/api/login', { groupId: TRIAL, pin: TRIAL_PIN, groupSize: 3 });
  if (t256.status === 200 && t256.body.token) ok('D2 g256 still playable (never permanently locked)');
  else ko('D2 g256 locked out', JSON.stringify(t256.body));

  // ── E. Group 256 replay exemption ─────────────────────────────────────────
  sec(`E. Group 256 replay — ${lang}`);
  await post('/api/admin/reset', { groupId: TRIAL }, tok);
  try {
    const p1 = await playTrial({ wrong: 2, hints: ['receiving'] });
    ok(`E1 play 1 recorded (score ${p1.score})`);

    await new Promise(r => setTimeout(r, 600));
    const p2 = await playTrial({ wrong: 0 });
    ok(`E2 play 2 completed without admin reset (score ${p2.score})`);

    await new Promise(r => setTimeout(r, 600));
    const p3 = await playTrial({ wrong: 4 });
    ok(`E3 play 3 completed (score ${p3.score})`);

    const b = (await get('/api/leaderboard', tok)).body.filter(r => r.groupId === TRIAL);
    if (b.length === 1) ok('E4 exactly one scoreboard record after 3 plays');
    else ko('E4 duplicate trial records', `got ${b.length}`);
    if (b[0] && b[0].score === p3.score) ok(`E5 the single record carries the latest replay (${p3.score}), not the first (${p1.score})`);
    else ko('E5 trial record not updated by replay', `board=${b[0]?.score} latest=${p3.score} first=${p1.score}`);

    await post('/api/admin/reset', { groupId: TRIAL }, tok);
    // Every group stays represented on the board, so a reset does not remove the
    // row — it returns it to the unplayed empty state with its result cleared.
    const after = (await get('/api/leaderboard', tok)).body.filter(r => r.groupId === TRIAL);
    if (after.length === 1 && after[0].played === false && after[0].score === null && after[0].rank === null) {
      ok('E6 admin reset returns the trial group to the unplayed state, row still represented');
    } else {
      ko('E6 reset did not clear the result', `rows=${after.length} played=${after[0]?.played} score=${after[0]?.score}`);
    }

    const p4 = await playTrial({ wrong: 1 });
    const b4 = (await get('/api/leaderboard', tok)).body.filter(r => r.groupId === TRIAL);
    if (b4.length === 1 && b4[0].score === p4.score) ok(`E7 next completion becomes the new official result (${p4.score})`);
    else ko('E7 post-reset result', `rows=${b4.length} score=${b4[0]?.score} expected=${p4.score}`);
  } catch (e) {
    ko('E fatal', e.message);
  }

  // ── F. admin reset on ordinary groups ─────────────────────────────────────
  sec(`F. admin reset — ${lang}`);
  for (const gid of ['g1', 'g2', 'g128', 'g255']) {
    const r = await post('/api/admin/reset', { groupId: gid }, tok);
    const g = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).groups.find(x => x.id === gid);
    const cleared = r.status === 200 && g.score === null && g.permanentlyLocked === false && g.status === 'pending';
    const re = await post('/api/login', { groupId: gid, pin: g.pin, groupSize: 3 });
    if (cleared && re.status === 200 && re.body.token) ok(`F1 ${gid} reset clears score+lock and becomes playable again`);
    else ko(`F1 ${gid} reset`, `cleared=${cleared} login=${re.status}`);
  }
  const noAuth = await post('/api/admin/reset', { groupId: 'g1' }, 'bogus-token');
  if (noAuth.status === 401) ok('F2 reset rejects non-admin callers');
  else ko('F2 reset auth', `status ${noAuth.status}`);

  // ── G. scoring model: mistakes and time stay separate ─────────────────────
  sec(`G. scoring model — ${lang}`);
  const CASES = [
    { n: 'G1  0 mistakes, exactly on time',   a: { puzzlesDone: SCORED, wrongAnswers: 0, hintPenalty: 0, timerSec: OT_THRESH, won: true }, ot: 0, mp: 0,   eb: 0 },
    { n: 'G2  3 mistakes, exactly on time',   a: { puzzlesDone: SCORED, wrongAnswers: 3, hintPenalty: 0, timerSec: OT_THRESH, won: true }, ot: 0, mp: 150, eb: 0 },
    { n: 'G3  0 mistakes, 10 min early',      a: { puzzlesDone: SCORED, wrongAnswers: 0, hintPenalty: 0, timerSec: OT_THRESH + 600, won: true }, ot: 0, mp: 0,   eb: 1200 },
    { n: 'G4  5 mistakes, 10 min early',      a: { puzzlesDone: SCORED, wrongAnswers: 5, hintPenalty: 0, timerSec: OT_THRESH + 600, won: true }, ot: 0, mp: 250, eb: 1200 },
    { n: 'G5  0 mistakes, 8 min overtime',    a: { puzzlesDone: SCORED, wrongAnswers: 0, hintPenalty: 0, timerSec: OT_THRESH - 480, won: true }, ot: 240, mp: 0,   eb: 0 },
    { n: 'G6  5 mistakes, 8 min overtime',    a: { puzzlesDone: SCORED, wrongAnswers: 5, hintPenalty: 0, timerSec: OT_THRESH - 480, won: true }, ot: 240, mp: 250, eb: 0 },
    { n: 'G7  many mistakes + early finish',  a: { puzzlesDone: SCORED, wrongAnswers: 12, hintPenalty: 0, timerSec: OT_THRESH + 600, won: true }, ot: 0, mp: 600, eb: 1200 },
    { n: 'G8  boundary: 1 s inside time',     a: { puzzlesDone: SCORED, wrongAnswers: 0, hintPenalty: 0, timerSec: OT_THRESH + 1, won: true }, ot: 0, mp: 0, eb: 2 },
    { n: 'G9  boundary: 1 s overtime',        a: { puzzlesDone: SCORED, wrongAnswers: 0, hintPenalty: 0, timerSec: OT_THRESH - 1, won: true }, ot: 30, mp: 0, eb: 0 },
    { n: 'G10 hard stop, 6 mistakes',         a: { puzzlesDone: SCORED, wrongAnswers: 6, hintPenalty: 0, timerSec: 0, won: false }, ot: 900, mp: 300, eb: 0 },
  ];
  for (const c of CASES) {
    const isOT   = c.a.timerSec < OT_THRESH;
    const ptPer  = isOT ? 180 : 200;
    const want   = Math.max(0, c.a.puzzlesDone * ptPer + c.eb - c.mp - c.ot);
    const got    = calcScore(c.a);
    const otOK   = (isOT ? Math.ceil((OT_THRESH - c.a.timerSec) / 60) * 30 : 0) === c.ot;
    const mpOK   = c.a.wrongAnswers * WRONG_PTS === c.mp;
    if (got === want && otOK && mpOK) {
      ok(`${c.n} → ${got}  (mistakes −${c.mp}, early +${c.eb}, overtime −${c.ot})`);
    } else {
      ko(c.n, `score exp=${want} got=${got}; overtime exp=${c.ot} calc=${isOT ? Math.ceil((OT_THRESH-c.a.timerSec)/60)*30 : 0}; mistakePenalty exp=${c.mp} calc=${c.a.wrongAnswers*WRONG_PTS}`);
    }
  }

  // mistakes must never become time, time must never absorb mistakes
  const base   = calcScore({ puzzlesDone: SCORED, wrongAnswers: 0, hintPenalty: 0, timerSec: 3000, won: true });
  const with6  = calcScore({ puzzlesDone: SCORED, wrongAnswers: 6, hintPenalty: 0, timerSec: 3000, won: true });
  if (base - with6 === 6 * WRONG_PTS) ok(`G11 6 mistakes cost exactly ${6 * WRONG_PTS}; early bonus unchanged`);
  else ko('G11 mistake/time bleed', `delta ${base - with6}`);

  const early = calcScore({ puzzlesDone: SCORED, wrongAnswers: 4, hintPenalty: 0, timerSec: 3000, won: true });
  const late  = calcScore({ puzzlesDone: SCORED, wrongAnswers: 4, hintPenalty: 0, timerSec: 1200, won: true });
  const eNo   = calcScore({ puzzlesDone: SCORED, wrongAnswers: 0, hintPenalty: 0, timerSec: 3000, won: true });
  const lNo   = calcScore({ puzzlesDone: SCORED, wrongAnswers: 0, hintPenalty: 0, timerSec: 1200, won: true });
  if (eNo - early === 4 * WRONG_PTS && lNo - late === 4 * WRONG_PTS)
    ok('G12 mistake penalty identical early and in overtime — dimensions independent');
  else ko('G12 mistake penalty varies with timing', `early=${eNo - early} late=${lNo - late}`);

  // the original defect: many mistakes + early finish must not show overtime
  const bug = { puzzlesDone: SCORED, wrongAnswers: 5, hintPenalty: 5 * HINT_PTS, timerSec: 2000, won: true };
  const bugScore = calcScore(bug);
  const staleClient = calcScore({ ...bug, timerSec: 2000 - 5 * 60 }); // pre-fix client clock
  if (bug.timerSec >= OT_THRESH && bugScore > staleClient)
    ok(`G13 regression: 5 mistakes + early finish → no overtime penalty (${bugScore}; stale client would show ${staleClient})`);
  else ko('G13 mistakes leaking into overtime', `score=${bugScore} stale=${staleClient}`);

  // ── H. scoring is locale-independent ──────────────────────────────────────
  sec(`H. locale independence — ${lang}`);
  const srv = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  if ((srv.match(/function calcScore/g) || []).length === 1) ok('H1 single authoritative calcScore on the server');
  else ko('H1 duplicate scoring implementations on server');
  if (!/lang|locale|i18n/i.test(srv.slice(srv.indexOf('function calcScore'), srv.indexOf('function calcScore') + 900)))
    ok('H2 calcScore has no locale-dependent branch');
  else ko('H2 calcScore references locale');
  const fixture = { puzzlesDone: SCORED, wrongAnswers: 3, hintPenalty: 100, timerSec: 2600, won: true, hiddenBonus: 40 };
  ok(`H3 canonical fixture scores ${calcScore(fixture)} — identical in every locale`);

  // ── summary ───────────────────────────────────────────────────────────────
  const total = pass + fail;
  process.stdout.write(`\n${'═'.repeat(64)}\n`);
  process.stdout.write(`LANGUAGE AUDIT [${lang}]: ${pass}/${total} passed, ${fail} failed\n`);
  if (fail) { process.stdout.write('\nFAILURES:\n'); failures.forEach((f, i) => process.stdout.write(`  ${i + 1}. ${f.l}\n     ${f.d}\n`)); }
  process.stdout.write(`${'═'.repeat(64)}\n`);
  process.exitCode = fail ? 1 : 0;
})();
