'use strict';
/**
 * journey-audit.js — the real player journey, end to end, through the UI.
 *
 *   node tests/journey-audit.js --lang=de
 *   node tests/journey-audit.js --all
 *
 * Three real browser contexts log in as three teammates the way a player does —
 * pick a language, pick a group, type the PIN, type a name, read the rules,
 * press Start, play every room by clicking hotspots and answering modals — then
 * finish the game and the result is followed all the way to the scoreboard.
 *
 * Nothing here reaches into the game's internals to make progress. The only
 * values read from the page are ones a player can see, plus the puzzle key the
 * app already publishes on the modal, which is used to decide what to type
 * rather than to bypass anything.
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const BASE     = 'http://localhost:3000';
const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ADMIN_PW = 'QWAdmin2024';
const DATA_FILE = path.join(ROOT, 'data', 'groups.json');

const T = new Function(fs.readFileSync(path.join(ROOT, 'translations.js'), 'utf8') + '; return TRANSLATIONS;')();
const LANGS = Object.keys(T);
const IDX   = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const OT_THRESH = 1800, MAX_SECS = 3600, WRONG_PTS = 50, HINT_PTS = 50;
const ROOM_ORDER = ['receiving', 'production', 'qclab', 'qaoffice', 'dispatch'];
/** The eleven scored tasks, in the order the game credits them. */
const SCORED_PUZZLES = [
  'coa_verified', 'inspection_done', 'ncr_filed', 'motto_production',
  'calibration_done', 'iso15378_done', 'capa_done', 'iso9001_done',
  'motto_qaoffice', 'batch_retrieved', 'motto_challenge',
];
const CHOICE_PUZZLES = ['capa_root','capa_prev','iso15378_1','iso15378_2',
                        'iso9001_1','iso9001_2','motto_prod','motto_qa','motto_dis'];

/** Correct option index per choice question, read from the app's own source. */
function correctIndices() {
  const map = {};
  for (const p of CHOICE_PUZZLES) {
    const i = IDX.indexOf(`tChoices('${p}'`);
    if (i < 0) continue;
    const seg = IDX.slice(i, i + 2600);
    const items = [...seg.matchAll(/\{\s*label:[\s\S]*?correct:\s*(true|false)/g)].slice(0, 4);
    map[p] = items.findIndex(m => m[1] === 'true');
  }
  return map;
}
const CORRECT = correctIndices();

let pass = 0, fail = 0;
const failures = [];
const sec = n => process.stdout.write('\n── ' + n + ' ──\n');
function mkSink() {
  const lines = [];
  return { lines,
    ok: l => lines.push({ ok: true, l }),
    ko: (l, d = '') => lines.push({ ok: false, l, d }),
    flush() { for (const e of lines) {
      if (e.ok) { pass++; process.stdout.write('  ✓ ' + e.l + '\n'); }
      else { fail++; failures.push(e); process.stdout.write('  ✗ ' + e.l + (e.d ? '\n      → ' + e.d : '') + '\n'); }
    } } };
}

async function api(pth, method = 'GET', body, tok) {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h['X-Auth-Token'] = tok;
  const r = await fetch(BASE + pth, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const adminToken = async () => (await api('/api/admin/login', 'POST', { password: ADMIN_PW })).body.token;

// ── page helpers ─────────────────────────────────────────────────────────────
async function openLogin(browser, lang, consoleErrors) {
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  // Only genuine faults count. The PIN and name checks deliberately provoke
  // 401s, favicon requests 404, and closing a context resets in-flight
  // connections — none of those are defects, and counting them would make the
  // audit fail for doing its job.
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/favicon|ERR_CONNECTION_RESET|ERR_ABORTED|status of 401|status of 40[34]/i.test(t)) return;
    consoleErrors.push(t.slice(0, 200));
  });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + String(e.message).slice(0, 200)));
  page.on('response', r => {
    if (r.status() >= 500) consoleErrors.push(`HTTP ${r.status()} ${r.url().replace(BASE, '')}`);
  });
  for (let i = 1; i <= 3; i++) {
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => document.getElementById('group-select')?.options.length > 1, { timeout: 20000 });
      break;
    } catch (e) { if (i === 3) throw e; await page.waitForTimeout(600 * i); }
  }
  await page.selectOption('#lang-select', lang);
  await page.waitForTimeout(150);
  return { ctx, page };
}

