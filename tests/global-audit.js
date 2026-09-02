'use strict';
/**
 * global-audit.js — full-system audit across all 17 locales.
 *
 * Runs every suite in sequence and aggregates into a single result line so a
 * global pass is clean only when every constituent suite is clean. This is the
 * regression net for changes made while later locales were being repaired.
 *
 *   node tests/global-audit.js
 */

const { spawnSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const ROOT = path.resolve(__dirname, '..');

const SUITES = [
  { name: 'localization parity — all 17 locales + UI',
    args: ['tests/localization-audit.js', '--all', '--ui'] },
  { name: 'groups, scoreboard, locking, reset, scoring',
    args: ['tests/comprehensive-audit.js'] },
  { name: 'scoring model regression',
    args: ['tests/scoring-tests.js'] },
  { name: 'end-to-end game flow (103 checks)',
    args: ['tests/full-audit.js'] },
  { name: 'layout & scroll reachability — 17 locales × 8 viewports',
    args: ['tests/layout-audit.js'] },
  { name: 'real-player entry journey — 17 locales, three live teammates',
    args: ['tests/journey-audit.js'] },
  { name: 'backup & restore safety — results can never be lost or overwritten',
    args: ['tests/backup-restore.js'] },
  { name: 'static exposure — nothing private reachable over plain HTTP',
    args: ['tests/static-exposure.js'] },
  { name: 'append-only results log — a result survives reset and replay',
    args: ['tests/results-log.js'] },
];

/** Static checks that need no runtime: syntax + structural invariants. */
function staticChecks() {
  const out = [];
  const chk = (label, fn) => {
    try { const r = fn(); out.push({ label, ok: r === true, detail: r === true ? '' : String(r) }); }
    catch (e) { out.push({ label, ok: false, detail: e.message }); }
  };

  chk('translations.js parses and exposes 17 locales', () => {
    const T = new Function(fs.readFileSync(path.join(ROOT, 'translations.js'), 'utf8') + '; return TRANSLATIONS;')();
    const n = Object.keys(T).length;
    return n === 17 || `got ${n}`;
  });
  chk('server.js parses', () => {
    const r = spawnSync('node', ['--check', 'server.js'], { cwd: ROOT, encoding: 'utf8' });
    return r.status === 0 || r.stderr.trim();
  });
  chk('translations.js passes node --check', () => {
    const r = spawnSync('node', ['--check', 'translations.js'], { cwd: ROOT, encoding: 'utf8' });
    return r.status === 0 || r.stderr.trim();
  });
  chk('every test file parses', () => {
    for (const f of fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.js'))) {
      const r = spawnSync('node', ['--check', path.join('tests', f)], { cwd: ROOT, encoding: 'utf8' });
      if (r.status !== 0) return `${f}: ${r.stderr.trim()}`;
    }
    return true;
  });
  chk('index.html has balanced <script> tags', () => {
    const s = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const o = (s.match(/<script\b/g) || []).length, c = (s.match(/<\/script>/g) || []).length;
    return o === c || `${o} open vs ${c} close`;
  });
  chk('data/groups.json is valid JSON with 256 groups', () => {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'groups.json'), 'utf8'));
    return d.groups.length === 256 || `got ${d.groups.length}`;
  });
  return out;
}

(async () => {
  const t0 = Date.now();
  process.stdout.write(`\n${'═'.repeat(66)}\nGLOBAL AUDIT — all locales, all suites\n${'═'.repeat(66)}\n`);

  let pass = 0, fail = 0;
  const failed = [];

  process.stdout.write('\n── static checks ──\n');
  for (const c of staticChecks()) {
    if (c.ok) { pass++; process.stdout.write('  ✓ ' + c.label + '\n'); }
    else { fail++; failed.push(c.label + ' — ' + c.detail); process.stdout.write('  ✗ ' + c.label + '\n      → ' + c.detail + '\n'); }
  }

  for (const s of SUITES) {
    process.stdout.write(`\n── ${s.name} ──\n`);
    const t = Date.now();
    const r = spawnSync('node', s.args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const out = (r.stdout || '') + (r.stderr || '');
    const m = out.match(/(\d+)\/(\d+) passed,\s*(\d+) failed/);
    const secs = ((Date.now() - t) / 1000).toFixed(1);
    if (m) {
      const [, p, tot, f] = m.map(Number);
      pass += p; fail += f;
      if (f === 0 && r.status === 0) process.stdout.write(`  ✓ ${p}/${tot} passed (${secs}s)\n`);
      else {
        process.stdout.write(`  ✗ ${p}/${tot} passed, ${f} failed (${secs}s)\n`);
        out.split('\n').filter(l => l.includes('✗')).slice(0, 12).forEach(l => {
          const line = l.trim(); failed.push(line); process.stdout.write('      ' + line + '\n');
        });
      }
    } else {
      fail++; failed.push(`${s.name}: no result line (exit ${r.status})`);
      process.stdout.write(`  ✗ no result line, exit ${r.status} (${secs}s)\n`);
      out.split('\n').slice(-12).forEach(l => l.trim() && process.stdout.write('      ' + l + '\n'));
    }
  }

  const total = pass + fail;
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  process.stdout.write(`\n${'═'.repeat(66)}\n`);
  process.stdout.write(`GLOBAL AUDIT: ${pass}/${total} passed, ${fail} failed  (${mins} min)\n`);
  if (fail) { process.stdout.write('\nFAILURES:\n'); failed.slice(0, 30).forEach((f, i) => process.stdout.write(`  ${i + 1}. ${f}\n`)); }
  process.stdout.write(`${'═'.repeat(66)}\n`);
  process.exitCode = fail ? 1 : 0;
})();
