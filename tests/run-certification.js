'use strict';
/**
 * run-certification.js — drives the clean-pass certification.
 *
 *   node tests/run-certification.js --languages     17 × 3 consecutive clean
 *   node tests/run-certification.js --global        3 × 3 consecutive clean
 *   node tests/run-certification.js                 both, in order
 *
 * A pass counts only when it finishes with zero failures. Any failure resets
 * that language's streak to zero, and the streak must then be rebuilt from
 * scratch. Failed attempts are recorded but never counted toward the target.
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ROOT     = path.resolve(__dirname, '..');
const TARGET   = 3;
const MAX_TRIES = 8;          // guard against an unfixable loop
const LEDGER   = path.join(ROOT, 'tests', '.certification-ledger.json');

const LANGS = Object.keys(
  new Function(fs.readFileSync(path.join(ROOT, 'translations.js'), 'utf8') + '; return TRANSLATIONS;')()
);

function run(args, label) {
  const t0 = Date.now();
  const r = spawnSync('node', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const out  = (r.stdout || '') + (r.stderr || '');
  const m    = out.match(/(\d+)\/(\d+) passed, (\d+) failed/);
  const failed = m ? Number(m[3]) : (r.status === 0 ? 0 : -1);
  const passed = m ? Number(m[1]) : 0;
  const total  = m ? Number(m[2]) : 0;
  const clean  = r.status === 0 && failed === 0 && total > 0;
  if (!clean) {
    const lines = out.split('\n').filter(l => l.includes('✗')).slice(0, 10);
    process.stdout.write(`    ${label}: FAIL (${failed} failed, ${secs}s)\n`);
    lines.forEach(l => process.stdout.write('        ' + l.trim() + '\n'));
  } else {
    process.stdout.write(`    ${label}: PASS ${passed}/${total} (${secs}s)\n`);
  }
  return { clean, passed, total, failed, secs };
}

function certify(name, args) {
  let streak = 0, attempts = 0;
  const history = [];
  while (streak < TARGET && attempts < MAX_TRIES) {
    attempts++;
    const r = run(args, `attempt ${attempts} (streak ${streak}/${TARGET})`);
    history.push({ attempt: attempts, ...r, clean: r.clean });
    if (r.clean) streak++;
    else {
      if (streak > 0) process.stdout.write(`    ↺ streak reset ${streak} → 0\n`);
      streak = 0;
    }
  }
  const certified = streak >= TARGET;
  process.stdout.write(`  ${certified ? '✅' : '❌'} ${name}: ${streak}/${TARGET} consecutive clean` +
                       ` (${attempts} attempt${attempts === 1 ? '' : 's'})\n\n`);
  return { name, certified, streak, attempts, history };
}

(async () => {
  const argv    = process.argv.slice(2);
  const doLangs  = argv.includes('--languages') || argv.length === 0;
  const doGlobal = argv.includes('--global')    || argv.length === 0;
  const only     = (argv.find(a => a.startsWith('--only=')) || '').split('=')[1];

  const ledger = { startedAt: new Date().toISOString(), languages: [], global: null };
  const t0 = Date.now();

  if (doLangs) {
    const targets = only ? only.split(',') : LANGS;
    process.stdout.write(`\n${'█'.repeat(66)}\n`);
    process.stdout.write(`PHASE 1 — per-language certification (${targets.length} locales × ${TARGET} clean)\n`);
    process.stdout.write(`${'█'.repeat(66)}\n\n`);
    for (const lang of targets) {
      process.stdout.write(`── ${lang} ${'─'.repeat(Math.max(0, 56 - lang.length))}\n`);
      ledger.languages.push(certify(lang, [path.join('tests', 'language-audit.js'), `--lang=${lang}`]));
      fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
    }
  }

  if (doGlobal) {
    process.stdout.write(`\n${'█'.repeat(66)}\n`);
    process.stdout.write(`PHASE 2 — global certification (${TARGET} consecutive clean full-system passes)\n`);
    process.stdout.write(`${'█'.repeat(66)}\n\n`);
    ledger.global = certify('GLOBAL', [path.join('tests', 'global-audit.js')]);
    fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 2));
  }

  // ── report ────────────────────────────────────────────────────────────────
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  process.stdout.write(`${'█'.repeat(66)}\nCERTIFICATION SUMMARY  (${mins} min)\n${'█'.repeat(66)}\n\n`);

  let cleanLangPasses = 0, allCertified = true;
  if (ledger.languages.length) {
    for (const l of ledger.languages) {
      cleanLangPasses += l.streak;
      if (!l.certified) allCertified = false;
      const marks = l.history.map(h => h.clean ? '●' : '✗').join('');
      process.stdout.write(`  ${l.certified ? '✅' : '❌'} ${l.name.padEnd(9)} ${l.streak}/${TARGET}  [${marks}]\n`);
    }
    process.stdout.write(`\n  counted clean language passes: ${cleanLangPasses} / ${ledger.languages.length * TARGET}\n`);
  }
  if (ledger.global) {
    const marks = ledger.global.history.map(h => h.clean ? '●' : '✗').join('');
    process.stdout.write(`\n  ${ledger.global.certified ? '✅' : '❌'} GLOBAL    ${ledger.global.streak}/${TARGET}  [${marks}]\n`);
    if (!ledger.global.certified) allCertified = false;
  }

  const totalClean = cleanLangPasses + (ledger.global ? ledger.global.streak : 0);
  process.stdout.write(`\n  TOTAL COUNTED CLEAN PASSES: ${totalClean}\n`);
  process.stdout.write(`  ledger → ${path.relative(ROOT, LEDGER)}\n`);
  process.stdout.write(`${'█'.repeat(66)}\n`);
  process.exitCode = allCertified ? 0 : 1;
})();