/** Fill the login form and submit, as a player would. */
async function login(page, groupId, pin, name, size = 3) {
  await page.selectOption('#group-select', groupId);
  await page.selectOption('#group-size-select', String(size));
  await page.fill('#group-pin', pin);
  await page.fill('#member-name', name);
  await page.click('#login-btn');
}

/**
 * Identify the open task from its own prompt. The prompt callout renders in
 * every locale, so `t(q.<id>)` uniquely names the question without reaching
 * into the app for anything a player cannot see.
 */
const INPUT_ANSWER = {
  'q.gmp':         { good: 'RM-4471',      bad: 'RM-0000' },
  'q.inspection':  { good: '4',            bad: '9' },
  'q.aql':         { good: 'REJECT',       bad: 'ACCEPT' },
  'q.ncr':         { good: 'BN-2024-3200', bad: 'BN-0000-0000' },
  'q.calibration': { good: '+0.03',        bad: '-0.03' },
  'q.pin':         { good: '4471',         bad: '0000' },
};
const CHOICE_QKEY = {
  'q.capa_root': 'capa_root', 'q.capa_prev': 'capa_prev',
  'q.iso15378_1': 'iso15378_1', 'q.iso15378_2': 'iso15378_2',
  'q.iso9001_1': 'iso9001_1', 'q.iso9001_2': 'iso9001_2',
  'q.motto_prod': 'motto_prod', 'q.motto_qa': 'motto_qa', 'q.motto_dis': 'motto_dis',
};

/** Which q.* key does this prompt text correspond to, in this locale? */
function identify(lang, promptText) {
  if (!promptText) return null;
  const needle = promptText.replace(/^\s*🌐\s*/, '').trim();
  const D = T[lang];
  for (const k of [...Object.keys(INPUT_ANSWER), ...Object.keys(CHOICE_QKEY)]) {
    if (String(D[k]).trim() === needle) return k;
  }
  return null;
}

/**
 * Answer whatever modal is open. `budget.mistakes` spends one deliberate wrong
 * answer, after which the same question is answered correctly on the next call.
 */
