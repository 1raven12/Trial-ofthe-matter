'use strict';
/**
 * scoreboard-global-audit.js — verification only, no behaviour change.
 *
 *   node tests/scoreboard-global-audit.js
 *
 * Proves that the 256 groups are single global identities, that one global
 * scoreboard ranks them by performance alone, and that language plays no part
 * in identity, ranking, partitioning or visibility.
 *
 * Language is deliberately NOT stored by the product. The group record has no
 * language field and neither /api/login nor /api/leaderboard reads one, so a
 * locale cannot create a second identity for a group. The audit asserts that
 * absence rather than adding a field, which would be a feature change.
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const BASE      = 'http://localhost:3000';
const CHROMIUM  = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const DATA_FILE = path.join(ROOT, 'data', 'groups.json');
const ADMIN_PW  = 'QWAdmin2024';
const SERVER_JS = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const LANGS = Object.keys(
  new Function(fs.readFileSync(path.join(ROOT, 'translations.js'), 'utf8') + '; return TRANSLATIONS;')());

const MAX_SECS = 3600, OT_THRESH = 1800, WRONG_PTS = 50, HINT_PTS = 50;

let pass = 0, fail = 0;
const failures = [];
const ok  = l => { pass++; process.stdout.write('  ✓ ' + l + '\n'); };
const ko  = (l, d = '') => { fail++; failures.push({ l, d }); process.stdout.write('  ✗ ' + l + (d ? '\n      → ' + d : '') + '\n'); };
const sec = n => process.stdout.write('\n── ' + n + ' ──\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(pth, method = 'GET', body, tok, extraHeaders = {}) {
  const h = Object.assign({ 'Content-Type': 'application/json' }, extraHeaders);
  if (tok) h['X-Auth-Token'] = tok;
  const r = await fetch(BASE + pth, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const admin = async () => (await api('/api/admin/login', 'POST', { password: ADMIN_PW })).body.token;
const groupNo = id => parseInt(String(id).replace(/^g/, ''), 10);

/**
 * Controlled dataset: every group completes, scores deliberately anti-correlated
 * with group number, and a nominal language assigned round-robin across all 17
 * locales so results from every language coexist on the one board.
 */
const REQUIRED_EXAMPLE = { g11: 9620, g50: 9410, g3: 9180, g207: 8950 };

function buildDataset() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const meta = {};
  data.groups.forEach((g, i) => {
    const n = groupNo(g.id);
    const lang = LANGS[(n - 1) % LANGS.length];          // mixed languages
    // scores deliberately unrelated to group number; the four required groups
    // take the top four places
    const score = REQUIRED_EXAMPLE[g.id] !== undefined
      ? REQUIRED_EXAMPLE[g.id]
      : 1000 + ((n * 37) % 79) * 90;                      // 1000 … 8020
    const mistakes    = (n * 3) % 7;
    const hintsUsed   = (n * 5) % 4;
    const timerSec    = [3400, 3000, 2400, 1900, 1800, 1500, 900, 300][n % 8];
    const isOT        = timerSec < OT_THRESH;
    meta[g.id] = { lang, score, mistakes, hintsUsed, timerSec };
    Object.assign(g, {
      status: 'completed', score, puzzlesDone: 11, won: timerSec > 0,
      wrongAnswers: mistakes, hintPenalty: hintsUsed * HINT_PTS,
      secondsRemaining: timerSec, timeSpentSec: MAX_SECS - timerSec,
      completedAt: new Date(Date.now() - n * 1000).toISOString(),
      startedAt: new Date(Date.now() - n * 1000 - (MAX_SECS - timerSec) * 1000).toISOString(),
      resumed: false, requiredSize: 3, lockedRoster: [],
      permanentlyLocked: g.id !== 'g256',
      trials: [{ trialNumber: 1, score }],
    });
  });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  return meta;
}

