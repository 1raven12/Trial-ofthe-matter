'use strict';
/**
 * run-certification.js — drives the 54-consecutive-clean-pass requirement.
 *
 *   node tests/run-certification.js
 *
 * The sequence is 17 languages × 3 passes in a frozen order (English first),
 * followed by 3 full-system passes: 54 in total.
 *
 * The streak is global, not per-language. A single failure anywhere ends the
 * whole sequence: the run aborts immediately so the defect can be fixed,
 * because every pass after a fix has to be re-earned from Pass 1. Passes
 * already banked before the failure do not count toward the final 54.
 *
 * Nothing else may touch the server or data/groups.json while this runs — the
 * suites drive the trial group and rewrite the group fixture, so a concurrent
 * audit corrupts both.
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ROOT   = path.resolve(__dirname, '..');
const TARGET = 54;
const PER_LANG = 3, GLOBAL_PASSES = 3;
const LEDGER = path.join(ROOT, 'tests', '.certification-ledger.json');
const LOGDIR = path.join(ROOT, 'tests', 'failure-logs');

// Frozen order: object key order in translations.js, English first.
const LANGS = Object.keys(
  new Function(fs.readFileSync(path.join(ROOT, 'translations.js'), 'utf8') + '; return TRANSLATIONS;')()
);

function runPass(args, label) {
  const t0 = Date.now();
  const r = spawnSync('node', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const out = (r.stdout || '') + (r.stderr || '');
  const m = out.match(/(\d+)\/(\d+) passed,\s*(\d+) failed/);
  const passed = m ? Number(m[1]) : 0;
  const total  = m ? Number(m[2]) : 0;
  const failed = m ? Number(m[3]) : -1;
  const clean  = r.status === 0 && failed === 0 && total > 0;
  const reasons = out.split('\n').filter(l => l.includes('✗')).map(l => l.trim()).slice(0, 12);
  return { label, clean, passed, total, failed, secs, out, reasons };
}

(async () => {
  const t0 = Date.now();
  fs.mkdirSync(LOGDIR, { recursive: true });

  const plan = [];
  for (const lang of LANGS) {
    for (let i = 1; i <= PER_LANG; i++) {
      plan.push({ kind: 'lang', lang, n: i, label: `${lang} P${i}`,
                  args: [path.join('tests', 'language-audit.js'), `--lang=${lang}`] });
    }
  }
  for (let i = 1; i <= GLOBAL_PASSES; i++) {
    plan.push({ kind: 'global', n: i, label: `Global P${i}`,
                args: [path.join('tests', 'global-audit.js')] });
  }

  process.stdout.write(`\n${'█'.repeat(70)}\n`);
  process.stdout.write(`CERTIFICATION — ${TARGET} consecutive clean passes required\n`);
  process.stdout.write(`${LANGS.length} languages × ${PER_LANG} + ${GLOBAL_PASSES} global, frozen order, English first\n`);
  process.stdout.write(`${'█'.repeat(70)}\n\n`);

  let streak = 0;
  const log = [];
  let broke = null;

  for (const step of plan) {
    const r = runPass(step.args, step.label);
    if (r.clean) {
      streak++;
      log.push({ label: step.label, result: 'PASS', streak, passed: r.passed, total: r.total, secs: r.secs });
      process.stdout.write(`  ${String(streak).padStart(2)}/54  ${step.label.padEnd(14)} PASS  ${r.passed}/${r.total}  (${r.secs}s)\n`);
    } else {
      const slug = step.label.replace(/[^\w.-]+/g, '_');
      const logPath = path.join(LOGDIR, `${slug}.log`);
      fs.writeFileSync(logPath, r.out);
      log.push({ label: step.label, result: 'FAIL', streakBefore: streak, failed: r.failed,
                 secs: r.secs, reasons: r.reasons, transcript: path.relative(ROOT, logPath) });
      process.stdout.write(`\n  ✗ ${step.label} FAILED after ${streak} clean passes (${r.failed} failed, ${r.secs}s)\n`);
      r.reasons.forEach(l => process.stdout.write(`      ${l}\n`));
      process.stdout.write(`      transcript → ${path.relative(ROOT, logPath)}\n`);
      process.stdout.write(`\n  Streak reset ${streak} → 0. The sequence must restart from Pass 1 (${LANGS[0]} P1).\n`);
      broke = { at: step.label, after: streak, reasons: r.reasons };
      streak = 0;
      break;   // abort: every later pass would have to be re-earned anyway
    }
    fs.writeFileSync(LEDGER, JSON.stringify({ startedAt: new Date(t0).toISOString(), streak, log, broke }, null, 2));
  }

  fs.writeFileSync(LEDGER, JSON.stringify({ startedAt: new Date(t0).toISOString(), streak, log, broke }, null, 2));

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  process.stdout.write(`\n${'█'.repeat(70)}\n`);
  if (streak === TARGET) {
    process.stdout.write(`CERTIFIED — ${streak}/${TARGET} consecutive clean passes, no failure in the sequence\n`);
  } else if (broke) {
    process.stdout.write(`NOT CERTIFIED — sequence broke at ${broke.at} after ${broke.after} clean passes\n`);
  } else {
    process.stdout.write(`INCOMPLETE — ${streak}/${TARGET}\n`);
  }
  process.stdout.write(`elapsed ${mins} min · ledger → ${path.relative(ROOT, LEDGER)}\n`);
  process.stdout.write(`${'█'.repeat(70)}\n`);
  process.exitCode = streak === TARGET ? 0 : 1;
})();
