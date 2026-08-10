'use strict';
/**
 * layout-audit.js — scroll reachability across locales, viewports and zoom.
 *
 *   node tests/layout-audit.js                 all locales, all viewports
 *   node tests/layout-audit.js --lang=de       one locale
 *   node tests/layout-audit.js --quick         one viewport (smoke)
 *
 * Guards the class of bug where a fixed, viewport-sized flex container centres
 * its children: once content exceeds the viewport it overflows in BOTH
 * directions, and the part past the start edge cannot be scrolled to because
 * scrollTop cannot go negative. The screen looks frozen and the primary button
 * is unreachable at normal zoom.
 *
 * Every check is expressed as "can the player actually reach it", not "does the
 * CSS look right", so it stays valid however the layout is implemented.
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const BASE     = 'http://localhost:3000';
const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ADMIN_PW = 'QWAdmin2024';

const LANGS = Object.keys(
  new Function(fs.readFileSync(path.join(ROOT, 'translations.js'), 'utf8') + '; return TRANSLATIONS;')()
);

/**
 * deviceScaleFactor cannot emulate browser zoom, but zoom is equivalent to a
 * proportionally smaller CSS viewport — 125% zoom on 1280×800 lays out as
 * 1024×640. Driving the viewport directly reproduces the same condition.
 */
const VIEWPORTS = [
  { name: 'laptop 1280×800  @100%',  width: 1280, height: 800 },
  { name: 'laptop 1280×800  @125%',  width: 1024, height: 640 },
  { name: 'laptop 1280×800  @150%',  width: 853,  height: 533 },
  { name: 'desktop 1920×1080 @100%', width: 1920, height: 1080 },
  { name: 'small laptop 1366×640',   width: 1366, height: 640 },
  { name: 'short window 1280×560',   width: 1280, height: 560 },
  { name: 'tablet 768×1024',         width: 768,  height: 1024 },
  { name: 'mobile 390×844',          width: 390,  height: 844 },
];

let pass = 0, fail = 0;
const failures = [];
const sec = n => process.stdout.write('\n── ' + n + ' ──\n');

/**
 * Viewports are audited concurrently, so each one collects into its own buffer
 * and the buffers are flushed in declaration order. Without this the log would
 * interleave and stop being readable as "locale × viewport".
 */
function makeSink() {
  const lines = [];
  return {
    lines,
    ok:  l => lines.push({ ok: true,  l }),
    ko:  (l, d = '') => lines.push({ ok: false, l, d }),
    flush() {
      for (const e of lines) {
        if (e.ok) { pass++; process.stdout.write('  ✓ ' + e.l + '\n'); }
        else { fail++; failures.push({ l: e.l, d: e.d }); process.stdout.write('  ✗ ' + e.l + (e.d ? '\n      → ' + e.d : '') + '\n'); }
      }
    },
  };
}

/**
 * Is `el` reachable? An element is reachable when, after scrolling its nearest
 * scrollable ancestor as far as that ancestor allows, the element's box lies
 * within the viewport and the topmost element at its centre is the element
 * itself (or a descendant) — i.e. nothing invisible is covering it.
 */
const REACHABLE = (selector) => {
  const el = document.querySelector(selector);
  if (!el) return { found: false };
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return { found: true, visible: false };

  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight, vw = window.innerWidth;

  const inView = r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw
              && r.top >= -1 && r.bottom <= vh + 1;

  const cx = Math.min(Math.max(r.left + r.width / 2, 1), vw - 1);
  const cy = Math.min(Math.max(r.top + r.height / 2, 1), vh - 1);
  const hit = document.elementFromPoint(cx, cy);
  const covered = !(hit && (hit === el || el.contains(hit) || hit.contains(el)));

  return {
    found: true, visible: true, inView, covered,
    rect: { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) },
    vh, coveredBy: covered && hit ? (hit.id || hit.className || hit.tagName) : null,
  };
};

