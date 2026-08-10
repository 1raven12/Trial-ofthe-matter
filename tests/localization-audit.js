'use strict';
/**
 * localization-audit.js — canonical-spec content parity audit
 *
 *   node tests/localization-audit.js --lang=zh-Hans   audit one language
 *   node tests/localization-audit.js --all            audit all languages
 *   node tests/localization-audit.js --all --ui       include Playwright UI checks
 *
 * The audit does NOT treat English as the sole master. It compares every locale
 * (English included) against a language-neutral CANONICAL SPEC that lists, for
 * each content block, the semantic facts and controlled technical identifiers
 * that must survive translation.
 *
 * Defect classes detected:
 *   D1  missing / empty translation key
 *   D2  semantic block loss (partial translation, truncated tail)
 *   D3  controlled identifier dropped (batch no., standard clause, serial)
 *   D4  HTML structure divergence
 *   D5  interpolation placeholder divergence
 *   D6  answer-option loss / option-count or answer-ID divergence
 *   D7  terminology drift (one concept, several translations)
 *   D8  untranslated fallback text
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const T = new Function(fs.readFileSync(path.join(ROOT, 'translations.js'), 'utf8') + '; return TRANSLATIONS;')();
const LANGS = Object.keys(T);
const EN_KEYS = Object.keys(T.en);

// ── result plumbing ──────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];
function ok(label)            { pass++; process.stdout.write('  ✓ ' + label + '\n'); }
function ko(label, detail='') { fail++; failures.push({ label, detail }); process.stdout.write('  ✗ ' + label + (detail ? '\n      → ' + detail : '') + '\n'); }
function section(name)        { process.stdout.write('\n── ' + name + ' ──\n'); }

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL SPEC
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Controlled identifiers must appear verbatim in every locale — they are batch
 * numbers, serials, standard numbers and clause references, never translated.
 * `alts` lists locale-legitimate renderings (decimal comma, localized acronym).
 */
const IDENTIFIER_ALIASES = {
  '12.50': ['12,50'],
  '12.53': ['12,53'],
  '+0.03': ['+0,03'],
  // es/pt/fr localise Good Manufacturing Practice; Serbian Cyrillic transliterates
  'GMP':   ['BPF', 'BPx', 'GxP', 'ГМП', 'जीएमपी', 'ಜಿಎಂಪಿ', 'ஜிஎம்பி', 'జిఎంపి'],
  'CoA':   ['CdA', 'CA', 'COA', 'CofA'],
  'GDP':   ['GDocP', 'BPD', 'BPd'],
  // signage word; sr-Cyrl transliterates it consistently across all 9 of its uses
  'HOLD':  ['ХОЛД'],
};

/**
 * Normalise a locale's text before identifier matching so that legitimate
 * orthography is not reported as content loss:
 *   - German attributive compounds hyphenate standard numbers
 *     ("ISO-15378-Verpackungskonformitätsakte" ≡ "ISO 15378")
 *   - non-breaking and narrow spaces are used as thin separators
 */
function normaliseForIdentifiers(s) {
  return String(s)
    .replace(/ISO[-‐‑‒–  ]/g, 'ISO ')
    .replace(/[   ]/g, ' ');
}

/**
 * Canonical content spec. Each entry is one authored content block.
 *   must   — identifiers/markers required in EVERY locale
 *   motto  — true when the block ends with the site motto (detected via '·')
 *   blocks — human-readable list of the semantic facts the block must carry
 */
