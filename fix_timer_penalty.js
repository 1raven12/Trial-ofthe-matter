'use strict';
// Fix script: 25→30 min in briefings/how_content, −10→−50 in scoring
const fs = require('fs');
const file = 'translations.js';
let src = fs.readFileSync(file, 'utf8');

// ── 1. end.wrong_n: × −10 → × −50 (all languages) ──────────────────────────
src = src.replace(/(\{n\} × −)10\)/g, '$150)');
// Hebrew RTL: 10− → 50−
src = src.replace(/(\{n\} × )10−\)/g, '$150−)');

// ── 2. Scoring content wrong answer rows: −10 → −50 ─────────────────────────
// Korean scoring: −10점
src = src.replace(/>−10점<\/td>(\s*<\/tr>\s*<tr style=""><td[^>]*>💡)/g, '>−50점</td>$1');
// zh-Hans: −10分 (scoring table)
src = src.replace(/>−10分<\/td>(\s*<\/tr>\s*<tr style=""><td[^>]*>💡 使用提示)/g, '>−50分</td>$1');
// zh-Hant: −10分 (scoring table)
src = src.replace(/>−10分<\/td>(\s*<\/tr>\s*<tr style=""><td[^>]*>💡 使用提示)/g, '>−50分</td>$1');
// Malay: −10 mata
src = src.replace(/>−10 mata<\/td>(\s*<\/tr>\s*<tr style=""><td[^>]*>💡)/g, '>−50 mata</td>$1');
// Hindi: −10 अंक
src = src.replace(/>−10 अंक<\/td>(\s*<\/tr>\s*<tr style=""><td[^>]*>💡)/g, '>−50 अंक</td>$1');
// sr-Latn: −10 bod.
src = src.replace(/>−10 bod\.<\/td>(\s*<\/tr>\s*<tr style=""><td[^>]*>💡)/g, '>−50 bod.</td>$1');
// sr-Cyrl: −10 бод.
src = src.replace(/>−10 бод\.<\/td>(\s*<\/tr>\s*<tr style=""><td[^>]*>💡)/g, '>−50 бод.</td>$1');

// ── 3. sr-Latn rules_content: 10 bodova → 50 bodova ─────────────────────────
src = src.replace(/>10 bodova<\/strong>/g, '>50 bodova</strong>');

// ── 4. Briefing: 25 → 30 min in specific languages ──────────────────────────
// German: 25 Minuten → 30 Minuten
src = src.replace(/FDA-Prüfer in 25 Minuten eintrifft/, 'FDA-Prüfer in 30 Minuten eintrifft');
// pt-BR: 25 minutos → 30 minutos (briefing)
src = src.replace(/FDA chegar em 25 minutos/, 'FDA chegar em 30 minutos');
// French: 25 minutes → 30 minutes (briefing)
src = src.replace(/FDA externe dans 25 minutes/, 'FDA externe dans 30 minutes');
// Korean: 25분 → 30분 (briefing)
src = src.replace(/FDA 감사관이 25분 후/, 'FDA 감사관이 30분 후');
// zh-Hans: 25 分钟 → 30 分钟 (briefing)
src = src.replace(/FDA 审计员 25 分钟后到达之前/, 'FDA 审计员 30 分钟后到达之前');
// zh-Hant: 25 分鐘 → 30 分鐘 (briefing)
src = src.replace(/FDA 稽核員 25 分鐘後到達之前/, 'FDA 稽核員 30 分鐘後到達之前');
// sr-Latn: 25 minuta → 30 minuta (briefing)
src = src.replace(/FDA auditor stigne za 25 minuta/, 'FDA auditor stigne za 30 minuta');
// sr-Cyrl: 25 минута → 30 минута (briefing)
src = src.replace(/FDA аудитор стигне за 25 минута/, 'FDA аудитор стигне за 30 минута');

// ── 5. how_content: 25 → 30 min in specific languages ───────────────────────
// French how_content
src = src.replace(/compléter en <strong style="color:var\(--text\);">25 minutes<\/strong>/,
  'compléter en <strong style="color:var(--text);">30 minutes</strong>');
// Korean how_content
src = src.replace(/완료해야 합니다\. 구역은 진행하면서 잠금 해제됩니다/,
  (m) => m); // Korean already correct after briefing fix... let me check
// Actually let me just fix the Korean how_content directly:
src = src.replace(/<strong style="color:var\(--text\);">25분<\/strong> 안에 완료해야/,
  '<strong style="color:var(--text);">30분</strong> 안에 완료해야');
// zh-Hans how_content
src = src.replace(/需要在 <strong style="color:var\(--text\);">25分钟<\/strong> 内完成/,
  '需要在 <strong style="color:var(--text);">30分钟</strong> 内完成');
// zh-Hant how_content
src = src.replace(/需要在 <strong style="color:var\(--text\);">25分鐘<\/strong> 內完成/,
  '需要在 <strong style="color:var(--text);">30分鐘</strong> 內完成');
// Hindi how_content
src = src.replace(/<strong style="color:var\(--text\);">25 मिनट<\/strong> में पूरी करनी/,
  '<strong style="color:var(--text);">30 मिनट</strong> में पूरी करनी');
// sr-Latn how_content
src = src.replace(/završiti za <strong style="color:var\(--text\);">25 minuta<\/strong>\. Oblast/,
  'završiti za <strong style="color:var(--text);">30 minuta</strong>. Oblast');
// sr-Cyrl how_content
src = src.replace(/завршити за <strong style="color:var\(--text\);">25 минута<\/strong>\. Област/,
  'завршити за <strong style="color:var(--text);">30 минута</strong>. Област');

fs.writeFileSync(file, src);
console.log('Done. Verifying...');

// Verify no more 25-minute references in briefings/how_content
const remaining = [];
const lines = src.split('\n');
lines.forEach((line, i) => {
  if (/25 [Mm]inuten|25 minutos|25 minutes|25분|25 分钟|25 分鐘|25 minuta|25 минута|25 मिनट/.test(line)) {
    remaining.push(`  Line ${i+1}: ${line.trim().slice(0,80)}`);
  }
});
if (remaining.length === 0) {
  console.log('✓ No remaining 25-minute references in briefings/how_content');
} else {
  console.log('⚠ Remaining 25-minute references:');
  remaining.forEach(r => console.log(r));
}

// Verify no more × −10 in end.wrong_n
const wrongN = lines.filter(l => l.includes('end.wrong_n') && l.includes('−10'));
if (wrongN.length === 0) {
  console.log('✓ All end.wrong_n updated to −50');
} else {
  console.log('⚠ Remaining end.wrong_n with −10:', wrongN.length);
  wrongN.forEach(l => console.log(' ', l.trim().slice(0,80)));
}