/** Report whether any scroll container is stuck with content out of reach. */
const SCROLL_STATE = () => {
  const de = document.documentElement, b = document.body;
  const stuck = [];
  const scan = el => {
    const s = getComputedStyle(el);
    const overflowsY = el.scrollHeight - el.clientHeight > 2;
    const canScroll = /(auto|scroll)/.test(s.overflowY);
    // A fixed/absolute full-height box whose content overflows but which cannot
    // scroll traps that content.
    if (overflowsY && !canScroll && (s.position === 'fixed' || s.position === 'absolute')) {
      stuck.push({ id: el.id || el.className || el.tagName, over: el.scrollHeight - el.clientHeight, overflowY: s.overflowY });
    }
    // A centring flex container whose content overflows spills past its start
    // edge, which no amount of scrolling can recover.
    if (overflowsY && s.display === 'flex' && s.flexDirection === 'column') {
      const jc = s.justifyContent;
      if (jc === 'center' || jc === 'flex-end' || jc === 'end') {
        const first = el.firstElementChild;
        if (first && first.getBoundingClientRect().top < el.getBoundingClientRect().top - 1) {
          stuck.push({ id: el.id || el.className || el.tagName, reason: 'content clipped above start edge', justifyContent: jc });
        }
      }
    }
  };
  document.querySelectorAll('*').forEach(scan);
  return {
    docScrollable: de.scrollHeight - de.clientHeight > 2 ? /(auto|scroll|visible)/.test(getComputedStyle(de).overflowY) || /(auto|scroll|visible)/.test(getComputedStyle(b).overflowY) : true,
    bodyOverflow: getComputedStyle(b).overflowY,
    htmlOverflow: getComputedStyle(de).overflowY,
    stuck,
  };
};

async function newPage(browser, lang, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  await page.addInitScript(l => localStorage.setItem('qw_lang', l), lang);
  return { ctx, page };
}

/**
 * Load the login page and wait for the group dropdown to be populated.
 * Retries: the dropdown is filled from /api/groups, and across 136 page loads
 * in one run that fetch occasionally outlasts a single window. A slow load is a
 * property of the harness, not of the layout under test.
 */
async function loadHome(page, tries = 3) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(
        () => document.getElementById('group-select')?.options.length > 1, { timeout: 20000 });
      return;
    } catch (e) { lastErr = e; await page.waitForTimeout(600 * i); }
  }
  throw lastErr;
}

/** Assert an element is reachable; returns true on success. */
async function assertReachable(sink, page, selector, label) {
  const r = await page.evaluate(REACHABLE, selector);
  if (!r.found)          { sink.ko(`${label}: not in DOM`); return false; }
  if (!r.visible)        { sink.ok(`${label}: not shown in this state (skipped)`); return true; }
  if (r.covered)         { sink.ko(`${label}: covered by an overlay`, `topmost element = ${r.coveredBy}`); return false; }
  if (!r.inView)         { sink.ko(`${label}: cannot be scrolled into view`, `rect top=${r.rect.top} bottom=${r.rect.bottom} viewport=${r.vh}`); return false; }
  sink.ok(`${label}: reachable`);
  return true;
}

async function assertNoTrappedScroll(sink, page, label) {
  const s = await page.evaluate(SCROLL_STATE);
  if (s.stuck.length) {
    sink.ko(`${label}: content trapped out of reach`, JSON.stringify(s.stuck.slice(0, 3)));
    return false;
  }
  if (!s.docScrollable) {
    sink.ko(`${label}: document overflows but cannot scroll`, `html=${s.htmlOverflow} body=${s.bodyOverflow}`);
    return false;
  }
  sink.ok(`${label}: no trapped scroll containers`);
  return true;
}