const SPEC = {
  'room.desc.receiving': {
    must: ['CoA', 'HOLD'], motto: true,
    blocks: ['incoming QC', 'CoA verified before release', 'red HOLD light over pallet',
             'GMP terminal: MATERIAL ON HOLD — VERIFICATION REQUIRED', 'Quality Week banner + site motto'],
  },
  'room.desc.production': {
    must: ['3', 'AQL', 'NCR'], motto: true,
    blocks: ['moulding/assembly line for plungers', 'line halted at Station 3, amber light',
             'visual inspection light-box for Quality Week', 'AQL sampling chart pinned beside it',
             'QC Lab door sign: ENTRY REQUIRES NCR FILING', 'permanent poster with motto + shared responsibility'],
  },
  'room.desc.qclab': {
    must: ['ISO 15378', '3'], motto: true,
    blocks: ['IPA + calibration fluid smell', 'gauges/counters/sterility equipment',
             'micrometer station OUT OF CALIBRATION sticker', 'calibration reference cabinet',
             'QA Office door: CALIBRATION SIGN-OFF REQUIRED', 'ISO 15378 packaging file on far bench',
             'Station 3 maintenance log open', 'site motto printed in bold above bench'],
  },
  'room.desc.qaoffice': {
    must: ['ISO 13485', 'NCR-0892', 'ISO 9001', 'ISO 15378', 'CAPA'], motto: true,
    blocks: ['hub of quality operations', 'ISO 13485 clause labels on cabinets',
             'CAPA workstation NON-CONFORMANCE #NCR-0892 AWAITING ROOT CAUSE ANALYSIS',
             'ISO 9001 management review board with last quarter KPIs',
             'batch record safe needs CAPA + ISO 9001 + ISO 15378 to unlock',
             'framed quality pledge with motto + we own our processes'],
  },
  'room.desc.dispatch': {
    must: ['BN-2024-3200', 'ISO 13485', '8.3'], motto: true,
    blocks: ['final checkpoint before product leaves', 'quarantine cage padlocked pending QA sign-off',
             'batch release terminal glows amber',
             'ISO 13485 §8.3 — no nonconforming product leaves without documented disposition',
             'Quality Week banner ZERO DEFECTS SAVES LIVES + motto'],
  },

  // ── puzzle bodies carrying controlled values ──
  'body.calibration':  { must: ['12.50', '12.53'], blocks: ['calibration matters', 'gauge block 12.50 reads 12.53', 'enter signed deviation'] },
  'body.ncr':          { must: ['ISO 13485'],       blocks: ['NCR required under ISO 13485', 'enter batch number'] },
  'body.pin':          { must: ['ISO 13485', '8.3', 'BN-2024-3200'], blocks: ['ISO 13485 §8.3 disposition', 'enter 4-digit QA PIN'] },
  'body.capa_root':    { must: ['BN-2024-3200'],    blocks: ['CAPA must find true root cause', 'select root cause for batch'] },
  'body.capa_prev':    { must: ['8.5.2', 'B-7', 'A-3'], blocks: ['root cause confirmed wrong lubricant', 'ISO 13485 §8.5.2 quote', 'select preventive action'] },
  'body.iso15378_1':   { must: ['ISO 15378', 'BN-2024-3200'], blocks: ['ISO 15378 scope', 'read packaging spec', 'mandatory first action'] },
  'body.iso15378_2':   { must: [],                  blocks: ['stoppers quarantined, supplier NCR needed', 'Leon used correction fluid', 'is correction acceptable under GDP'] },
  'body.iso9001_1':    { must: ['NCR-0892'],        blocks: ['CAPA team reviewing lubricant incident', 'risk-based thinking', 'which process failure explains 3 months'] },
  'body.iso9001_2':    { must: ['NCR-0892', 'CAPA-0112', '3'], blocks: ['management review definition', 'this week events', 'which inputs belong on agenda'] },
  'body.aql_result':   { must: ['125'],             blocks: ['4 defects in 125', 'Ac/Re table', 'ACCEPT or REJECT'] },
  'body.gmp':          { must: [],                  blocks: ['GMP requires CoA verification', 'enter material lot number'] },
  'body.motto_dis':    { must: ['ISO 9001'], motto: true, blocks: ['Quality Week banner', 'zero defects saves lives', 'plungers reach real patients', 'boxed motto', 'which ISO 9001 principle', 'hint: noticeboard'] },
  'body.motto_prod':   { must: ['AQL'],  motto: true, blocks: ['poster above AQL station', 'boxed motto', 'what beyond rejecting the batch'] },
  'body.motto_qa':     { must: ['NCR-0892'], motto: true, blocks: ['framed pledge signed by QA', 'boxed motto', 'who should have raised a deviation'] },

  // ── inventory / log content carrying controlled values ──
  'msg.station3_log':      { must: ['SN-7734', '12.50', '12.53', 'BN-2024-3200'] },
  'msg.station3_log_done': { must: ['SN-7734', '12.50', '12.53'] },
  'msg.equip_log':         { must: ['SN-7734'] },
  'msg.equip_log_done':    { must: ['SN-7734'] },
  'msg.maint_log_found':   { must: ['B-7', 'A-3', 'SOP-MAINT-009'] },
  'msg.pallet_hold':       { must: ['RM-4471', 'CoA'] },
  'msg.quarantine_cage':   { must: ['BN-2024-3200', 'NCR-0892'] },
  'item.batch_cert.desc':  { must: ['BN-2024-3200', 'CAPA-0112', 'ISO 13485'] },
  'item.maint_log.desc':   { must: ['B-7', 'A-3', 'SOP-MAINT-009'] },
  'item.capa_report.desc': { must: ['CAPA-0112', 'B-7', 'A-3'] },
  'item.cal_ref.desc':     { must: ['12.50'] },
  'note.station3_log':     { must: ['SN-7734', '12.50', '12.53'] },
  'note.cal_ref':          { must: ['12.50'] },
  'note.equip_log':        { must: ['SN-7734'] },
};