(async () => {
  process.stdout.write(`\n${'═'.repeat(68)}\nGLOBAL 256-GROUP SCOREBOARD VERIFICATION\n${'═'.repeat(68)}\n`);
  const tok = await admin();

  // ── A. language is not part of group identity ────────────────────────────
  sec('A. language is not part of group identity');
  const sample = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).groups[0];
  const langFields = Object.keys(sample).filter(k => /lang|locale/i.test(k));
  if (!langFields.length) ok('A1 group record carries no language/locale field — a locale cannot form a second identity');
  else ko('A1 group record has a language field', langFields.join(', '));

  const loginSig = SERVER_JS.match(/app\.post\('\/api\/login'[\s\S]{0,220}/)[0];
  if (/const \{ groupId, pin, groupSize \} = req\.body/.test(loginSig) && !/lang/i.test(loginSig))
    ok('A2 /api/login accepts only groupId, pin, groupSize — no language input');
  else ko('A2 /api/login reads a language input', loginSig.slice(0, 120));

  const lbHandler = SERVER_JS.slice(SERVER_JS.indexOf("app.get('/api/leaderboard'"),
                                    SERVER_JS.indexOf("app.get('/api/leaderboard'") + 3400);
  if (!/req\.query|req\.headers\[|accept-language|locale|\blang\b/i.test(lbHandler))
    ok('A3 /api/leaderboard reads no language, locale or query input');
  else ko('A3 leaderboard handler reads locale input');

  // ── B. build the controlled mixed dataset ────────────────────────────────
  sec('B. controlled dataset — 256 groups, mixed languages, mixed scores');
  const meta = buildDataset();
  const usedLangs = [...new Set(Object.values(meta).map(m => m.lang))];
  ok(`B1 injected 256 results across ${usedLangs.length} nominal languages: ${usedLangs.join(', ')}`);

  const gr = await api('/api/groups');
  if (gr.body.length === 256) ok('B2 /api/groups exposes exactly 256 global groups');
  else ko('B2 group count', `got ${gr.body.length}`);

  const board = (await api('/api/leaderboard', 'GET', null, tok)).body;
  const ids = board.map(r => r.groupId);
  const uniq = new Set(ids);
  const want = Array.from({ length: 256 }, (_, i) => `g${i + 1}`);
  const missing = want.filter(g => !uniq.has(g));
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  if (board.length === 256) ok('B3 scoreboard represents exactly 256 rows'); else ko('B3 row count', `${board.length}`);
  if (uniq.size === 256) ok('B4 256 unique group IDs'); else ko('B4 unique IDs', `${uniq.size}`);
  if (!missing.length) ok('B5 missing group IDs: 0'); else ko('B5 missing', missing.slice(0, 8).join(','));
  if (!dupes.length) ok('B6 duplicate group IDs: 0'); else ko('B6 duplicates', [...new Set(dupes)].slice(0, 8).join(','));

  // ── C. ranking is by performance ─────────────────────────────────────────
  sec('C. ranking — best final score to worst');
  const played = board.filter(r => r.played);
  let sorted = true, why = '';
  for (let i = 1; i < played.length; i++) {
    if (played[i].score > played[i - 1].score) { sorted = false; why = `${played[i].groupId}(${played[i].score}) above ${played[i-1].groupId}(${played[i-1].score})`; break; }
  }
  if (sorted) ok(`C1 all ${played.length} completed groups sorted highest score → lowest`);
  else ko('C1 sort order violated', why);

  const top4 = played.slice(0, 4).map(r => `${r.groupId}:${r.score}`);
  const expect4 = ['g11:9620', 'g50:9410', 'g3:9180', 'g207:8950'];
  if (JSON.stringify(top4) === JSON.stringify(expect4)) {
    ok(`C2 required ranking example exact: 1 ${top4[0]} · 2 ${top4[1]} · 3 ${top4[2]} · 4 ${top4[3]}`);
  } else ko('C2 required ranking example', `got ${top4.join(' , ')}`);

  if (played.every((r, i) => r.rank === i + 1)) ok('C3 ranks contiguous from 1 over completed groups');
  else ko('C3 rank numbering broken');

  // group number must not drive rank: a high-numbered group outranks a low one
  const idxHigh = played.findIndex(r => r.groupId === 'g207');
  const idxLow  = played.findIndex(r => r.groupId === 'g1');
  if (idxHigh >= 0 && idxLow >= 0 && idxHigh < idxLow)
    ok(`C4 group number does not drive rank — g207 (rank ${idxHigh + 1}) outranks g1 (rank ${idxLow + 1})`);
  else ko('C4 group number appears to drive rank', `g207 idx=${idxHigh} g1 idx=${idxLow}`);

  const asNumeric = played.map(r => groupNo(r.groupId));
  const isNumericOrder = asNumeric.every((v, i) => i === 0 || asNumeric[i - 1] <= v);
  if (!isNumericOrder) ok('C5 board is not merely ordered by group number');
  else ko('C5 board is ordered by group number rather than score');

  // ── D. components belong to the right group ──────────────────────────────
  sec('D. per-group data integrity and parity');
  const bad = [];
  for (const r of played) {
    const m = meta[r.groupId];
    if (r.score !== m.score || r.mistakes !== m.mistakes || r.hintsUsed !== m.hintsUsed
        || r.secondsRemaining !== m.timerSec || r.durationSec !== MAX_SECS - m.timerSec
        || r.mistakePenalty !== m.mistakes * WRONG_PTS || r.hintPenalty !== m.hintsUsed * HINT_PTS) {
      bad.push(r.groupId);
    }
  }
  if (!bad.length) ok(`D1 all ${played.length} rows carry their own score, mistakes, hints, duration and penalties`);
  else ko('D1 statistics mixed between groups', bad.slice(0, 6).join(', '));

  const disk = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).groups;
  const drift = played.filter(r => {
    const g = disk.find(x => x.id === r.groupId);
    return g.score !== r.score || g.wrongAnswers !== r.mistakes || (g.hintPenalty || 0) !== r.hintPenalty
        || g.timeSpentSec !== r.durationSec;
  });
  if (!drift.length) ok('D2 persisted == API for score, mistakes, hints and duration on every completed row');
  else ko('D2 persisted/API drift', drift.slice(0, 5).map(r => r.groupId).join(', '));

  // ── E. language cannot partition, hide or reorder ────────────────────────
  sec('E. language independence of the dataset');
  const canonical = JSON.stringify(board.map(r => [r.groupId, r.score, r.rank]));
  let langStable = true;
  for (const l of ['de', 'zh-CN', 'pt-BR', 'he', 'ta', 'en-US']) {
    const b2 = (await api('/api/leaderboard', 'GET', null, tok, { 'Accept-Language': l })).body;
    if (JSON.stringify(b2.map(r => [r.groupId, r.score, r.rank])) !== canonical) { langStable = false; ko(`E1 dataset changed under Accept-Language: ${l}`); break; }
  }
  if (langStable) ok('E1 identical dataset and ordering under six Accept-Language headers');

  const refetch = (await api('/api/leaderboard', 'GET', null, tok)).body;
  if (JSON.stringify(refetch.map(r => [r.groupId, r.score, r.rank])) === canonical)
    ok('E2 repeat fetch returns an identical, deterministic ordering (ties stable)');
  else ko('E2 ordering changed between identical fetches');

  // ── F. unplayed groups ───────────────────────────────────────────────────
  sec('F. unplayed groups');
  await api('/api/admin/reset', 'POST', { groupId: 'g99' }, tok);
  await api('/api/admin/reset', 'POST', { groupId: 'g150' }, tok);
  const b3 = (await api('/api/leaderboard', 'GET', null, tok)).body;
  if (b3.length === 256) ok('F1 all 256 still represented after two resets'); else ko('F1 roster shrank', `${b3.length}`);
  const unplayed = b3.filter(r => !r.played);
  const fake = unplayed.filter(r => r.score !== null || r.mistakes !== null || r.durationSec !== null || r.completedAt !== null);
  if (unplayed.length && !fake.length) ok(`F2 ${unplayed.length} unplayed rows carry null metrics — no invented statistics`);
  else ko('F2 unplayed rows carry invented data', fake.slice(0, 4).map(r => r.groupId).join(', '));
  const lastPlayed = b3.map(r => r.played).lastIndexOf(true);
  const firstUnplayed = b3.findIndex(r => !r.played);
  if (firstUnplayed === -1 || firstUnplayed > lastPlayed) ok('F3 unplayed groups rank below every completed group');
  else ko('F3 an unplayed group outranks a completed one');
  if (unplayed.every(r => r.rank === null)) ok('F4 unplayed groups are unranked'); else ko('F4 unplayed group has a rank');

  // ── G. one official result; language cannot bypass the lock ──────────────
  sec('G. one official result per group 1–255');
  const g17 = disk.find(x => x.id === 'g17');
  const before = (await api('/api/leaderboard', 'GET', null, tok)).body.filter(r => r.groupId === 'g17');
  if (before.length === 1) ok(`G1 g17 has exactly one official row (score ${before[0].score})`);
  else ko('G1 g17 row count', `${before.length}`);

  // there is no language parameter to vary, so vary everything a client could
  // send and confirm the lock holds and no second row appears
  let bypass = false;
  for (const sz of [3, 4, 5]) {
    const r = await api('/api/login', 'POST', { groupId: 'g17', pin: g17.pin, groupSize: sz },
                        null, { 'Accept-Language': 'de,zh-Hans;q=0.9' });
    if (r.status === 200 && r.body.token) bypass = true;
  }
  if (!bypass) ok('G2 completed g17 issues no token under any locale header or team size — lock is on the global identity');
  else ko('G2 lock bypassed');

  const after17 = (await api('/api/leaderboard', 'GET', null, tok)).body.filter(r => r.groupId === 'g17');
  if (after17.length === 1 && after17[0].score === before[0].score)
    ok('G3 still exactly one g17 row, unchanged score — no per-language duplicate created');
  else ko('G3 g17 duplicated or altered', `rows=${after17.length}`);

  const allSingle = (await api('/api/leaderboard', 'GET', null, tok)).body;
  const counts = {};
  allSingle.forEach(r => { counts[r.groupId] = (counts[r.groupId] || 0) + 1; });
  const multi = Object.entries(counts).filter(([, c]) => c > 1);
  if (!multi.length) ok('G4 no group has more than one scoreboard row (all 256 checked)');
  else ko('G4 duplicate rows', multi.slice(0, 5).map(([g, c]) => `${g}×${c}`).join(', '));

  // ── H. group 256 ─────────────────────────────────────────────────────────
  sec('H. group 256');
  const g256rows = allSingle.filter(r => r.groupId === 'g256');
  if (g256rows.length === 1) ok('H1 g256 occupies exactly one scoreboard row'); else ko('H1 g256 rows', `${g256rows.length}`);
  const g256 = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).groups.find(x => x.id === 'g256');
  if (g256.permanentlyLocked === false) ok('H2 g256 is not permanently locked — remains replayable');
  else ko('H2 g256 locked');
  const g256login = await api('/api/login', 'POST', { groupId: 'g256', pin: g256.pin, groupSize: 3 },
                              null, { 'Accept-Language': 'zh-Hans' });
  if (g256login.status === 200 && g256login.body.token) ok('H3 g256 admits a new game under a different locale header');
  else ko('H3 g256 refused', JSON.stringify(g256login.body));

  // ── I. UI shows the same global board in every locale ────────────────────
  sec('I. rendered scoreboard is the same dataset in every UI language');
  const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  try {
    // admin board
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForSelector('#admin-pw', { timeout: 15000 });
    await p.fill('#admin-pw', ADMIN_PW);
    await p.click('#admin-login-btn');
    await p.waitForSelector('#admin-panel.show', { timeout: 15000 });
    await p.waitForTimeout(2500);
    const adminRows = await p.evaluate(() => [...document.querySelectorAll('#lb-body tr')]
      .map(r => (r.querySelector('.name-cell')?.textContent || '').trim().replace(/TRIAL.*/, '').trim()));
    if (adminRows.length === 256) ok(`I1 admin scoreboard renders all 256 rows`);
    else ko('I1 admin row count', `${adminRows.length}`);
    for (const n of [1, 2, 10, 50, 100, 128, 200, 254, 255, 256]) {
      const r = await p.evaluate(num => {
        const row = [...document.querySelectorAll('#lb-body tr')]
          .find(t => new RegExp('^Group ' + num + '(\\D|$)').test((t.querySelector('.name-cell')?.textContent || '').trim()));
        if (!row) return { found: false };
        row.scrollIntoView({ block: 'center' });
        const b = row.getBoundingClientRect();
        return { found: true, reachable: b.top >= -1 && b.bottom <= window.innerHeight + 1 };
      }, n);
      if (r.found && r.reachable) ok(`I2 Group ${n} present and reachable`);
      else ko(`I2 Group ${n} not reachable`, JSON.stringify(r));
    }
    await ctx.close();

    // player-facing leaderboard modal, rendered under several UI languages
    let uiStable = true; let firstSet = null;
    for (const lang of ['en', 'de', 'zh-Hans', 'pt-BR', 'he']) {
      const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const pg = await c.newPage();
      await pg.addInitScript(l => localStorage.setItem('qw_lang', l), lang);
      await pg.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await pg.waitForFunction(() => document.getElementById('group-select')?.options.length > 1, { timeout: 20000 });
      await pg.click('#lb-open-link');
      await pg.waitForSelector('#lb-pw-input', { state: 'visible', timeout: 10000 });
      await pg.fill('#lb-pw-input', ADMIN_PW);
      await pg.click('#lb-pw-btn');
      await pg.waitForTimeout(2200);
      const rows = await pg.evaluate(() => [...document.querySelectorAll('#lb-table tbody tr')]
        .map(r => r.querySelector('.lb-group')?.textContent.trim() + '|' + r.querySelector('.lb-score')?.textContent.trim()));
      if (firstSet === null) firstSet = JSON.stringify(rows);
      else if (JSON.stringify(rows) !== firstSet) { uiStable = false; ko(`I3 player scoreboard dataset changed in ${lang}`, `${rows.length} rows vs ${JSON.parse(firstSet).length}`); }
      await c.close();
    }
    if (uiStable) ok('I3 player-facing scoreboard shows the identical global dataset in en, de, zh-Hans, pt-BR and he');
  } catch (e) {
    ko('I UI check threw', (e && e.message ? e.message : String(e)).split('\n')[0]);
  } finally {
    await browser.close();
  }

  // ── J. persistence and admin reset identity ──────────────────────────────
  sec('J. persistence and admin reset');
  const beforeReload = (await api('/api/leaderboard', 'GET', null, tok)).body;
  const again = (await api('/api/leaderboard', 'GET', null, tok)).body;
  if (JSON.stringify(beforeReload) === JSON.stringify(again)) ok('J1 results survive refetch unchanged');
  else ko('J1 results changed on refetch');

  const resetTarget = 'g207';
  const preReset = beforeReload.find(r => r.groupId === resetTarget);
  await api('/api/admin/reset', 'POST', { groupId: resetTarget }, tok);
  const post = (await api('/api/leaderboard', 'GET', null, tok)).body.filter(r => r.groupId === resetTarget);
  if (post.length === 1 && post[0].played === false && post[0].score === null)
    ok(`J2 admin reset clears the single global ${resetTarget} record (was ${preReset.score}), row still represented`);
  else ko('J2 reset outcome', JSON.stringify(post[0]));
  const stillAll = (await api('/api/leaderboard', 'GET', null, tok)).body;
  if (stillAll.length === 256) ok('J3 still 256 groups represented after reset'); else ko('J3 count', `${stillAll.length}`);

  const total = pass + fail;
  process.stdout.write(`\n${'═'.repeat(68)}\nSCOREBOARD VERIFICATION: ${pass}/${total} passed, ${fail} failed\n`);
  if (fail) { process.stdout.write('\nFAILURES:\n'); failures.forEach((f, i) => process.stdout.write(`  ${i + 1}. ${f.l}\n     ${f.d}\n`)); }
  process.stdout.write(`${'═'.repeat(68)}\n`);
  process.exitCode = fail ? 1 : 0;
})();