// ── one locale × one viewport ────────────────────────────────────────────────
async function auditLocaleViewport(browser, lang, vp) {
  const sink = makeSink();
  const { ctx, page } = await newPage(browser, lang, vp);
  const tag = `[${lang} · ${vp.name}]`;
  try {
    await loadHome(page);

    // 1. login screen — the card and the primary button must be reachable
    await assertNoTrappedScroll(sink, page, `${tag} login`);
    await assertReachable(sink, page, '#login-btn', `${tag} login button`);

    // 2. start screen via demo mode — this is where the report said Start
    //    could not be reached
    await page.click('#demo-link');
    await page.waitForSelector('#demo-pw-input', { state: 'visible' });
    await page.fill('#demo-pw-input', ADMIN_PW);
    await page.click('#demo-pw-btn');
    await page.waitForSelector('#startscreen', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(250);

    await assertNoTrappedScroll(sink, page, `${tag} start screen`);
    await assertReachable(sink, page, '#start-btn', `${tag} START button`);

    // 3. enter the game, then open and close a task modal. A modal that leaves
    //    scroll locked behind it is the classic intermittent cause.
    await page.click('#start-btn');
    await page.waitForTimeout(900);

    await page.evaluate(() => {
      openModal({ tag: 'AUDIT', title: 'audit', body: '<p>'.repeat(1) + 'x'.repeat(4000) + '</p>',
                  questionKey: 'q.iso15378_2', noInput: true });
    });
    await page.waitForTimeout(200);
    await assertReachable(sink, page, '#modal-cancel', `${tag} modal close button`);
    await page.evaluate(() => closeModal());
    await page.waitForTimeout(200);
    await assertNoTrappedScroll(sink, page, `${tag} after modal close`);

    // 4. repeat open/close — a cleanup that only fails on the Nth cycle is
    //    exactly what makes this bug look intermittent
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => openModal({ tag: 'A', title: 't', body: 'x', noInput: true }));
      await page.waitForTimeout(60);
      await page.evaluate(() => closeModal());
      await page.waitForTimeout(60);
    }
    await assertNoTrappedScroll(sink, page, `${tag} after 5 modal cycles`);

    // 5. resize while open — layout must recover, not latch
    await page.setViewportSize({ width: Math.max(360, vp.width - 200), height: Math.max(400, vp.height - 160) });
    await page.waitForTimeout(200);
    await assertNoTrappedScroll(sink, page, `${tag} after resize`);

  } catch (e) {
    sink.ko(`${tag} threw`, (e && e.message ? e.message : String(e)).split('\n')[0]);
  } finally {
    await ctx.close();
  }
  return sink;
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const argv  = process.argv.slice(2);
  const only  = (argv.find(a => a.startsWith('--lang=')) || '').split('=')[1];
  const quick = argv.includes('--quick');
  const langs = only ? [only] : LANGS;
  const vps   = quick ? [VIEWPORTS[0]] : VIEWPORTS;

  process.stdout.write(`\n${'═'.repeat(66)}\n`);
  process.stdout.write(`LAYOUT / SCROLL AUDIT — ${langs.length} locale(s) × ${vps.length} viewport(s)\n`);
  process.stdout.write(`${'═'.repeat(66)}\n`);

  const browser = await chromium.launch({
    executablePath: CHROMIUM, headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    // Viewports are independent: nothing here mutates server state (the game is
    // driven in demo mode), so they run concurrently with a small cap and their
    // buffered output is flushed in declaration order.
    const CONCURRENCY = 4;
    for (const lang of langs) {
      sec(`locale ${lang}`);
      for (let i = 0; i < vps.length; i += CONCURRENCY) {
        const batch = vps.slice(i, i + CONCURRENCY);
        const sinks = await Promise.all(batch.map(vp => auditLocaleViewport(browser, lang, vp)));
        sinks.forEach(s => s.flush());
      }
    }
  } finally {
    await browser.close();
  }

  const total = pass + fail;
  process.stdout.write(`\n${'═'.repeat(66)}\n`);
  process.stdout.write(`LAYOUT AUDIT: ${pass}/${total} passed, ${fail} failed\n`);
  if (fail) { process.stdout.write('\nFAILURES:\n'); failures.slice(0, 40).forEach((f, i) => process.stdout.write(`  ${i + 1}. ${f.l}\n     ${f.d}\n`)); }
  process.stdout.write(`${'═'.repeat(66)}\n`);
  process.exitCode = fail ? 1 : 0;
})();
