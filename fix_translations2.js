#!/usr/bin/env node
'use strict';
const fs = require('fs');
const FILE = __dirname + '/translations.js';
let src = fs.readFileSync(FILE, 'utf8');

function insertAfter(text, anchor, insertion) {
  const idx = text.indexOf(anchor);
  if (idx === -1) { console.error('ANCHOR NOT FOUND:', anchor.slice(0, 80)); return text; }
  return text.slice(0, idx + anchor.length) + '\n' + insertion + text.slice(idx + anchor.length);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: Add msg.member_left to all 15 languages
// ═══════════════════════════════════════════════════════════════════════════
const memberLeftPairs = [
  // [joined_anchor, left_line]
  ["    'msg.member_joined':      '👋 {name} joined your group!',",
   "    'msg.member_left':        '↩ {name} left the team.',"],
  ["    'msg.member_joined':      '👋 {name} ist Ihrer Gruppe beigetreten!',",
   "    'msg.member_left':        '↩ {name} hat das Team verlassen.',"],
  ["    'msg.member_joined':      '👋 ¡{name} se ha unido a tu grupo!',",
   "    'msg.member_left':        '↩ {name} ha abandonado el equipo.',"],
  ["    'msg.member_joined':      '👋 {name} entrou no seu grupo!',",
   "    'msg.member_left':        '↩ {name} saiu da equipe.',"],
  ["    'msg.member_joined':      '👋 {name} a rejoint votre groupe !',",
   "    'msg.member_left':        '↩ {name} a quitté l\\'équipe.',"],
  ["    'msg.member_joined':      '👋 {name}이(가) 그룹에 참가했습니다!',",
   "    'msg.member_left':        '↩ {name}이(가) 팀에서 나갔습니다.',"],
  // zh-Hans (no da entry — da falls back)
  ["    'msg.member_joined':      '👋 {name}加入了您的小组！',",
   "    'msg.member_left':        '↩ {name}离开了队伍。',"],
  ["    'msg.member_joined':      '👋 {name}加入了您的小組！',",
   "    'msg.member_left':        '↩ {name}離開了隊伍。',"],
  ["    'msg.member_joined':      '👋 {name} telah menyertai kumpulan anda!',",
   "    'msg.member_left':        '↩ {name} telah meninggalkan pasukan.',"],
  ["    'msg.member_joined':      '👋 {name} உங்கள் குழுவில் சேர்ந்தார்!',",
   "    'msg.member_left':        '↩ {name} குழுவை விட்டு சென்றார்.',"],
  // hi — different indentation
  ["    'msg.member_joined':     '👋 {name} आपके समूह में शामिल हुए!',",
   "    'msg.member_left':       '↩ {name} टीम छोड़ गए।',"],
  // sr-Latn
  ["    'msg.member_joined':      '👋 {name} se pridružio/la vašoj grupi!',",
   "    'msg.member_left':        '↩ {name} je napustio/la tim.',"],
  // sr-Cyrl — different indentation
  ["    'msg.member_joined': '👋 {name} се придружио/ла вашој групи!',",
   "    'msg.member_left': '↩ {name} је напустио/ла тим.',"],
  // he — different indentation
  ["    'msg.member_joined':     '👋 {name} הצטרף לקבוצתך!',",
   "    'msg.member_left':       '↩ {name} עזב את הצוות.',"],
];

for (const [anchor, leftLine] of memberLeftPairs) {
  if (src.indexOf(anchor) === -1) {
    console.warn('member_joined anchor not found:', anchor.slice(0,70));
    continue;
  }
  if (src.indexOf(leftLine.split(':')[0].trim()) !== -1) {
    console.log('msg.member_left already present near:', anchor.slice(0,50));
    continue;
  }
  src = insertAfter(src, anchor, leftLine);
  console.log('Added member_left for:', anchor.slice(20, 60));
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: Add end.hq_breakdown_h to all 15 languages (after end.new_game)
// ═══════════════════════════════════════════════════════════════════════════
const hqBreakdownPairs = [
  ["    'end.new_game': '↺ New Game',",
   "    'end.hq_breakdown_h':     'Hidden Question Results',"],
  ["    'end.new_game': '↺ Neues Spiel',",
   "    'end.hq_breakdown_h':     'Ergebnisse der versteckten Fragen',"],
  ["    'end.new_game': '↺ Nuevo Juego',",
   "    'end.hq_breakdown_h':     'Resultados de preguntas ocultas',"],
  ["    'end.new_game': '↺ Novo Jogo',",
   "    'end.hq_breakdown_h':     'Resultados das Perguntas Ocultas',"],
  ["    'end.new_game': '↺ Nouveau jeu',",
   "    'end.hq_breakdown_h':     'Résultats des questions cachées',"],
  ["    'end.new_game': '↺ 새 게임',",
   "    'end.hq_breakdown_h':     '숨겨진 질문 결과',"],
  ["    'end.new_game': '↺ Nyt spil',",
   "    'end.hq_breakdown_h':     'Resultater af skjulte spørgsmål',"],
  ["    'end.new_game': '↺ 新游戏',",
   "    'end.hq_breakdown_h':     '隐藏问题结果',"],
  ["    'end.new_game': '↺ 新遊戲',",
   "    'end.hq_breakdown_h':     '隱藏問題結果',"],
  ["    'end.new_game': '↺ Permainan Baru',",
   "    'end.hq_breakdown_h':     'Keputusan Soalan Tersembunyi',"],
  ["    'end.new_game': '↺ புதிய விளையாட்டு',",
   "    'end.hq_breakdown_h':     'மறைந்த கேள்வி முடிவுகள்',"],
  ["    'end.new_game': '↺ नया गेम',",
   "    'end.hq_breakdown_h':     'छिपे हुए प्रश्न परिणाम',"],
  ["    'end.new_game': '↺ Nova igra',",
   "    'end.hq_breakdown_h':     'Rezultati skrivenih pitanja',"],
  ["    'end.new_game': '↺ Нова игра',",
   "    'end.hq_breakdown_h':     'Резултати скривених питања',"],
  ["    'end.new_game': '↺ משחק חדש',",
   "    'end.hq_breakdown_h':     'תוצאות שאלות נסתרות',"],
];

for (const [anchor, hqLine] of hqBreakdownPairs) {
  if (src.indexOf(anchor) === -1) {
    console.warn('end.new_game anchor not found:', anchor.slice(0,60));
    continue;
  }
  if (src.indexOf("'end.hq_breakdown_h'", src.indexOf(anchor) - 10) !== -1 &&
      src.indexOf("'end.hq_breakdown_h'", src.indexOf(anchor)) < src.indexOf(anchor) + 200) {
    console.log('hq_breakdown_h already present for:', anchor.slice(0,40));
    continue;
  }
  // Check if already inserted
  const afterAnchor = src.slice(src.indexOf(anchor) + anchor.length, src.indexOf(anchor) + anchor.length + 200);
  if (afterAnchor.indexOf('hq_breakdown_h') !== -1) {
    console.log('hq_breakdown_h already after anchor:', anchor.slice(0,40));
    continue;
  }
  src = insertAfter(src, anchor, hqLine);
  console.log('Added hq_breakdown_h after:', anchor.slice(0,50));
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: Fix sr-Cyrl — add 27 keys (anchor was wrong in previous script)
// ═══════════════════════════════════════════════════════════════════════════
const srCyrlAnchorCandidates = [
  "    'hq.hq_dispatch.d':                            'Препеците — топлота убија бактерије и чини га безбедним.',",
  "    'hq.hq_dispatch.d':  'Препеците — топлота убија бактерије и чини га безбедним.',",
];

let srCyrlFound = false;
for (const candidate of srCyrlAnchorCandidates) {
  if (src.indexOf(candidate) !== -1) {
    const afterCandidate = src.slice(src.indexOf(candidate) + candidate.length, src.indexOf(candidate) + candidate.length + 300);
    if (afterCandidate.indexOf("'login.group_size'") !== -1) {
      console.log('sr-Cyrl 27 keys already present');
      srCyrlFound = true;
      break;
    }
    const keys = `    'login.group_size':         'Колико особа је у вашој групи?',
    'login.group_size_ph':      '— Одабери величину групе —',
    'login.group_size_3':       '3 играча',
    'login.group_size_4':       '4 играча',
    'login.group_size_5':       '5 играча',
    'login.group_size_error':   'Молимо одаберите величину групе (3, 4 или 5).',
    'login.size_mismatch':      'Ова група је већ подесила {required} играча.',
    'login.group_full':         'Ова група је већ пуна ({required} играча је повезано).',
    'login.roster_locked':      'Сесија је почела. Само оригинални чланови тима се могу поново придружити.',
    'login.permanently_locked': 'Ова група је већ завршила игру. Резултати су коначни.',
    'lobby.need_exact':         'Чекамо још {needed} играча/е.',
    'lobby.connected_of':       'повезаних',
    'lobby.all_ready':          'Сви играчи су повезани! Сви кликните Спреман да бисте почели.',
    'lobby.wrong_count':        'Потребно је тачно {required} играча. Тренутно {online} повезаних.',
    'lobby.too_many':           'Превише играча. Очекивано {required}, добијено {online}.',
    'pause.title':              'ИГРА ПАУЗИРАНА',
    'pause.body':               '{name} се искључио/ла. Ова сесија захтева {total} играча. Чекамо да се сви врате.',
    'pause.waiting_for':        'Чекамо: {names}',
    'pause.resumed':            '✓ Сви играчи су се вратили! Игра се наставља…',
    'msg.your_task_done':       '✓ Завршили сте овај задатак. Чекам саиграче…',
    'msg.team_progress':        '{done} / {total} играча је завршило овај задатак.',
    'msg.all_players_done':     '✓ Сви играчи су завршили: {label}',
    'log.all_players_done':     '✓ Сви играчи су завршили: {label}',
    'msg.missing_tasks':        'Нешто вам недостаје у овој соби.',
    'msg.incomplete_tasks':     'Молимо завршите све обавезне интеракције пре наставка.',
    'msg.pin_incomplete':       'Коначни PIN је тачан, али ваша група још није завршила све обавезне задатке.',
    'rules.english_answers':    'Неки одговори морају бити укуцани на енглеском тачно онако како је приказано (нпр. број серије, ACCEPT/REJECT). Поља с разликом великих/малих слова су назначена у питању.',`;
    src = insertAfter(src, candidate, keys);
    console.log('Inserted 27 keys for sr-Cyrl');
    srCyrlFound = true;
    break;
  }
}
if (!srCyrlFound) {
  // Try finding the dispatch block in sr-Cyrl section
  const srCyrlStart = src.indexOf("  'sr-Cyrl': {");
  if (srCyrlStart === -1) { console.error('sr-Cyrl section not found'); }
  else {
    console.log('sr-Cyrl section found at position', srCyrlStart);
    // Find hq_dispatch.d in this section
    const dispatchIdx = src.indexOf('hq_dispatch.d', srCyrlStart);
    if (dispatchIdx !== -1) {
      const lineEnd = src.indexOf('\n', dispatchIdx);
      const anchor = src.slice(src.lastIndexOf('\n', dispatchIdx) + 1, lineEnd);
      console.log('sr-Cyrl dispatch.d anchor:', anchor.slice(0,80));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: Update rules_content in remaining languages (de, es, fr, ko, ms, ta, hi, he)
// ═══════════════════════════════════════════════════════════════════════════
const TEAM_CONFIRM_ROW_RE = /<tr[^>]*>[\s]*<td[^>]*>🔑<\/td>[\s]*<td[^>]*>.*?<\/td>[\s]*<\/tr>/gs;

const newRowsByLang = {
  de: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Individuelle Anforderung:</strong> Jeder Spieler muss jede Aufgabe unabhängig abschließen.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Pause bei Trennung:</strong> Wenn ein Teammitglied die Verbindung verliert, pausiert das Spiel automatisch.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Versteckte Fragen:</strong> Jeder Raum enthält eine Bonusfrage für Extrapunkte.</td></tr>',
  es: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Requisito individual:</strong> Cada jugador debe completar independientemente cada tarea.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Pausa por desconexión:</strong> Si un miembro se desconecta, el juego se pausa automáticamente.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Preguntas ocultas:</strong> Cada sala tiene una pregunta de bonificación.</td></tr>',
  fr: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Exigence individuelle:</strong> Chaque joueur doit accomplir chaque tâche indépendamment.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Pause sur déconnexion:</strong> Le jeu se met en pause si un membre se déconnecte.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Questions cachées:</strong> Chaque salle contient une question bonus.</td></tr>',
  ko: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">개인 완수 요건:</strong> 모든 플레이어가 각 과제를 독립적으로 완료해야 합니다.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">연결 끊김 시 일시정지:</strong> 팀원이 연결이 끊기면 게임이 자동으로 일시정지됩니다.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">숨겨진 질문:</strong> 각 방에는 보너스 질문이 있습니다.</td></tr>',
  ms: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Keperluan individu:</strong> Setiap pemain mesti menyelesaikan setiap tugas secara bebas.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Jeda semasa putus sambungan:</strong> Permainan dijeda secara automatik jika mana-mana ahli putus sambungan.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Soalan tersembunyi:</strong> Setiap bilik mempunyai soalan bonus.</td></tr>',
  ta: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">தனிப்பட்ட தேவை:</strong> ஒவ்வொரு வீரர் ஒவ்வொரு பணியையும் தனியாக முடிக்க வேண்டும்.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">துண்டிப்பில் இடைநிறுத்தம்:</strong> உறுப்பினர் இணைப்பை இழந்தால், விளையாட்டு இடைநிறுத்தப்படும்.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">மறைந்த கேள்விகள்:</strong> ஒவ்வொரு அறையிலும் ஒரு போனஸ் கேள்வி உள்ளது.</td></tr>',
  hi: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">व्यक्तिगत आवश्यकता:</strong> प्रत्येक खिलाड़ी को प्रत्येक कार्य स्वतंत्र रूप से पूरा करना होगा।</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">डिस्कनेक्ट पर पॉज़:</strong> यदि कोई सदस्य डिस्कनेक्ट होता है, तो गेम रुक जाता है।</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">छिपे हुए प्रश्न:</strong> प्रत्येक कमरे में एक बोनस प्रश्न है।</td></tr>',
  he: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">דרישה אישית:</strong> כל שחקן חייב להשלים כל משימה באופן עצמאי.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">השהייה בהתנתקות:</strong> אם חבר צוות מתנתק, המשחק מושהה אוטומטית.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">שאלות נסתרות:</strong> בכל חדר יש שאלת בונוס.</td></tr>',
};

// Find section boundaries using unquoted keys
const langBoundaries = {
  de:  ['  de: {',      '  es: {'],
  es:  ['  es: {',      "  'pt-BR': {"],
  fr:  ['  fr: {',      '  ko: {'],
  ko:  ['  ko: {',      '  da: {'],
  ms:  ['  ms: {',      '  ta: {'],
  ta:  ['  ta: {',      '  hi: {'],
  hi:  ['  hi: {',      "  'sr-Latn': {"],
  he:  ['  he: {',      null],  // he is last before sr-Latn check
};

// Add he boundary properly
const heBoundary = "  'sr-Latn': {";

for (const [lang, replacement] of Object.entries(newRowsByLang)) {
  let [startMarker, endMarker] = langBoundaries[lang] || [null, null];
  if (lang === 'he') endMarker = heBoundary;
  if (!startMarker) { console.warn('No boundary for:', lang); continue; }

  const startIdx = src.indexOf(startMarker);
  if (startIdx === -1) { console.warn('Start marker not found for:', lang, startMarker); continue; }

  const endIdx = endMarker ? src.indexOf(endMarker, startIdx + 10) : src.length;
  const section = src.slice(startIdx, endIdx);

  const rulesKeyStr = "'start.rules_content': '";
  const rulesKeyIdx = section.indexOf(rulesKeyStr);
  if (rulesKeyIdx === -1) { console.warn('rules_content not found for lang:', lang); continue; }

  // Extract value
  const afterOpenQuote = section.slice(rulesKeyIdx + rulesKeyStr.length);
  let j = 0, inEsc = false;
  while (j < afterOpenQuote.length) {
    if (inEsc) { inEsc = false; j++; continue; }
    if (afterOpenQuote[j] === '\\') { inEsc = true; j++; continue; }
    if (afterOpenQuote[j] === "'") break;
    j++;
  }
  const oldVal = afterOpenQuote.slice(0, j);

  if (oldVal.indexOf('🔑') === -1) {
    console.log('No 🔑 in rules_content for', lang, '— already updated');
    continue;
  }

  const newVal = oldVal.replace(TEAM_CONFIRM_ROW_RE, replacement);
  if (newVal === oldVal) {
    console.warn('Regex did not match 🔑 row for lang:', lang);
    // Try simpler approach
    continue;
  }

  // Replace in src
  const absRulesIdx = startIdx + rulesKeyIdx + rulesKeyStr.length;
  src = src.slice(0, absRulesIdx) + newVal + src.slice(absRulesIdx + j);
  console.log('Updated rules_content for lang:', lang);
}

// ═══════════════════════════════════════════════════════════════════════════
// WRITE OUTPUT
// ═══════════════════════════════════════════════════════════════════════════
fs.writeFileSync(FILE, src);
console.log('\n✅ translations.js updated successfully');
