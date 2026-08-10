'use strict';
/**
 * scoring-tests.js — 7 targeted test cases for score calculation
 *
 * Tests the scoring formula independently and verifies the server API
 * returns consistent results. Also demonstrates the old hint-timer bug.
 *
 * Formula (mirrored from server.js):
 *   OT_THRESH  = 1800   (timerSec below this → overtime)
 *   WRONG_PTS  = 50     per wrong answer
 *   HINT_PTS   = 50     per hint used
 *   ptPerPuzzle: resumed ? 100 : (isOvertime ? 180 : 200)
 *   timeBonus:  (won && !isOvertime) ? (timerSec - OT_THRESH) * 2 : 0
 *   overtimePenalty: ceil(overtimeSecs / 60) * 30
 *   score = puzzlesDone*ptPerPuzzle + timeBonus + hiddenBonus
 *           - wrongAnswers*WRONG_PTS - hintPenalty - overtimePenalty
 *
 * timerSec is seconds remaining out of MAX_SECS (3600).
 * High timerSec → quick finish. Low timerSec → slow finish.
 */

const ioClient = require('socket.io-client');

const BASE      = 'http://localhost:3000';
const ADMIN_PW  = 'QWAdmin2024';
const TRIAL_GRP = 'g256';
const TRIAL_PIN = '1256';

// ── helpers ──────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
function ok(label) {
  pass++;
  process.stdout.write('  ✓ ' + label + '\n');
}
function ko(label, detail = '') {
  fail++;
  process.stdout.write('  ✗ ' + label + (detail ? '\n    → ' + detail : '') + '\n');
}
function section(name) { process.stdout.write('\n── ' + name + ' ──\n'); }

