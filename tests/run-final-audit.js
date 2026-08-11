'use strict';
/**
 * run-final-audit.js — three consecutive clean full audits.
 *
 * A full audit is one complete pass of tests/global-audit.js, which covers all
 * 17 locales across: content parity + UI, layout/scroll reachability over eight
 * viewports, the real-player entry journey with three live teammates, all 256
 * groups, locking, Group 256 replay, admin reset, the scoreboard and its score
 * breakdown, the scoring model, persistence, and the static gate.
 *
 * The streak is strict: any failure aborts the sequence, because after a fix
 * every pass has to be re-earned from Audit 1.
 */
const { spawnSync } = require('child_process');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const TARGET = 3;
const LOGDIR = path.join(ROOT, 'tests', 'failure-logs');

(async () => {
  fs.mkdirSync(LOGDIR, { recursive: true });
  const t0 = Date.now();
  process.stdout.write(`\n${'█'.repeat(70)}\nFINAL AUDIT — ${TARGET} consecutive clean full audits required\n${'█'.repeat(70)}\n\n`);

  let streak = 0; const log = [];
  for (let n = 1; n <= TARGET; n++) {
    const t = Date.now();
    const r = spawnSync('node', ['tests/global-audit.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    const out = (r.stdout || '') + (r.stderr || '');
    const m = out.match(/GLOBAL AUDIT: (\d+)\/(\d+) passed,\s*(\d+) failed/);
    const secs = ((Date.now() - t) / 1000).toFixed(0);
    const clean = r.status === 0 && m && Number(m[3]) === 0;
    if (clean) {
      streak++;
      log.push({ n, result: 'PASS', passed: +m[1], total: +m[2], secs });
      process.stdout.write(`  Final Full Audit ${n} — PASS  ${m[1]}/${m[2]}  (${secs}s)   streak ${streak}/${TARGET}\n`);
    } else {
      const p = path.join(LOGDIR, `final-audit-${n}.log`);
      fs.writeFileSync(p, out);
      process.stdout.write(`\n  Final Full Audit ${n} — FAIL (${m ? m[3] : '?'} failed, ${secs}s)\n`);
      out.split('\n').filter(l => l.includes('✗')).slice(0, 12).forEach(l => process.stdout.write(`      ${l.trim()}\n`));
      process.stdout.write(`      transcript → ${path.relative(ROOT, p)}\n`);
      process.stdout.write(`\n  Streak reset ${streak} → 0. Fix, then restart from Audit 1.\n`);
      log.push({ n, result: 'FAIL', secs });
      streak = 0;
      break;
    }
  }

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  fs.writeFileSync(path.join(ROOT, 'tests', '.final-audit-ledger.json'), JSON.stringify({ streak, log }, null, 2));
  process.stdout.write(`\n${'█'.repeat(70)}\n`);
  process.stdout.write(streak === TARGET
    ? `FINAL CLEAN AUDIT STREAK: ${streak} / ${TARGET} — consecutive, zero errors, zero corrections\n`
    : `NOT COMPLETE — streak ${streak}/${TARGET}\n`);
  process.stdout.write(`elapsed ${mins} min\n${'█'.repeat(70)}\n`);
  process.exitCode = streak === TARGET ? 0 : 1;
})();