/** Question ↔ option group spec: 9 multiple-choice puzzles, 4 options each. */
const CHOICE_PUZZLES = [
  'capa_root', 'capa_prev', 'iso15378_1', 'iso15378_2',
  'iso9001_1', 'iso9001_2', 'motto_prod', 'motto_qa', 'motto_dis',
];
const CHOICE_LETTERS = ['a', 'b', 'c', 'd'];

/** Correct-answer index per puzzle, read from index.html (source of truth). */
function readCorrectAnswers() {
  const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const map = {};
  for (const p of CHOICE_PUZZLES) {
    const i = src.indexOf(`tChoices('${p}'`);
    if (i < 0) continue;
    // capture the choices array literal that follows
    const seg = src.slice(i, i + 2600);
    const correctIdx = [];
    const items = [...seg.matchAll(/\{\s*label:[\s\S]*?correct:\s*(true|false)/g)];
    items.slice(0, 4).forEach((m, idx) => { if (m[1] === 'true') correctIdx.push(idx); });
    map[p] = correctIdx;
  }
  return map;
}

/** Terminology glossary: one concept must map to one term inside a language. */
const GLOSSARY = {
  'zh-Hans': { micrometer: { canonical: '千分尺', forbidden: ['微米计', '微米計'] } },
  'zh-Hant': { micrometer: { canonical: '千分尺', forbidden: ['微米计', '微米計'] } },
};

// ── helpers ──────────────────────────────────────────────────────────────────
function hasIdentifier(text, id) {
  const s = normaliseForIdentifiers(text);
  if (s.includes(id)) return true;
  for (const alt of (IDENTIFIER_ALIASES[id] || [])) if (s.includes(alt)) return true;
  return false;
}
function tagCounts(s) {
  const c = {};
  for (const m of String(s).matchAll(/<(\/?)(\w+)/g)) {
    const t = m[2].toLowerCase();
    c[t] = (c[t] || 0) + 1;
  }
  return c;
}
function placeholders(s) {
  return [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
}

// ─────────────────────────────────────────────────────────────────────────────
// PER-LANGUAGE AUDIT
// ─────────────────────────────────────────────────────────────────────────────
function auditLanguage(lang, CORRECT) {
  const D = T[lang];
  const isEn = lang === 'en';

  // ── D1: key completeness & non-empty ──
  const missing = EN_KEYS.filter(k => !(k in D));
  const extra   = Object.keys(D).filter(k => !EN_KEYS.includes(k));
  const empty   = Object.entries(D).filter(([, v]) => v === null || v === undefined || String(v).trim() === '');
  if (!missing.length) ok(`[${lang}] D1a key set complete (${EN_KEYS.length} keys)`);
  else ko(`[${lang}] D1a missing keys`, `${missing.length}: ${missing.slice(0,8).join(', ')}`);
  if (!extra.length) ok(`[${lang}] D1b no orphan keys`);
  else ko(`[${lang}] D1b orphan keys`, `${extra.length}: ${extra.slice(0,8).join(', ')}`);
  if (!empty.length) ok(`[${lang}] D1c no empty values`);
  else ko(`[${lang}] D1c empty values`, `${empty.length}: ${empty.map(e=>e[0]).slice(0,8).join(', ')}`);

  // ── D3: controlled identifier preservation (canonical spec) ──
  const idLoss = [];
  for (const [key, spec] of Object.entries(SPEC)) {
    if (!spec.must || !spec.must.length) continue;
    const v = D[key];
    if (v === undefined) continue;
    for (const id of spec.must) {
      if (!hasIdentifier(v, id)) idLoss.push(`${key}::${id}`);
    }
  }
  if (!idLoss.length) ok(`[${lang}] D3 all controlled identifiers preserved (${Object.keys(SPEC).length} spec'd blocks)`);
  else ko(`[${lang}] D3 identifier loss`, `${idLoss.length}: ${idLoss.slice(0,10).join(', ')}`);

  // ── D2: semantic block loss — motto tail present where spec requires it ──
  const mottoLoss = [];
  for (const [key, spec] of Object.entries(SPEC)) {
    if (!spec.motto) continue;
    const v = String(D[key] ?? '');
    if (!v.includes('·')) mottoLoss.push(key);
  }
  if (!mottoLoss.length) ok(`[${lang}] D2a motto block present in all ${Object.values(SPEC).filter(s=>s.motto).length} motto-bearing blocks`);
  else ko(`[${lang}] D2a motto block missing (truncated tail)`, mottoLoss.join(', '));

  // ── D2b: relative-length truncation vs this language's own norm ──
  const ratios = [];
  for (const k of EN_KEYS) {
    const enLen = String(T.en[k]).length;
    if (enLen < 200) continue;
    ratios.push({ k, r: String(D[k] ?? '').length / enLen });
  }
  ratios.sort((a, b) => a.r - b.r);
  const median = ratios[Math.floor(ratios.length / 2)]?.r ?? 1;
  const floor  = median * 0.5;
  const short  = ratios.filter(x => x.r < floor);
  if (!short.length) ok(`[${lang}] D2b no length outliers (median ${median.toFixed(2)}, floor ${floor.toFixed(2)})`);
  else ko(`[${lang}] D2b truncation suspects`, short.map(s => `${s.k}(${s.r.toFixed(2)})`).join(', '));

  // ── D4: HTML structure parity ──
  const tagIssues = [];
  for (const k of EN_KEYS) {
    const a = tagCounts(T.en[k]), b = tagCounts(D[k] ?? '');
    for (const t of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if ((a[t] || 0) !== (b[t] || 0)) tagIssues.push(`${k}<${t}>${a[t]||0}/${b[t]||0}`);
    }
  }
  if (!tagIssues.length) ok(`[${lang}] D4 HTML structure matches canonical`);
  else ko(`[${lang}] D4 HTML tag divergence`, `${tagIssues.length}: ${tagIssues.slice(0,8).join(', ')}`);

  // ── D5: placeholder parity ──
  const phIssues = [];
  for (const k of EN_KEYS) {
    const a = placeholders(T.en[k]), b = placeholders(D[k] ?? '');
    if (JSON.stringify(a) !== JSON.stringify(b)) phIssues.push(`${k}[${a}]≠[${b}]`);
  }
  if (!phIssues.length) ok(`[${lang}] D5 interpolation placeholders match`);
  else ko(`[${lang}] D5 placeholder divergence`, `${phIssues.length}: ${phIssues.slice(0,8).join(', ')}`);

  // ── D6: answer options — presence, count, ordering, answer-ID stability ──
  const optIssues = [];
  for (const p of CHOICE_PUZZLES) {
    for (const L of CHOICE_LETTERS) {
      const k = `ch.${p}.${L}`;
      if (!(k in D)) { optIssues.push(`${k} missing`); continue; }
      if (String(D[k]).trim() === '') optIssues.push(`${k} empty`);
    }
  }
  if (!optIssues.length) ok(`[${lang}] D6a all ${CHOICE_PUZZLES.length}×4 = 36 answer options present`);
  else ko(`[${lang}] D6a option loss`, optIssues.slice(0,10).join(', '));

  // answer IDs are positional: tChoices maps ch.<p>.a→index0 … d→index3 and
  // spreads the original object, so `correct` cannot be reassigned by locale.
  const correctStable = CHOICE_PUZZLES.every(p => Array.isArray(CORRECT[p]) && CORRECT[p].length === 1);
  if (correctStable) ok(`[${lang}] D6b correct-answer index single & positional for all 9 puzzles`);
  else ko(`[${lang}] D6b correct-answer mapping`, JSON.stringify(CORRECT));

  // options must be distinct within a puzzle (a reorder/dup would break mapping)
  const dupIssues = [];
  for (const p of CHOICE_PUZZLES) {
    const labels = CHOICE_LETTERS.map(L => String(D[`ch.${p}.${L}`] ?? ''));
    if (new Set(labels).size !== 4) dupIssues.push(p);
  }
  if (!dupIssues.length) ok(`[${lang}] D6c all option labels distinct within each puzzle`);
  else ko(`[${lang}] D6c duplicate option labels`, dupIssues.join(', '));

  // ── D7: terminology consistency ──
  const gl = GLOSSARY[lang];
  if (gl) {
    const termIssues = [];
    for (const [concept, rule] of Object.entries(gl)) {
      const hits = [];
      for (const [k, v] of Object.entries(D)) {
        for (const bad of rule.forbidden) if (String(v).includes(bad)) hits.push(`${k}:${bad}`);
      }
      if (hits.length) termIssues.push(`${concept} → ${hits.length} non-canonical (${hits.slice(0,5).join(', ')})`);
    }
    if (!termIssues.length) ok(`[${lang}] D7 terminology canonical (${Object.keys(gl).join(', ')})`);
    else ko(`[${lang}] D7 terminology drift`, termIssues.join(' | '));
  } else {
    ok(`[${lang}] D7 no controlled-glossary conflicts declared`);
  }

  // ── D9: player-facing cost claims must match the implementation ──
  // useHint() deducts points only; a locale promising "−60s" would be lying to
  // the player. The truth is read from index.html, not hard-coded here.
  const idxSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const useHintFn = idxSrc.slice(idxSrc.indexOf('function useHint'), idxSrc.indexOf('function useHint') + 900);
  const hintCostsTime = /timerSec\s*(?:-=|=\s*Math\.max\([^)]*timerSec\s*-)/.test(useHintFn);
  const claimKeys = ['nav.hint_btn', 'start.rules_content', 'start.scoring_content'];
  const claims = [];
  for (const k of claimKeys) {
    const v = String(D[k] ?? '');
    if (k === 'start.scoring_content') {
      // 1,800 / 3,600 are legitimate max-bonus figures — inspect penalty cells only
      const cells = [...v.matchAll(/<td[^>]*color:var\(--danger\)[^>]*>([^<]*)<\/td>/g)].map(m => m[1]);
      if (cells.some(c => /60/.test(c))) claims.push(k);
    } else if (/60/.test(v)) claims.push(k);
  }
  if (hintCostsTime === (claims.length > 0)) {
    ok(`[${lang}] D9 hint cost claims match implementation (time cost: ${hintCostsTime ? 'yes' : 'no'})`);
  } else if (claims.length) {
    ko(`[${lang}] D9 advertises a hint time cost the game does not apply`, claims.join(', '));
  } else {
    ko(`[${lang}] D9 hint time cost applied but not disclosed`, 'useHint() deducts time; no locale string says so');
  }

  // ── D8: untranslated fallback ──
  if (!isEn) {
    const same = EN_KEYS.filter(k => String(T.en[k]).length > 80 && String(T.en[k]) === String(D[k]));
    if (!same.length) ok(`[${lang}] D8 no untranslated long strings`);
    else ko(`[${lang}] D8 untranslated fallback`, `${same.length}: ${same.slice(0,6).join(', ')}`);
  } else {
    ok(`[${lang}] D8 (source locale)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-LANGUAGE STRUCTURAL EQUALITY
// ─────────────────────────────────────────────────────────────────────────────
function auditCrossLanguageStructure(CORRECT) {
  section('Cross-language structural equality');

  const sizes = LANGS.map(l => Object.keys(T[l]).length);
  if (new Set(sizes).size === 1) ok(`X1 all ${LANGS.length} locales expose identical key count (${sizes[0]})`);
  else ko('X1 key-count divergence', LANGS.map((l,i)=>`${l}=${sizes[i]}`).join(', '));

  // every locale must render the same number of answer options
  const optCounts = LANGS.map(l => CHOICE_PUZZLES.reduce((n, p) =>
    n + CHOICE_LETTERS.filter(L => String(T[l][`ch.${p}.${L}`] ?? '').trim() !== '').length, 0));
  if (new Set(optCounts).size === 1 && optCounts[0] === 36) ok(`X2 all locales expose exactly 36 answer options`);
  else ko('X2 option-count divergence', LANGS.map((l,i)=>`${l}=${optCounts[i]}`).join(', '));

  // correct-answer index comes from index.html, shared by every locale
  const single = CHOICE_PUZZLES.filter(p => (CORRECT[p] || []).length === 1);
  if (single.length === CHOICE_PUZZLES.length) ok(`X3 exactly one correct option per puzzle, locale-independent (${CHOICE_PUZZLES.length}/9)`);
  else ko('X3 correct-answer mapping', JSON.stringify(CORRECT));

  // motto separator must exist in every locale's motto-bearing blocks
  const mottoKeys = Object.entries(SPEC).filter(([, s]) => s.motto).map(([k]) => k);
  const bad = [];
  for (const l of LANGS) for (const k of mottoKeys) if (!String(T[l][k] ?? '').includes('·')) bad.push(`${l}:${k}`);
  if (!bad.length) ok(`X4 motto block present in ${mottoKeys.length} blocks × ${LANGS.length} locales`);
  else ko('X4 motto block missing', `${bad.length}: ${bad.slice(0,12).join(', ')}`);

  // X5: no locale may be rendered a different number of task blocks. The task
  // prompt callout must not be gated on language — that made English render one
  // block fewer than every other locale for the same task (QA findings 4 & 10).
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const modalFn = idx.slice(idx.indexOf('function openModal'), idx.indexOf('function openModal') + 1200);
  const gated = /S\.lang\s*[!=]==?\s*['"]en['"]/.test(modalFn);
  if (!gated) ok('X5 task prompt callout renders for every locale (no language gate in openModal)');
  else ko('X5 task prompt gated by language', 'openModal() branches on S.lang — English renders fewer blocks');

  // X6: every question key referenced by a task must resolve in every locale
  const qKeys = [...idx.matchAll(/questionKey:\s*'([^']+)'/g)].map(m => m[1]);
  const uniqQ = [...new Set(qKeys)];
  const unresolved = [];
  for (const l of LANGS) for (const q of uniqQ) {
    const v = T[l][q];
    if (v === undefined || String(v).trim() === '') unresolved.push(`${l}:${q}`);
  }
  if (!unresolved.length) ok(`X6 all ${uniqQ.length} task prompts resolve in all ${LANGS.length} locales`);
  else ko('X6 unresolved task prompts', `${unresolved.length}: ${unresolved.slice(0,10).join(', ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// UI PARITY (optional, Playwright)
// ─────────────────────────────────────────────────────────────────────────────
async function auditUI(langs) {
  section('UI rendering parity');
  const { chromium } = require('playwright');
  const CHROMIUM = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const BASE = 'http://localhost:3000';
  const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true });
  try {
    for (const lang of langs) {
      const ctx  = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      try {
        await page.addInitScript(l => localStorage.setItem('qw_lang', l), lang);
        // The group list is fetched from the API; a cold or busy server can make
        // the first load slow. Retry once so a transient stall is not reported
        // as a localization defect.
        let loaded = false, lastErr;
        for (let attempt = 1; attempt <= 2 && !loaded; attempt++) {
          try {
            await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForFunction(
              () => document.getElementById('group-select')?.options.length > 1, { timeout: 30000 });
            loaded = true;
          } catch (e) { lastErr = e; await page.waitForTimeout(1000); }
        }
        if (!loaded) throw lastErr;

        // no raw translation keys leaked into the DOM
        const raw = await page.evaluate(() =>
          (document.body.innerText.match(/\b(?:login|start|room|body|msg|ch|q|hint|item|note|fb|end|lobby)\.[a-z_]+[a-z_.]*/gi) || []).slice(0, 5));
        if (!raw.length) ok(`[${lang}] U1 no raw translation keys in DOM`);
        else ko(`[${lang}] U1 raw keys leaked`, raw.join(', '));

        // direction
        const dir = await page.evaluate(() => document.documentElement.dir);
        const want = lang === 'he' ? 'rtl' : 'ltr';
        if (dir === want) ok(`[${lang}] U2 text direction ${dir}`);
        else ko(`[${lang}] U2 text direction`, `expected ${want}, got ${dir}`);

        // no horizontal overflow of the page body
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow <= 2) ok(`[${lang}] U3 no horizontal overflow`);
        else ko(`[${lang}] U3 horizontal overflow`, `${overflow}px`);

        // task prompt callout must render in this locale (QA findings 4 & 10)
        const prompt = await page.evaluate(() => {
          openModal({ tag: 'AUDIT', title: 'audit', body: '<p>n</p>',
                      questionKey: 'q.iso15378_2', noInput: true });
          const el = document.getElementById('modal-body').querySelector('.modal-prompt');
          const r = { has: !!el, len: el ? el.textContent.trim().length : 0 };
          closeModal();
          return r;
        });
        if (prompt.has && prompt.len > 8) ok(`[${lang}] U4 task prompt callout rendered (${prompt.len} chars)`);
        else ko(`[${lang}] U4 task prompt callout missing`, JSON.stringify(prompt));

        // every answer option must be rendered and visible for a choice task
        const opts = await page.evaluate(() => {
          openModal({ tag: 'AUDIT', title: 'audit', body: '<p>n</p>', questionKey: 'q.motto_dis',
                      choices: tChoices('motto_dis', [
                        { label: 'A', correct: false }, { label: 'B', correct: false },
                        { label: 'C', correct: true  }, { label: 'D', correct: false }]),
                      onChoice: () => {} });
          const btns = [...document.querySelectorAll('#modal-choices button')];
          const r = {
            count: btns.length,
            visible: btns.filter(b => b.offsetWidth > 0 && b.offsetHeight > 0).length,
            empty:   btns.filter(b => !b.textContent.trim()).length,
          };
          closeModal();
          return r;
        });
        if (opts.count === 4 && opts.visible === 4 && opts.empty === 0) {
          ok(`[${lang}] U5 all 4 answer options rendered and visible`);
        } else {
          ko(`[${lang}] U5 answer option rendering`, JSON.stringify(opts));
        }
      } catch (e) {
        ko(`[${lang}] UI fatal`, e.message);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  const argv    = process.argv.slice(2);
  const langArg = (argv.find(a => a.startsWith('--lang=')) || '').split('=')[1];
  const all     = argv.includes('--all') || !langArg;
  const withUI  = argv.includes('--ui');
  const targets = langArg ? [langArg] : LANGS;

  if (langArg && !LANGS.includes(langArg)) {
    console.error(`Unknown language "${langArg}". Known: ${LANGS.join(', ')}`);
    process.exit(2);
  }

  const CORRECT = readCorrectAnswers();

  process.stdout.write(`\n${'═'.repeat(64)}\n`);
  process.stdout.write(`LOCALIZATION AUDIT — ${targets.length === 1 ? targets[0] : `all ${targets.length} locales`}\n`);
  process.stdout.write(`${'═'.repeat(64)}\n`);

  for (const lang of targets) {
    section(`locale: ${lang}`);
    auditLanguage(lang, CORRECT);
  }

  if (all) auditCrossLanguageStructure(CORRECT);
  if (withUI) await auditUI(targets);

  const total = pass + fail;
  process.stdout.write(`\n${'═'.repeat(64)}\n`);
  process.stdout.write(`LOCALIZATION RESULT: ${pass}/${total} passed, ${fail} failed\n`);
  if (fail) {
    process.stdout.write('\nFAILURES:\n');
    failures.forEach((f, i) => process.stdout.write(`  ${i + 1}. ${f.label}\n     ${f.detail}\n`));
  }
  process.stdout.write(`${'═'.repeat(64)}\n`);
  process.exitCode = fail ? 1 : 0;
})();