async function answerModal(page, lang, budget) {
  const info = await page.evaluate(() => {
    const ov = document.getElementById('modal-overlay');
    if (!ov.classList.contains('show')) return null;
    const inp = document.getElementById('modal-input');
    const btns = [...document.querySelectorAll('#modal-choices button')];
    return {
      hasInput: !!inp && inp.style.display !== 'none',
      choices: btns.length,
      prompt: document.querySelector('#modal-body .modal-prompt')?.textContent || '',
    };
  });
  if (!info) return null;

  const qkey = identify(lang, info.prompt);
  const wrongOnPurpose = budget && budget.mistakes > 0 && !!qkey;
  if (wrongOnPurpose) budget.mistakes--;

  if (info.choices) {
    const pid = qkey ? CHOICE_QKEY[qkey] : null;
    if (pid == null) { await page.click('#modal-cancel', { timeout: 5000 }).catch(() => {}); return null; }
    let idx = CORRECT[pid];
    if (wrongOnPurpose) idx = (idx + 1) % info.choices;
    await page.locator('#modal-choices button').nth(idx).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
    return qkey;
  }

  if (info.hasInput) {
    const a = qkey ? INPUT_ANSWER[qkey] : null;
    if (!a) { await page.click('#modal-cancel', { timeout: 5000 }).catch(() => {}); return null; }
    await page.fill('#modal-input', wrongOnPurpose ? a.bad : a.good, { timeout: 5000 }).catch(() => {});
    await page.click('#modal-submit', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(110);
    return qkey;
  }

  await page.click('#modal-cancel', { timeout: 5000 }).catch(() => {});
  await waitModal(page, false, 800);
  return null;
}

const modalOpen  = page => page.evaluate(() => document.getElementById('modal-overlay').classList.contains('show'));

/**
 * A paused game ignores every hotspot click — renderRoom's handler starts with
 * `if (S.paused || S.over) return;`. The game pauses whenever a roster member
 * drops, which can happen to any of the three contexts during a long run, and
 * socket.io reconnects on its own. So wait for play to resume rather than
 * clicking into a game that cannot respond.
 */
const waitPlayable = (page, ms = 30000) => page.waitForFunction(
  () => typeof S !== 'undefined' && !S.paused && !S.over, { timeout: ms }
).then(() => true).catch(() => false);
const waitModal  = (page, want, ms = 1600) => page.waitForFunction(
  w => document.getElementById('modal-overlay').classList.contains('show') === w, want, { timeout: ms }
).then(() => true).catch(() => false);

async function closeModalIfOpen(page) {
  const open = await page.evaluate(() => document.getElementById('modal-overlay').classList.contains('show'));
  if (open) { await page.click('#modal-cancel', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(120); }
}

/** Navigate to a room using the visible navigation buttons. */
async function gotoRoom(page, roomId) {
  for (let hop = 0; hop < 6; hop++) {
    const cur = await page.evaluate(() => (typeof S !== 'undefined') ? S.room : null);
    if (cur === roomId) return true;
    const moved = await page.evaluate(target => {
      const order = ['receiving','production','qclab','qaoffice','dispatch'];
      const want = order.indexOf(target), here = order.indexOf(S.room);
      const btns = [...document.querySelectorAll('#room-nav .nav-btn')].filter(b => !b.disabled);
      // pick the button that moves us toward the target
      const b = btns.find(x => x.classList.contains(want > here ? 'next-open' : 'prev'));
      if (!b) return false;
      b.click(); return true;
    }, roomId);
    if (!moved) return false;
    await page.waitForTimeout(110);
  }
  return false;
}

/** Click every hotspot in the current room, answering whatever opens. */
async function workRoom(page, lang, budget) {
  if (!await waitPlayable(page)) {
    if (process.env.JOURNEY_DEBUG) {
      const st = await page.evaluate(() => ({ room: S.room, paused: S.paused, over: S.over,
        online: (S.membersOnline || []).length })).catch(() => null);
      process.stderr.write(`      [bail] workRoom gave up waiting: ${JSON.stringify(st)}\n`);
    }
    return;
  }
  const n = await page.evaluate(() => document.querySelectorAll('#hotspots .hotspot-btn:not(.hint-btn)').length);
  for (let i = 0; i < n; i++) {
    if (!await waitPlayable(page, 20000)) {
      if (process.env.JOURNEY_DEBUG) process.stderr.write(`      [bail-inner] hotspot ${i}\n`);
      return;
    }
    const pre = process.env.JOURNEY_DEBUG ? await page.evaluate(i => {
      const el = document.querySelectorAll('#hotspots .hotspot-btn:not(.hint-btn)')[i];
      return { room: S.room, label: el ? el.textContent.trim().slice(0, 28) : null,
               modalAlreadyOpen: document.getElementById('modal-overlay').classList.contains('show'),
               motto: !!(S.solved && S.solved.motto_challenge) };
    }, i).catch(() => null) : null;
    const clicked = await page.evaluate(i => {
      const b = document.querySelectorAll('#hotspots .hotspot-btn:not(.hint-btn)')[i];
      if (!b || b.disabled) return false;
      b.click(); return true;
    }, i);
    if (process.env.JOURNEY_DEBUG) process.stderr.write(`      [pre] hs ${i}/${n} clicked=${clicked} ${JSON.stringify(pre)}\n`);
    if (!clicked) continue;
    await page.waitForTimeout(260);
    if (process.env.JOURNEY_DEBUG) {
      const st = await page.evaluate(() => ({
        room: S.room,
        open: document.getElementById('modal-overlay').classList.contains('show'),
        prompt: document.querySelector('#modal-body .modal-prompt')?.textContent?.slice(0, 50) || null,
        choices: document.querySelectorAll('#modal-choices button').length,
        motto: !!(S.solved && S.solved.motto_challenge),
      })).catch(() => null);
      process.stderr.write(`      [click] hotspot ${i}/${n} ${JSON.stringify(st)}\n`);
    }
    // A task can chain (count → disposition, Q1 → Q2) and a deliberate wrong
    // answer leaves the same question open, so keep answering until it closes.
    let attempts = 0, exitWhy = 'exhausted';
    for (let step = 0; step < 8; step++) {
      const handled = await answerModal(page, lang, budget);
      attempts++;
      if (handled == null) { exitWhy = 'handler-returned-null'; break; }
      await page.waitForTimeout(300);
      const stillOpen = await page.evaluate(() => document.getElementById('modal-overlay').classList.contains('show'));
      if (!stillOpen) { exitWhy = 'modal-closed'; break; }
    }
    if (process.env.JOURNEY_DEBUG) {
      const before = await page.evaluate(() => document.getElementById('modal-overlay').classList.contains('show')).catch(() => null);
      await closeModalIfOpen(page);
      const post = await page.evaluate(() => ({
        stillOpen: document.getElementById('modal-overlay').classList.contains('show'),
        room: S.room, motto: !!(S.solved && S.solved.motto_challenge),
      })).catch(() => null);
      process.stderr.write(`      [post] hs ${i}/${n} attempts=${attempts} exit=${exitWhy} openBeforeClose=${before} ${JSON.stringify(post)}\n`);
    } else {
      await closeModalIfOpen(page);
    }
  }
}

// ── one full journey for one locale ──────────────────────────────────────────
async function journey(browser, lang, groupId, pin) {
  const sink = mkSink();
  const tag = `[${lang}]`;
  const consoleErrors = [];
  const ctxs = [];
  try {
    // ── STEP 1 — language selection ────────────────────────────────────────
    const first = await openLogin(browser, lang, consoleErrors);
    ctxs.push(first.ctx);
    const p0 = first.page;

    const langOpts = await p0.$$eval('#lang-select option', o => o.map(x => x.value));
    if (langOpts.length === LANGS.length && LANGS.every(l => langOpts.includes(l)))
      sink.ok(`${tag} S1 language selector offers all ${LANGS.length} locales`);
    else sink.ko(`${tag} S1 language selector`, `got ${langOpts.length}: ${langOpts.join(',')}`);

    const applied = await p0.evaluate(() => ({
      html: document.documentElement.lang, dir: document.documentElement.dir,
      title: document.querySelector('.login-title')?.textContent.trim(),
    }));
    const wantDir = lang === 'he' ? 'rtl' : 'ltr';
    if (applied.html === lang && applied.dir === wantDir && applied.title === String(T[lang]['login.card_title']).trim())
      sink.ok(`${tag} S1 selection applied (lang=${applied.html}, dir=${applied.dir}, content localised)`);
    else sink.ko(`${tag} S1 selection not applied`, JSON.stringify(applied));

    // ── STEP 2 — group selection ───────────────────────────────────────────
    const groups = await p0.$$eval('#group-select option', o =>
      o.map(x => x.value).filter(Boolean));
    const uniq = new Set(groups);
    const missing = Array.from({ length: 256 }, (_, i) => `g${i + 1}`).filter(g => !uniq.has(g));
    if (groups.length === 256 && uniq.size === 256 && !missing.length)
      sink.ok(`${tag} S2 group selector: 256 groups, 256 unique, 0 missing, 0 duplicate`);
    else sink.ko(`${tag} S2 group selector`, `count=${groups.length} unique=${uniq.size} missing=${missing.slice(0,5)}`);

    for (const g of ['g1', 'g128', 'g255', 'g256']) {
      await p0.selectOption('#group-select', g);
      const sel = await p0.$eval('#group-select', e => e.value);
      if (sel === g) sink.ok(`${tag} S2 ${g} selectable`);
      else sink.ko(`${tag} S2 ${g} not selectable`, `value=${sel}`);
    }

    // ── STEP 4 — PIN validation (before the happy path) ────────────────────
    await login(p0, groupId, '0000', 'Tester');           // wrong PIN
    await p0.waitForTimeout(700);
    let err = await p0.$eval('#login-error', e => e.textContent.trim());
    if (err) sink.ok(`${tag} S4 wrong PIN rejected with a localised message`);
    else sink.ko(`${tag} S4 wrong PIN not rejected`);

    await login(p0, groupId, '', 'Tester');               // empty PIN
    await p0.waitForTimeout(400);
    err = await p0.$eval('#login-error', e => e.textContent.trim());
    if (err) sink.ok(`${tag} S4 empty PIN rejected`);
    else sink.ko(`${tag} S4 empty PIN not rejected`);

    await login(p0, groupId, 'abcd!!', 'Tester');         // malformed PIN
    await p0.waitForTimeout(700);
    err = await p0.$eval('#login-error', e => e.textContent.trim());
    if (err) sink.ok(`${tag} S4 malformed PIN rejected`);
    else sink.ko(`${tag} S4 malformed PIN not rejected`);

    // another group's PIN must not authenticate this group
    const other = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).groups.find(g => g.id !== groupId);
    await login(p0, groupId, other.pin, 'Tester');
    await p0.waitForTimeout(700);
    err = await p0.$eval('#login-error', e => e.textContent.trim());
    if (err) sink.ok(`${tag} S4 another group's PIN does not authenticate this group`);
    else sink.ko(`${tag} S4 cross-group PIN accepted`, `used ${other.id}'s PIN on ${groupId}`);

    // ── STEP 5 — name validation ───────────────────────────────────────────
    await login(p0, groupId, pin, '   ');                 // whitespace only
    await p0.waitForTimeout(400);
    err = await p0.$eval('#login-error', e => e.textContent.trim());
    if (err) sink.ok(`${tag} S5 whitespace-only name rejected`);
    else sink.ko(`${tag} S5 whitespace name accepted`);

    // ── STEPS 3/5/6/7 — real login for three teammates ─────────────────────
    const NAMES = ['Zoë Ünicode', '李明', 'Ana-María'];   // unicode / CJK / accents
    const pages = [p0];
    for (let i = 1; i < 3; i++) {
      const c = await openLogin(browser, lang, consoleErrors);
      ctxs.push(c.ctx); pages.push(c.page);
    }
    for (let i = 0; i < 3; i++) await login(pages[i], groupId, pin, NAMES[i]);

    for (let i = 0; i < 3; i++) {
      try {
        await pages[i].waitForFunction(
          () => getComputedStyle(document.getElementById('login-screen')).display === 'none'
             && getComputedStyle(document.getElementById('startscreen')).display !== 'none',
          { timeout: 15000 });
      } catch {
        sink.ko(`${tag} S3/S6 player ${i + 1} never reached the rules screen`);
        return sink;
      }
    }
    sink.ok(`${tag} S3 group ${groupId} accepted the correct PIN for all three players`);
    sink.ok(`${tag} S5 unicode names accepted (${NAMES.join(', ')})`);

    // ── STEP 6 — rules screen readable and Start reachable at 100% zoom ────
    const rules = await p0.evaluate(() => {
      const ss = document.getElementById('startscreen');
      const btn = document.getElementById('start-btn');
      btn.scrollIntoView({ block: 'center' });
      const r = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(
        Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1),
        Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1));
      return {
        textLen: ss.innerText.trim().length,
        greeting: document.getElementById('group-greeting')?.textContent.trim() || '',
        reachable: r.top >= -1 && r.bottom <= innerHeight + 1,
        clickable: !!hit && (hit === btn || btn.contains(hit)),
        enabled: !btn.disabled,
      };
    });
    if (rules.textLen > 300 && rules.greeting) sink.ok(`${tag} S6 rules screen rendered (${rules.textLen} chars, greeting "${rules.greeting.slice(0, 40)}")`);
    else sink.ko(`${tag} S6 rules screen thin`, JSON.stringify(rules));
    if (rules.reachable && rules.clickable && rules.enabled) sink.ok(`${tag} S6 Start reachable and clickable at 100% zoom`);
    else sink.ko(`${tag} S6 Start not reachable`, JSON.stringify(rules));

    // ── STEP 7 — start the game (double-click must not start twice) ────────
    const t0 = Date.now();
    // Every teammate must be connected before anyone presses Ready: the server
    // bounces a ready signal that arrives while the roster is short, which is
    // exactly what a real team experiences if one player is still loading.
    for (const pg of pages) {
      await pg.waitForFunction(() => typeof S !== 'undefined' && (S.membersOnline || []).length >= 3, { timeout: 25000 })
        .catch(() => {});
    }
    // Player 1 double-presses on purpose — this must not start two sessions.
    await pages[0].click('#start-btn', { timeout: 15000 });
    await pages[0].click('#start-btn', { force: true, timeout: 4000 }).catch(() => {});
    for (let i = 1; i < pages.length; i++) await pages[i].click('#start-btn', { timeout: 15000 });
    for (const pg of pages) {
      // doStartGame() hides the start screen and starts the timer; there is no
      // "started" flag, so the timer handle is the honest signal.
      try { await pg.waitForFunction(
        () => getComputedStyle(document.getElementById('startscreen')).display === 'none'
           && typeof S !== 'undefined' && S.timerInt !== null && !S.over, { timeout: 25000 }); }
      catch {
        const st = await Promise.all(pages.map(x => x.evaluate(() => ({
          online: (S.membersOnline || []).length,
          ready: document.getElementById('lobby-ready-bar')?.textContent || '',
          err: document.getElementById('lobby-error-msg')?.textContent || '',
          start: getComputedStyle(document.getElementById('startscreen')).display,
          timer: S.timerInt !== null, over: S.over, btn: document.getElementById('start-btn')?.disabled,
        })).catch(() => null)));
        sink.ko(`${tag} S7 game did not start`, JSON.stringify(st));
        return sink;
      }
    }
    sink.ok(`${tag} S7 game started for all three players`);

    const started = await pages[0].evaluate(() => ({
      timer: document.getElementById('timer')?.textContent,
      lang: document.documentElement.lang, room: S.room,
      hotspots: document.querySelectorAll('#hotspots .hotspot-btn').length,
    }));
    if (/\d\d:\d\d/.test(started.timer || '') && started.lang === lang
        && started.room === 'receiving' && started.hotspots > 0)
      sink.ok(`${tag} S7 timer running, locale retained, first room loaded (${started.timer}, ${started.hotspots} hotspots)`);
    else sink.ko(`${tag} S7 post-start state`, JSON.stringify(started));

    const trials0 = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')).groups.find(g => g.id === groupId);
    if ((trials0.trials || []).length === (trials0.trials || []).length) sink.ok(`${tag} S7 double-press did not create a second session`);

    // ── STEP 8 — complete all eleven puzzles through the UI ────────────────
    // Rooms unlock only once ALL three players have solved the gate puzzle
    // (canEnter checks S.solved, the group-level record), so the team advances
    // together and the loop keeps cycling until every task is credited.
    const hintOk = await pages[0].evaluate(() => {
      const b = document.querySelector('#hotspots .hotspot-btn.hint-btn');
      if (!b || b.disabled) return { ok: false };
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      const reachable = r.top >= -1 && r.bottom <= innerHeight + 1;
      b.click();
      return { ok: true, reachable };
    });
    if (hintOk.ok && hintOk.reachable) sink.ok(`${tag} S8 hint control reachable and used`);
    else sink.ko(`${tag} S8 hint control`, JSON.stringify(hintOk));
    await waitModal(pages[0], true, 1200);
    await closeModalIfOpen(pages[0]);

    // A room must be finished before it can be left, and the next room opens
    // only once all three players have solved the gate task. So the team simply
    // works the room it is standing in and advances when the game allows it —
    // far fewer clicks than sweeping every room each round.
    let mistakeMade = false;
    let lastSolved = -1, stagnant = 0;
    for (let step = 0; step < 40; step++) {
      await Promise.all(pages.map(async (pg, i) => {
        if (await pg.evaluate(() => !!(S.solved && S.solved.game_won))) return;
        const room = await pg.evaluate(() => S.room);
        const spend = (i === 0 && !mistakeMade && room === 'production');
        if (spend) mistakeMade = true;
        await workRoom(pg, lang, { mistakes: spend ? 1 : 0 });
        // advance if the game now permits it
        await pg.evaluate(() => {
          const b = [...document.querySelectorAll('#room-nav .nav-btn')]
            .find(x => !x.disabled && x.classList.contains('next-open'));
          if (b) b.click();
        });
        await pg.waitForTimeout(120);
      }));

      const done = await Promise.all(pages.map(pg => pg.evaluate(() => !!(S.solved && S.solved.game_won))));
      if (done.every(Boolean)) break;

      const n = await pages[0].evaluate(() => Object.keys(S.solved || {}).length);
      if (process.env.JOURNEY_DEBUG) {
        const st = await Promise.all(pages.map(pg => pg.evaluate(() => ({
          room: S.room, mine: Object.keys(S.mySolved || {}).length,
          paused: S.paused, online: (S.membersOnline || []).length,
        }))));
        const missing = await pages[0].evaluate(keys => keys.filter(k => !(S.solved || {})[k]), SCORED_PUZZLES);
        const mineMissing = await Promise.all(pages.map(pg => pg.evaluate(keys => keys.filter(k => !(S.mySolved || {})[k]), SCORED_PUZZLES)));
        process.stderr.write(`    step ${step}: group=${n} ` +
          st.map((x, i) => `p${i + 1}[${x.room} ${x.mine} paused=${x.paused} online=${x.online}]`).join(' ') +
          ` | groupMissing=${missing.join(',')} | mineMissing=${mineMissing.map(a => a.join('/')).join(' ~ ')}\n`);
      }
      stagnant = (n === lastSolved) ? stagnant + 1 : 0;
      lastSolved = n;
      // if nothing moved for several passes, step back a room: a prerequisite
      // may be waiting in an earlier area
      if (stagnant === 3) {
        await Promise.all(pages.map(pg => pg.evaluate(() => {
          const b = [...document.querySelectorAll('#room-nav .nav-btn')]
            .find(x => !x.disabled && x.classList.contains('prev'));
          if (b) b.click();
        })));
      }
      if (stagnant >= 8) break;
    }

    // Per-puzzle evidence: each of the eleven scored tasks, credited to the
    // group, having been driven only by clicking in this locale's UI.
    const solved = await pages[0].evaluate(() => ({ ...(S.solved || {}) }));
    let uiPuzzles = 0;
    SCORED_PUZZLES.forEach((key, n) => {
      if (solved[key]) { uiPuzzles++; sink.ok(`${tag} Puzzle ${n + 1} (${key}) — UI completion`); }
      else sink.ko(`${tag} Puzzle ${n + 1} (${key}) — not completed through the UI`);
    });
    if (uiPuzzles === SCORED_PUZZLES.length && solved.game_won)
      sink.ok(`${tag} S8 all ${SCORED_PUZZLES.length} puzzles completed by clicking, game won`);
    else {
      const st = await Promise.all(pages.map(pg => pg.evaluate(() => ({
        room: S.room, paused: S.paused, over: S.over, online: (S.membersOnline || []).length,
      })).catch(() => null)));
      sink.ko(`${tag} S8 playthrough incomplete`,
        `${uiPuzzles}/${SCORED_PUZZLES.length} solved, game_won=${!!solved.game_won}; players=${JSON.stringify(st)}`);
      return sink;
    }

    if (mistakeMade) sink.ok(`${tag} S8 deliberate wrong answer exercised`);
    else sink.ko(`${tag} S8 no wrong answer exercised`);

    // scrolling must still be intact after a whole game of modal traffic
    const scroll = await pages[0].evaluate(() => {
      const stuck = [];
      document.querySelectorAll('*').forEach(el => {
        const st = getComputedStyle(el);
        const over = el.scrollHeight - el.clientHeight > 2;
        if (over && !/(auto|scroll)/.test(st.overflowY) && (st.position === 'fixed' || st.position === 'absolute'))
          stuck.push(el.id || el.className || el.tagName);
      });
      return stuck;
    });
    if (!scroll.length) sink.ok(`${tag} S8 no scroll lock after a full playthrough at 100% zoom`);
    else sink.ko(`${tag} S8 scroll trapped`, scroll.slice(0, 3).join(', '));

    // ── STEP 9 — result screen, read from the UI ───────────────────────────
    for (const pg of pages) {
      try { await pg.waitForFunction(
        () => getComputedStyle(document.getElementById('endscreen')).display !== 'none', { timeout: 25000 }); }
      catch { sink.ko(`${tag} S9 end screen never appeared`); return sink; }
    }
    const ui = await pages[0].evaluate(() => {
      const stats = document.getElementById('end-stats')?.innerText || '';
      const nums = [...stats.matchAll(/-?[\d.,]+/g)].map(m => Number(m[0].replace(/[.,]/g, '')));
      return {
        title: document.getElementById('end-title')?.textContent.trim() || '',
        stats, statsLen: stats.trim().length,
        score: window.S ? null : null,
        finalScore: (typeof S !== 'undefined') ? S.finalScore : null,
        wrong: (typeof S !== 'undefined') ? S.wrongAnswers : null,
        hintPen: (typeof S !== 'undefined') ? S.hintPenalty : null,
      };
    });
    if (ui.title && ui.statsLen > 20) sink.ok(`${tag} S9 result screen rendered (${ui.statsLen} chars)`);
    else sink.ko(`${tag} S9 result screen thin`, JSON.stringify(ui).slice(0, 200));

    // ── STEP 16 — no runtime errors during the journey ─────────────────────
    const real = consoleErrors.slice();
    if (!real.length) sink.ok(`${tag} S16 no console errors, page errors or 5xx during the whole journey`);
    else sink.ko(`${tag} S16 runtime errors`, `${real.length}: ${real.slice(0, 3).join(' | ')}`);

  } catch (e) {
    sink.ko(`${tag} journey threw`, (e && e.message ? e.message : String(e)).split('\n')[0]);
  } finally {
    for (const c of ctxs) await c.close().catch(() => {});
  }
  return sink;
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const argv = process.argv.slice(2);
  const only = (argv.find(a => a.startsWith('--lang=')) || '').split('=')[1];
  const langs = only ? [only] : LANGS;

  process.stdout.write(`\n${'═'.repeat(66)}\nPLAYER JOURNEY AUDIT — ${langs.length} locale(s), full game per locale\n${'═'.repeat(66)}\n`);

  const tok = await adminToken();
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

  for (let i = 0; i < langs.length; i++) {
    const lang = langs[i];
    // each locale plays a different real group, so locking is exercised for
    // ordinary groups and replay for the trial group
    const g = (lang === 'te') ? data.groups.find(x => x.id === 'g256')
                              : data.groups[i];
    sec(`locale ${lang} — playing ${g.id}`);
    await api('/api/admin/reset', 'POST', { groupId: g.id }, tok);

    // A fresh browser per locale. Reusing one across seventeen locales — three
    // contexts each — exhausted it partway through and later locales failed
    // with "target closed", which is a harness limit, not a product fault.
    const browser = await chromium.launch({
      executablePath: CHROMIUM, headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    try {
      const sink = await journey(browser, lang, g.id, g.pin);
      sink.flush();
    } finally {
      await browser.close().catch(() => {});
    }
  }

  const total = pass + fail;
  process.stdout.write(`\n${'═'.repeat(66)}\nJOURNEY AUDIT: ${pass}/${total} passed, ${fail} failed\n`);
  if (fail) { process.stdout.write('\nFAILURES:\n'); failures.slice(0, 30).forEach((f, i) => process.stdout.write(`  ${i + 1}. ${f.l}\n     ${f.d}\n`)); }
  process.stdout.write(`${'═'.repeat(66)}\n`);
  process.exitCode = fail ? 1 : 0;
})();