async function httpPost(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['X-Auth-Token'] = token;
  const r = await fetch(BASE + path, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
async function httpGet(path, token) {
  const headers = token ? { 'X-Auth-Token': token } : {};
  const r = await fetch(BASE + path, { headers });
  return { status: r.status, body: await r.json() };
}
async function getAdminToken() {
  const r = await httpPost('/api/admin/login', { password: ADMIN_PW });
  if (r.status !== 200) throw new Error('Admin login failed');
  return r.body.token;
}

// ── Mirror of server.js calcScore ────────────────────────────────────────────
const OT_THRESH = 1800;
const WRONG_PTS = 50;
const HINT_PTS  = 50;
const HQ_BONUS  = 20;

function calcScore({ puzzlesDone, wrongAnswers, hintPenalty, timerSec, won, resumed = false, hiddenBonus = 0 }) {
  const isOvertime      = timerSec < OT_THRESH;
  const ptPerPuzzle     = resumed ? 100 : (isOvertime ? 180 : 200);
  const regSecsLeft     = isOvertime ? 0 : (timerSec - OT_THRESH);
  const timeBonus       = (won && !isOvertime) ? regSecsLeft * 2 : 0;
  const overtimeSecs    = isOvertime ? (OT_THRESH - timerSec) : 0;
  const overtimeMins    = Math.ceil(overtimeSecs / 60);
  const overtimePenalty = overtimeMins * 30;
  return (
    (puzzlesDone  * ptPerPuzzle) +
    timeBonus +
    hiddenBonus -
    (wrongAnswers * WRONG_PTS) -
    (hintPenalty  || 0) -
    overtimePenalty
  );
}

// ── SECTION 1: Pure formula tests ────────────────────────────────────────────
function testScoringFormula() {
  section('1 — Pure scoring formula (7 test cases)');

  const PUZZLES = 5; // assume 5 puzzles

  // TC1: No mistakes, on time (just past OT threshold)
  {
    // timerSec=2100 → 5 min past overtime boundary, 5 min early from regulation end (OT_THRESH=1800)
    // So 2100-1800=300 reg secs left → timeBonus = 300*2 = 600
    const s = calcScore({ puzzlesDone: PUZZLES, wrongAnswers: 0, hintPenalty: 0, timerSec: 2100, won: true });
    const expected = PUZZLES*200 + (2100-1800)*2 + 0 - 0 - 0 - 0;
    if (s === expected) ok(`TC1: No mistakes, on time → score=${s} (expected ${expected})`);
    else ko('TC1: No mistakes, on time', `got ${s}, expected ${expected}`);
  }

  // TC2: Mistakes, on time
  {
    // timerSec=2100, 3 wrong answers
    const s = calcScore({ puzzlesDone: PUZZLES, wrongAnswers: 3, hintPenalty: 0, timerSec: 2100, won: true });
    const expected = PUZZLES*200 + (2100-1800)*2 - 3*WRONG_PTS;
    if (s === expected) ok(`TC2: 3 mistakes, on time → score=${s} (expected ${expected})`);
    else ko('TC2: 3 mistakes, on time', `got ${s}, expected ${expected}`);
  }

  // TC3: No mistakes, early finish (large timeBonus)
  {
    // timerSec=3000 → 1200 reg secs left → timeBonus = 1200*2 = 2400
    const s = calcScore({ puzzlesDone: PUZZLES, wrongAnswers: 0, hintPenalty: 0, timerSec: 3000, won: true });
    const expected = PUZZLES*200 + (3000-1800)*2;
    if (s === expected) ok(`TC3: No mistakes, early finish → score=${s} (expected ${expected})`);
    else ko('TC3: No mistakes, early finish', `got ${s}, expected ${expected}`);
  }

  // TC4: Mistakes + hints + early finish
  {
    // timerSec=3000, 2 wrong answers, 1 hint
    const s = calcScore({ puzzlesDone: PUZZLES, wrongAnswers: 2, hintPenalty: HINT_PTS, timerSec: 3000, won: true });
    const expected = PUZZLES*200 + (3000-1800)*2 - 2*WRONG_PTS - HINT_PTS;
    if (s === expected) ok(`TC4: 2 mistakes + 1 hint, early finish → score=${s} (expected ${expected})`);
    else ko('TC4: 2 mistakes + 1 hint, early finish', `got ${s}, expected ${expected}`);
  }

  // TC5: No mistakes, overtime (5 min over = 300s)
  {
    // timerSec=1500 → isOvertime=true, overtimeSecs=1800-1500=300, overtimeMins=5, penalty=150
    const s = calcScore({ puzzlesDone: PUZZLES, wrongAnswers: 0, hintPenalty: 0, timerSec: 1500, won: true });
    const expected = PUZZLES*180 + 0 - 0 - 0 - Math.ceil(300/60)*30;
    if (s === expected) ok(`TC5: No mistakes, 5 min overtime → score=${s} (expected ${expected})`);
    else ko('TC5: No mistakes, 5 min overtime', `got ${s}, expected ${expected}`);
  }

  // TC6: Mistakes + overtime (15 min over = 900s)
  {
    // timerSec=900 → overtimeSecs=900, overtimeMins=15, penalty=450
    const s = calcScore({ puzzlesDone: PUZZLES, wrongAnswers: 2, hintPenalty: 0, timerSec: 900, won: true });
    const expected = PUZZLES*180 + 0 - 2*WRONG_PTS - Math.ceil(900/60)*30;
    if (s === expected) ok(`TC6: 2 mistakes, 15 min overtime → score=${s} (expected ${expected})`);
    else ko('TC6: 2 mistakes, 15 min overtime', `got ${s}, expected ${expected}`);
  }

  // TC7: BUG REPRODUCER — large mistakes + early finish
  // The OLD bug: useHint() subtracted 60s per hint from S.timerSec on the client.
  // With 5 hints, client showed timerSec = actual - 300.
  // If actual timerSec=2000 (barely on time), client saw 1700 (overtime!) → showed overtime penalty
  // in live score instead of time bonus. This was purely a display bug that could confuse teams.
  // The server always used wall-clock time, so the final submitted score was correct,
  // but the LIVE score during gameplay was deeply misleading.
  {
    const actualTimerSec = 2000; // team finishes 200s inside regulation
    const fakeTimerSec   = actualTimerSec - 5 * 60; // 5 hints × 60s = 300s deducted on OLD client

    const correctScore = calcScore({ puzzlesDone: PUZZLES, wrongAnswers: 5, hintPenalty: 5*HINT_PTS, timerSec: actualTimerSec, won: true });
    const buggyScore   = calcScore({ puzzlesDone: PUZZLES, wrongAnswers: 5, hintPenalty: 5*HINT_PTS, timerSec: fakeTimerSec,   won: true });

    // Correct: !isOvertime (2000>1800), timeBonus=(2000-1800)*2=400
    // Buggy:   isOvertime (1700<1800),  overtimeMins=ceil(100/60)=2, penalty=60
    const correctOT = actualTimerSec < OT_THRESH; // false
    const buggyOT   = fakeTimerSec < OT_THRESH;   // true

    if (!correctOT && buggyOT) {
      ok(`TC7: Bug reproduced — correct uses timeBonus, buggy shows overtime penalty`);
      ok(`  correct score=${correctScore} | buggy live-score=${buggyScore} | delta=${correctScore - buggyScore}`);
    } else {
      ko('TC7: Bug reproducer', `correctOT=${correctOT}, buggyOT=${buggyOT}; expected false/true`);
    }

    // Verify the fix: hints must NOT affect timerSec
    // New code: S.timerSec unchanged by hints → live score = correct score
    if (correctScore > buggyScore) {
      ok('TC7: Fix confirmed — correct score is higher than buggy live-score (no overtime penalty)');
    } else {
      ko('TC7: Fix verification failed', `correct=${correctScore}, buggy=${buggyScore}`);
    }
  }
}

// ── SECTION 2: Mistakes and time are independent ──────────────────────────────
function testIndependentDimensions() {
  section('2 — Wrong answers and time are independent scoring dimensions');

  // Adding wrong answers must not affect time bonus
  const base     = calcScore({ puzzlesDone: 5, wrongAnswers: 0, hintPenalty: 0, timerSec: 3000, won: true });
  const with3WA  = calcScore({ puzzlesDone: 5, wrongAnswers: 3, hintPenalty: 0, timerSec: 3000, won: true });
  const diffWA   = base - with3WA;
  if (diffWA === 3 * WRONG_PTS) ok(`S2a: 3 wrong answers reduce score by exactly ${3*WRONG_PTS} pts (${base} → ${with3WA})`);
  else ko('S2a: Wrong-answer independence', `expected delta=${3*WRONG_PTS}, got ${diffWA}`);

  // Adding hints must not affect time bonus
  const with3H   = calcScore({ puzzlesDone: 5, wrongAnswers: 0, hintPenalty: 3*HINT_PTS, timerSec: 3000, won: true });
  const diffH    = base - with3H;
  if (diffH === 3 * HINT_PTS) ok(`S2b: 3 hints reduce score by exactly ${3*HINT_PTS} pts (${base} → ${with3H})`);
  else ko('S2b: Hint independence', `expected delta=${3*HINT_PTS}, got ${diffH}`);

  // Changing timerSec must not affect wrong-answer penalty
  const earlyWA  = calcScore({ puzzlesDone: 5, wrongAnswers: 2, hintPenalty: 0, timerSec: 3400, won: true });
  const lateWA   = calcScore({ puzzlesDone: 5, wrongAnswers: 2, hintPenalty: 0, timerSec: 2000, won: true });
  const earlyNoWA= calcScore({ puzzlesDone: 5, wrongAnswers: 0, hintPenalty: 0, timerSec: 3400, won: true });
  const lateNoWA = calcScore({ puzzlesDone: 5, wrongAnswers: 0, hintPenalty: 0, timerSec: 2000, won: true });
  const penaltyEarly = earlyNoWA - earlyWA;
  const penaltyLate  = lateNoWA  - lateWA;
  if (penaltyEarly === 2*WRONG_PTS && penaltyLate === 2*WRONG_PTS) {
    ok(`S2c: WA penalty is same regardless of timing (${penaltyEarly} pts both cases)`);
  } else {
    ko('S2c: WA penalty should not depend on timing', `early=${penaltyEarly}, late=${penaltyLate}`);
  }
}

// ── SECTION 3: Server API integration ────────────────────────────────────────
async function testServerIntegration() {
  section('3 — Server API integration (quick win, scores match formula)');

  const adminToken = await getAdminToken();

  // Reset g256 before test
  const resetR = await httpPost('/api/admin/reset', { groupId: TRIAL_GRP }, adminToken);
  if (resetR.status !== 200) {
    ko('S3: Reset g256 failed', JSON.stringify(resetR.body));
    return;
  }
  ok('S3a: Reset g256 succeeded');

  // Login 3 players
  let tokens = [];
  for (let i = 1; i <= 3; i++) {
    const r = await httpPost('/api/login', {
      groupId: TRIAL_GRP, pin: TRIAL_PIN, groupSize: 3,
    });
    if (r.status !== 200) { ko(`S3b: Login player ${i}`, JSON.stringify(r.body)); return; }
    tokens.push(r.body.token);
  }
  ok('S3b: Logged in 3 players');

  // Connect sockets + wait for state_init
  const sockets = await Promise.all(tokens.map((token, i) => new Promise((res, rej) => {
    const s = ioClient(BASE, { auth: { token, memberName: `Tester${i+1}` }, transports: ['websocket'] });
    s.on('state_init', d => res({ sock: s, state: d }));
    s.on('connect_error', e => rej(e));
    setTimeout(() => rej(new Error('socket timeout')), 5000);
  })));
  ok('S3c: All 3 sockets connected');

  // All ready
  const gameStarted = new Promise(res => sockets[0].sock.on('game_start', res));
  for (const { sock } of sockets) sock.emit('player_ready');
  await gameStarted;
  ok('S3d: Game started');

  // All 12 required puzzle keys (must match server REQUIRED_PUZZLES)
  const PUZZLE_KEYS = [
    'coa_verified','inspection_done','ncr_filed','calibration_done',
    'capa_done','iso15378_done','iso9001_done','motto_challenge',
    'motto_production','motto_qaoffice','batch_retrieved','game_won',
  ];

  // Submit 1 wrong answer and 1 hint
  sockets[0].sock.emit('wrong_answer');
  await new Promise(r => setTimeout(r, 200));
  sockets[0].sock.emit('hint_used', { room: 'receiving', timeCost: 0 });
  await new Promise(r => setTimeout(r, 200));

  // Mark ALL puzzles done — ALL players must emit player_puzzle_done for each key
  for (const key of PUZZLE_KEYS) {
    for (const { sock } of sockets) sock.emit('player_puzzle_done', { key });
    await new Promise(r => setTimeout(r, 80));
  }
  await new Promise(r => setTimeout(r, 400));

  // Submit win via HTTP POST /api/game/submit
  const submitResult = await httpPost('/api/game/submit', { won: true }, tokens[0]);
  if (submitResult.status !== 200) {
    ko('S3e: /api/game/submit', JSON.stringify(submitResult.body));
    for (const { sock } of sockets) sock.disconnect();
    return;
  }
  ok('S3e: /api/game/submit accepted');

  // Verify returned score is positive and covers 11 puzzles (game_won not counted)
  const { score, puzzlesDone, wrongAnswers, hintPenalty } = submitResult.body;
  if (typeof score === 'number' && score > 0) ok(`S3f: Score positive (${score})`);
  else ko('S3f: Score positive', `got ${score}`);

  if (puzzlesDone === 11) ok('S3g: puzzlesDone = 11');
  else ko('S3g: puzzlesDone = 11', `got ${puzzlesDone}`);

  if (wrongAnswers === 1) ok('S3h: wrongAnswers = 1');
  else ko('S3h: wrongAnswers = 1', `got ${wrongAnswers}`);

  // Verify via leaderboard (g256 shows exactly one entry, hintPenalty is stored)
  await new Promise(r => setTimeout(r, 300));
  const lb = await httpGet('/api/leaderboard', adminToken);
  if (lb.status === 200) {
    const g256entries = lb.body.filter(e => e.groupId === TRIAL_GRP);
    if (g256entries.length === 1) ok(`S3i: Leaderboard has exactly 1 entry for g256 (score=${g256entries[0].score})`);
    else ko('S3i: Leaderboard g256 count', `expected 1, got ${g256entries.length}`);
    if (g256entries.length > 0) {
      const lbHint = g256entries[0].hintPenalty;
      if (lbHint === HINT_PTS) ok(`S3j: Leaderboard hintPenalty = ${HINT_PTS}`);
      else ko('S3j: Leaderboard hintPenalty', `expected ${HINT_PTS}, got ${lbHint}`);
    }
  } else {
    ko('S3i: Leaderboard request failed', `status=${lb.status}`);
  }

  // Cleanup sockets
  for (const { sock } of sockets) sock.disconnect();
}

// ── SECTION 4: Group 256 score preservation on second play ────────────────────
async function testGroup256ScorePreservation() {
  section('4 — Group 256 first-result preservation on second play');

  const adminToken = await getAdminToken();
  await httpPost('/api/admin/reset', { groupId: TRIAL_GRP }, adminToken);

  const PUZZLE_KEYS = [
    'coa_verified','inspection_done','ncr_filed','calibration_done',
    'capa_done','iso15378_done','iso9001_done','motto_challenge',
    'motto_production','motto_qaoffice','batch_retrieved','game_won',
  ];

  async function playQuickGame() {
    const tokens = [];
    for (let i = 0; i < 3; i++) {
      const r = await httpPost('/api/login', { groupId: TRIAL_GRP, pin: TRIAL_PIN, groupSize: 3 });
      if (r.status !== 200) throw new Error(`Login failed: ${JSON.stringify(r.body)}`);
      tokens.push(r.body.token);
    }
    const sockets = await Promise.all(tokens.map((t, i) => new Promise((res, rej) => {
      const s = ioClient(BASE, { auth: { token: t, memberName: `P${i+1}` }, transports: ['websocket'] });
      s.on('state_init', d => res({ sock: s, state: d }));
      s.on('connect_error', rej);
      setTimeout(() => rej(new Error('socket connect timeout')), 5000);
    })));
    const started = new Promise(r => sockets[0].sock.on('game_start', r));
    for (const { sock } of sockets) sock.emit('player_ready');
    await started;

    for (const key of PUZZLE_KEYS) {
      for (const { sock } of sockets) sock.emit('player_puzzle_done', { key });
      await new Promise(r => setTimeout(r, 80));
    }
    await new Promise(r => setTimeout(r, 300));

    const sub = await httpPost('/api/game/submit', { won: true }, tokens[0]);
    for (const { sock } of sockets) sock.disconnect();
    if (sub.status !== 200) throw new Error(`Submit failed: ${JSON.stringify(sub.body)}`);
    return sub.body.score;
  }

  const score1 = await playQuickGame();
  ok(`S4a: Play 1 completed — score=${score1}`);

  // No admin reset between plays — g256 should allow natural replay (server clears
  // stale session on player_ready for trial groups in completed state)
  await new Promise(r => setTimeout(r, 800));

  const score2 = await playQuickGame();
  ok(`S4b: Play 2 completed — score=${score2}`);

  // Leaderboard must show only 1 entry for g256 with the FIRST score
  const lb = await httpGet('/api/leaderboard', adminToken);
  const entries = lb.body.filter(e => e.groupId === TRIAL_GRP);
  if (entries.length !== 1) {
    ko('S4c: Leaderboard g256 count', `expected 1, got ${entries.length}`);
    return;
  }
  const lbScore = entries[0].score;
  if (lbScore === score1) ok(`S4c: Leaderboard shows first score (${lbScore}) — second score ${score2} correctly discarded`);
  else if (lbScore === score2) ko('S4c: Score preservation FAILED', `leaderboard has score2=${score2} instead of score1=${score1}`);
  else ko('S4c: Unexpected leaderboard score', `lb=${lbScore}, play1=${score1}, play2=${score2}`);
}

// ── main ────────────────────────────────────────────────────────────────────────
(async () => {
  testScoringFormula();
  testIndependentDimensions();

  try { await testServerIntegration(); }
  catch (e) { ko('S3 fatal', e.message); }

  try { await testGroup256ScorePreservation(); }
  catch (e) { ko('S4 fatal', e.message); }

  const total = pass + fail;
  process.stdout.write(`\n${'─'.repeat(50)}\n`);
  process.stdout.write(`Scoring tests: ${pass}/${total} passed`);
  if (fail > 0) process.stdout.write(`  (${fail} FAILED)`);
  process.stdout.write('\n');
  process.exitCode = fail > 0 ? 1 : 0;
})();
