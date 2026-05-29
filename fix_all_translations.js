#!/usr/bin/env node
'use strict';
const fs = require('fs');
const FILE = __dirname + '/translations.js';
let src = fs.readFileSync(FILE, 'utf8');

// ── Helper: insert text after a specific line ─────────────────────────────
function insertAfter(text, anchor, insertion) {
  const idx = text.indexOf(anchor);
  if (idx === -1) { console.error('ANCHOR NOT FOUND:', anchor.slice(0, 80)); process.exit(1); }
  return text.slice(0, idx + anchor.length) + '\n' + insertion + text.slice(idx + anchor.length);
}

// ── Helper: replace a key's value across specific language sections ────────
function replaceKeyValue(text, key, newValue, langMarkers) {
  for (const marker of langMarkers) {
    const langIdx = text.indexOf(marker);
    if (langIdx === -1) { console.warn('Lang marker not found:', marker); continue; }
    // Find the key within that section (search from langIdx)
    const keyIdx = text.indexOf(key, langIdx);
    if (keyIdx === -1) { console.warn('Key not found:', key, 'in lang:', marker); continue; }
    // Find the opening quote after the colon
    const colonIdx = text.indexOf(':', keyIdx);
    const afterColon = text.slice(colonIdx + 1);
    // Find the value (between quotes, possibly single-quoted with escapes)
    const match = afterColon.match(/^(\s*')((?:[^'\\]|\\.)*)(',)/);
    if (!match) { console.warn('Value not matched for key:', key, 'in', marker); continue; }
    const fullMatch = match[0];
    const newFull = match[1] + newValue + match[3];
    const replaceAt = colonIdx + 1;
    text = text.slice(0, replaceAt) + text.slice(replaceAt).replace(fullMatch, newFull);
  }
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1: Add msg.member_left to all 15 languages (after msg.member_joined)
// ═══════════════════════════════════════════════════════════════════════════
const memberLeftByLang = {
  en:       "    'msg.member_left':        '↩ {name} left the team.',",
  de:       "    'msg.member_left':        '↩ {name} hat das Team verlassen.',",
  es:       "    'msg.member_left':        '↩ {name} ha abandonado el equipo.',",
  'pt-BR':  "    'msg.member_left':        '↩ {name} saiu da equipe.',",
  fr:       "    'msg.member_left':        '↩ {name} a quitté l\\'équipe.',",
  ko:       "    'msg.member_left':        '↩ {name}이(가) 팀에서 나갔습니다.',",
  da:       "    'msg.member_left':        '↩ {name} forlod holdet.',",
  'zh-Hans': "    'msg.member_left':        '↩ {name}离开了队伍。',",
  'zh-Hant': "    'msg.member_left':        '↩ {name}離開了隊伍。',",
  ms:       "    'msg.member_left':        '↩ {name} telah meninggalkan pasukan.',",
  ta:       "    'msg.member_left':        '↩ {name} குழுவை விட்டு சென்றார்.',",
  hi:       "    'msg.member_left':        '↩ {name} टीम छोड़ गया।',",
  he:       "    'msg.member_left':        '↩ {name} עזב את הצוות.',",
  'sr-Latn': "    'msg.member_left':        '↩ {name} je napustio/la tim.',",
  'sr-Cyrl': "    'msg.member_left':        '↩ {name} је напустио/ла тим.',",
};

// After each msg.member_joined line, insert msg.member_left
// Do this by replacing the member_joined line + its newline with the joined line + left line
const allJoinedLines = [
  "    'msg.member_joined':      '👋 {name} joined your group!',",
  "    'msg.member_joined':      '👋 {name} ist Ihrer Gruppe beigetreten!',",
  "    'msg.member_joined':      '👋 ¡{name} se ha unido a tu grupo!',",
  "    'msg.member_joined':      '👋 {name} entrou no seu grupo!',",
  "    'msg.member_joined':      '👋 {name} a rejoint votre groupe !',",
  "    'msg.member_joined':      '👋 {name}이(가) 그룹에 참가했습니다!',",
  "    'msg.member_joined':      '👋 {name} sluttede sig til din gruppe!',",
  "    'msg.member_joined':      '👋 {name}加入了您的小组！',",
  "    'msg.member_joined':      '👋 {name}加入了您的小組！',",
  "    'msg.member_joined':      '👋 {name} telah menyertai kumpulan anda!',",
  "    'msg.member_joined':      '👋 {name} உங்கள் குழுவில் சேர்ந்தார்!',",
  "    'msg.member_joined':      '👋 {name} आपके समूह में शामिल हो गया!',",
  "    'msg.member_joined':      '👋 {name} הצטרף לקבוצה שלך!',",
  "    'msg.member_joined':      '👋 {name} se pridružio/la vašoj grupi!',",
  "    'msg.member_joined':      '👋 {name} се придружио/ла вашој групи!',",
];
const leftLineByJoined = {
  "    'msg.member_joined':      '👋 {name} joined your group!',":              memberLeftByLang['en'],
  "    'msg.member_joined':      '👋 {name} ist Ihrer Gruppe beigetreten!',":   memberLeftByLang['de'],
  "    'msg.member_joined':      '👋 ¡{name} se ha unido a tu grupo!',":        memberLeftByLang['es'],
  "    'msg.member_joined':      '👋 {name} entrou no seu grupo!',":            memberLeftByLang['pt-BR'],
  "    'msg.member_joined':      '👋 {name} a rejoint votre groupe !',":        memberLeftByLang['fr'],
  "    'msg.member_joined':      '👋 {name}이(가) 그룹에 참가했습니다!',":       memberLeftByLang['ko'],
  "    'msg.member_joined':      '👋 {name} sluttede sig til din gruppe!',":    memberLeftByLang['da'],
  "    'msg.member_joined':      '👋 {name}加入了您的小组！',":                  memberLeftByLang['zh-Hans'],
  "    'msg.member_joined':      '👋 {name}加入了您的小組！',":                  memberLeftByLang['zh-Hant'],
  "    'msg.member_joined':      '👋 {name} telah menyertai kumpulan anda!',":  memberLeftByLang['ms'],
  "    'msg.member_joined':      '👋 {name} உங்கள் குழுவில் சேர்ந்தார்!',":    memberLeftByLang['ta'],
  "    'msg.member_joined':      '👋 {name} आपके समूह में शामिल हो गया!',":    memberLeftByLang['hi'],
  "    'msg.member_joined':      '👋 {name} הצטרף לקבוצה שלך!',":             memberLeftByLang['he'],
  "    'msg.member_joined':      '👋 {name} se pridružio/la vašoj grupi!',":    memberLeftByLang['sr-Latn'],
  "    'msg.member_joined':      '👋 {name} се придружио/ла вашој групи!',":    memberLeftByLang['sr-Cyrl'],
};

for (const joined of allJoinedLines) {
  const leftLine = leftLineByJoined[joined];
  if (!leftLine) { console.warn('No left line for:', joined.slice(0,60)); continue; }
  if (src.indexOf(joined) === -1) {
    // Try finding a partial match
    console.warn('Joined line not found:', joined.slice(0,60));
    continue;
  }
  // Only insert if not already there (idempotent)
  if (src.indexOf(leftLine.trim()) === -1) {
    src = insertAfter(src, joined, leftLine);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2: Add end.hq_breakdown_h to all 15 languages (after end.new_game)
// ═══════════════════════════════════════════════════════════════════════════
const hqBreakdownByLang = {
  en:       "    'end.hq_breakdown_h':     'Hidden Question Results',",
  de:       "    'end.hq_breakdown_h':     'Ergebnisse der versteckten Fragen',",
  es:       "    'end.hq_breakdown_h':     'Resultados de preguntas ocultas',",
  'pt-BR':  "    'end.hq_breakdown_h':     'Resultados das Perguntas Ocultas',",
  fr:       "    'end.hq_breakdown_h':     'Résultats des questions cachées',",
  ko:       "    'end.hq_breakdown_h':     '숨겨진 질문 결과',",
  da:       "    'end.hq_breakdown_h':     'Resultater af skjulte spørgsmål',",
  'zh-Hans': "    'end.hq_breakdown_h':     '隐藏问题结果',",
  'zh-Hant': "    'end.hq_breakdown_h':     '隱藏問題結果',",
  ms:       "    'end.hq_breakdown_h':     'Keputusan Soalan Tersembunyi',",
  ta:       "    'end.hq_breakdown_h':     'மறைந்த கேள்வி முடிவுகள்',",
  hi:       "    'end.hq_breakdown_h':     'छिपे हुए प्रश्न परिणाम',",
  he:       "    'end.hq_breakdown_h':     'תוצאות שאלות נסתרות',",
  'sr-Latn': "    'end.hq_breakdown_h':     'Rezultati skrivenih pitanja',",
  'sr-Cyrl': "    'end.hq_breakdown_h':     'Резултати скривених питања',",
};

const newGameByLang = {
  en:       "    'end.new_game':      '↺ New Game',",
  de:       "    'end.new_game':      '↺ Neues Spiel',",
  es:       "    'end.new_game':      '↺ Nuevo juego',",
  'pt-BR':  "    'end.new_game':      '↺ Novo Jogo',",
  fr:       "    'end.new_game':      '↺ Nouvelle partie',",
  ko:       "    'end.new_game':      '↺ 새 게임',",
  da:       "    'end.new_game':      '↺ Nyt spil',",
  'zh-Hans': "    'end.new_game':      '↺ 新游戏',",
  'zh-Hant': "    'end.new_game':      '↺ 新遊戲',",
  ms:       "    'end.new_game':      '↺ Permainan Baharu',",
  ta:       "    'end.new_game':      '↺ புதிய விளையாட்டு',",
  hi:       "    'end.new_game':      '↺ नया खेल',",
  he:       "    'end.new_game':      '↺ משחק חדש',",
  'sr-Latn': "    'end.new_game':      '↺ Nova igra',",
  'sr-Cyrl': "    'end.new_game':      '↺ Нова игра',",
};

for (const [lang, newGameLine] of Object.entries(newGameByLang)) {
  const hqLine = hqBreakdownByLang[lang];
  if (!hqLine) continue;
  if (src.indexOf(newGameLine) === -1) { console.warn('new_game not found for lang:', lang); continue; }
  if (src.indexOf(hqLine.trim()) === -1) {
    src = insertAfter(src, newGameLine, hqLine);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3: Add 27 missing keys to pt-BR, zh-Hans, zh-Hant, sr-Latn, sr-Cyrl
// ═══════════════════════════════════════════════════════════════════════════
const missingKeysByLang = {
  'pt-BR': `    'login.group_size':         'Quantas pessoas estão no seu grupo?',
    'login.group_size_ph':      '— Selecione o tamanho do grupo —',
    'login.group_size_3':       '3 jogadores',
    'login.group_size_4':       '4 jogadores',
    'login.group_size_5':       '5 jogadores',
    'login.group_size_error':   'Por favor, selecione o tamanho do grupo (3, 4 ou 5).',
    'login.size_mismatch':      'Este grupo já definiu {required} jogadores.',
    'login.group_full':         'Este grupo já está cheio ({required} jogadores conectados).',
    'login.roster_locked':      'Esta sessão já começou. Somente os membros originais podem se reconectar.',
    'login.permanently_locked': 'Este grupo já concluiu o jogo. Os resultados são definitivos.',
    'lobby.need_exact':         'Aguardando mais {needed} jogador(es) para entrar.',
    'lobby.connected_of':       'conectados',
    'lobby.all_ready':          'Todos os jogadores conectados! Todos cliquem em Pronto para começar.',
    'lobby.wrong_count':        'São necessários exatamente {required} jogadores. Atualmente {online} conectados.',
    'lobby.too_many':           'Jogadores em excesso. Esperados {required}, obtidos {online}.',
    'pause.title':              'JOGO PAUSADO',
    'pause.body':               '{name} se desconectou. Esta sessão requer {total} jogadores. Aguardando o retorno de todos.',
    'pause.waiting_for':        'Aguardando: {names}',
    'pause.resumed':            '✓ Todos os jogadores de volta! O jogo está retomando…',
    'msg.your_task_done':       '✓ Você concluiu esta tarefa. Aguardando os colegas de equipe…',
    'msg.team_progress':        '{done} / {total} jogadores concluíram esta tarefa.',
    'msg.all_players_done':     '✓ Todos os jogadores concluíram: {label}',
    'log.all_players_done':     '✓ Todos os jogadores concluíram: {label}',
    'msg.missing_tasks':        'Você está com algo pendente nesta sala.',
    'msg.incomplete_tasks':     'Por favor, complete todas as interações necessárias antes de prosseguir.',
    'msg.pin_incomplete':       'O PIN final está correto, mas seu grupo ainda não concluiu todas as tarefas obrigatórias.',
    'rules.english_answers':    'Algumas respostas devem ser digitadas em inglês exatamente como mostrado (ex.: números de lote, ACCEPT/REJECT). Campos com distinção de maiúsculas/minúsculas são indicados na pergunta.',`,

  'zh-Hans': `    'login.group_size':         '您的团队有多少人？',
    'login.group_size_ph':      '— 选择团队人数 —',
    'login.group_size_3':       '3名玩家',
    'login.group_size_4':       '4名玩家',
    'login.group_size_5':       '5名玩家',
    'login.group_size_error':   '请选择团队人数（3、4或5人）。',
    'login.size_mismatch':      '此团队已设置{required}名玩家。',
    'login.group_full':         '此团队已满（{required}名玩家已连接）。',
    'login.roster_locked':      '本会话已开始。只有原始团队成员可以重新加入。',
    'login.permanently_locked': '此团队已完成游戏，结果不可更改。',
    'lobby.need_exact':         '正在等待另外{needed}名玩家加入。',
    'lobby.connected_of':       '已连接',
    'lobby.all_ready':          '所有玩家已连接！请所有人点击准备以开始。',
    'lobby.wrong_count':        '需要恰好{required}名玩家，当前{online}名已连接。',
    'lobby.too_many':           '玩家过多。预期{required}人，当前{online}人。',
    'pause.title':              '游戏暂停',
    'pause.body':               '{name}已断开连接。本会话需要{total}名玩家。正在等待所有人返回。',
    'pause.waiting_for':        '正在等待：{names}',
    'pause.resumed':            '✓ 所有玩家已返回！游戏继续…',
    'msg.your_task_done':       '✓ 您已完成此任务，正在等待队友…',
    'msg.team_progress':        '{done} / {total}名玩家已完成此任务。',
    'msg.all_players_done':     '✓ 所有玩家已完成：{label}',
    'log.all_players_done':     '✓ 所有玩家已完成：{label}',
    'msg.missing_tasks':        '您在此房间还有未完成的内容。',
    'msg.incomplete_tasks':     '请在继续之前完成所有必要的互动。',
    'msg.pin_incomplete':       '最终PIN码正确，但您的团队尚未完成所有必要任务。',
    'rules.english_answers':    '某些答案必须完全按照所示用英语输入（例如：批号、ACCEPT/REJECT）。区分大小写的字段在问题中有标注。',`,

  'zh-Hant': `    'login.group_size':         '您的團隊有幾個人？',
    'login.group_size_ph':      '— 選擇團隊人數 —',
    'login.group_size_3':       '3名玩家',
    'login.group_size_4':       '4名玩家',
    'login.group_size_5':       '5名玩家',
    'login.group_size_error':   '請選擇團隊人數（3、4或5人）。',
    'login.size_mismatch':      '此團隊已設定{required}名玩家。',
    'login.group_full':         '此團隊已滿（{required}名玩家已連接）。',
    'login.roster_locked':      '本場次已開始。只有原始團隊成員可以重新加入。',
    'login.permanently_locked': '此團隊已完成遊戲，結果不可更改。',
    'lobby.need_exact':         '正在等待另外{needed}名玩家加入。',
    'lobby.connected_of':       '已連接',
    'lobby.all_ready':          '所有玩家已連接！請所有人點擊準備以開始。',
    'lobby.wrong_count':        '需要恰好{required}名玩家，目前{online}名已連接。',
    'lobby.too_many':           '玩家過多。預期{required}人，目前{online}人。',
    'pause.title':              '遊戲暫停',
    'pause.body':               '{name}已斷線。本場次需要{total}名玩家。正在等待所有人返回。',
    'pause.waiting_for':        '正在等待：{names}',
    'pause.resumed':            '✓ 所有玩家已返回！遊戲繼續…',
    'msg.your_task_done':       '✓ 您已完成此任務，正在等待隊友…',
    'msg.team_progress':        '{done} / {total}名玩家已完成此任務。',
    'msg.all_players_done':     '✓ 所有玩家已完成：{label}',
    'log.all_players_done':     '✓ 所有玩家已完成：{label}',
    'msg.missing_tasks':        '您在此房間還有未完成的內容。',
    'msg.incomplete_tasks':     '請在繼續之前完成所有必要的互動。',
    'msg.pin_incomplete':       '最終PIN碼正確，但您的團隊尚未完成所有必要任務。',
    'rules.english_answers':    '某些答案必須完全按照所示用英語輸入（例如：批號、ACCEPT/REJECT）。區分大小寫的欄位在問題中有標注。',`,

  'sr-Latn': `    'login.group_size':         'Koliko osoba je u vašoj grupi?',
    'login.group_size_ph':      '— Odaberite veličinu grupe —',
    'login.group_size_3':       '3 igrača',
    'login.group_size_4':       '4 igrača',
    'login.group_size_5':       '5 igrača',
    'login.group_size_error':   'Molimo odaberite veličinu grupe (3, 4 ili 5).',
    'login.size_mismatch':      'Ova grupa je već podesila {required} igrača.',
    'login.group_full':         'Ova grupa je već puna ({required} igrača je povezano).',
    'login.roster_locked':      'Sesija je počela. Samo originalni članovi tima se mogu ponovo pridružiti.',
    'login.permanently_locked': 'Ova grupa je već završila igru. Rezultati su konačni.',
    'lobby.need_exact':         'Čekamo još {needed} igrača/e.',
    'lobby.connected_of':       'povezanih',
    'lobby.all_ready':          'Svi igrači su povezani! Svi kliknite Spreman da biste počeli.',
    'lobby.wrong_count':        'Potrebno je tačno {required} igrača. Trenutno {online} povezanih.',
    'lobby.too_many':           'Previše igrača. Očekivano {required}, dobijeno {online}.',
    'pause.title':              'IGRA PAUZIRANA',
    'pause.body':               '{name} se isključio/la. Ova sesija zahteva {total} igrača. Čekamo da se svi vrate.',
    'pause.waiting_for':        'Čekamo: {names}',
    'pause.resumed':            '✓ Svi igrači su se vratili! Igra se nastavlja…',
    'msg.your_task_done':       '✓ Završili ste ovaj zadatak. Čekam saigrače…',
    'msg.team_progress':        '{done} / {total} igrača je završilo ovaj zadatak.',
    'msg.all_players_done':     '✓ Svi igrači su završili: {label}',
    'log.all_players_done':     '✓ Svi igrači su završili: {label}',
    'msg.missing_tasks':        'Nešto vam nedostaje u ovoj sobi.',
    'msg.incomplete_tasks':     'Molimo završite sve obavezne interakcije pre nastavka.',
    'msg.pin_incomplete':       'Konačni PIN je tačan, ali vaša grupa još nije završila sve obavezne zadatke.',
    'rules.english_answers':    'Neki odgovori moraju biti ukucani na engleskom tačno onako kako je prikazano (npr. broj serije, ACCEPT/REJECT). Polja s razlikom velikih/malih slova su naznačena u pitanju.',`,

  'sr-Cyrl': `    'login.group_size':         'Колико особа је у вашој групи?',
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
    'rules.english_answers':    'Неки одговори морају бити укуцани на енглеском тачно онако како је приказано (нпр. број серије, ACCEPT/REJECT). Поља с разликом великих/малих слова су назначена у питању.',`,
};

// Anchor: the last hq.hq_dispatch.d line in each language section
const anchorsByLang = {
  'pt-BR':   "    'hq.hq_dispatch.d':                            'Torrar — o calor mata bactérias e o torna seguro.',",
  'zh-Hans': "    'hq.hq_dispatch.d':                            '烤一烤 — 高温杀死细菌，使之安全。',",
  'zh-Hant': "    'hq.hq_dispatch.d':                            '烤一烤 — 高溫殺死細菌，使之安全。',",
  'sr-Latn': "    'hq.hq_dispatch.d':                            'Prepecite — toplota ubija bakterije i čini ga bezbednim.',",
  'sr-Cyrl': "    'hq.hq_dispatch.d':                            'Препеците — топлота убија бактерије и чини га безбедним.',",
};

for (const [lang, keys] of Object.entries(missingKeysByLang)) {
  const anchor = anchorsByLang[lang];
  if (!anchor) { console.warn('No anchor for lang:', lang); continue; }
  if (src.indexOf(anchor) === -1) { console.error('Anchor not found for lang:', lang); continue; }
  // Check if already inserted (idempotent: check first new key)
  const firstKey = "    'login.group_size':";
  // Count occurrences to see if already there
  const afterAnchor = src.slice(src.indexOf(anchor) + anchor.length, src.indexOf(anchor) + anchor.length + 500);
  if (afterAnchor.indexOf(firstKey) !== -1) {
    console.log('Keys already present for lang:', lang);
    continue;
  }
  src = insertAfter(src, anchor, keys);
  console.log('Inserted 27 keys for lang:', lang);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 4: Update start.rules_content in all 15 languages
// Remove "Team confirmation" row, add per-player + pause rows
// ═══════════════════════════════════════════════════════════════════════════
// New rules_content for English (template with proper structure):
const newRulesContentEN = '<table style="width:100%;border-collapse:collapse;"><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;width:28px;font-size:1rem;">👥</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Team size:</strong> 3 – 5 members, selected before the game. All must connect before starting.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏱️</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Simultaneous start:</strong> Every player must click <em>"I\'m Ready"</em>. The timer starts for all at the same moment.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Per-player requirement:</strong> Every player must independently complete each task. You cannot advance past a room until you personally finish all its tasks.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Pause on disconnect:</strong> If any team member disconnects, the game pauses automatically. The timer resumes only when everyone is back.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">🚪</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Area locks:</strong> Each area is locked until the previous task is completed — complete tasks in order.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Hidden questions:</strong> Each room contains one bonus question. Answer correctly for extra points — but wrong answers still cost <strong style="color:var(--danger);">−50 points</strong>.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❌</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Wrong answers:</strong> Each incorrect answer deducts <strong style="color:var(--danger);">50 points</strong> from your final score — think before you submit.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">💡</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Hints:</strong> Each area has one hint available. Using a hint costs <strong style="color:var(--danger);">−60 seconds</strong> and <strong style="color:var(--danger);">−50 points</strong>. Hints are subtle — they do not give you the answer.</td></tr><tr style=""><td style="padding:7px 8px 7px 0;font-size:1rem;">🏁</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">One attempt:</strong> Each group plays once. Results are final and posted to the leaderboard.</td></tr></table>';

// For the rules_content, we replace the old value in each language.
// Strategy: replace the old 'start.rules_content' value for each language by
// finding the key line and replacing the single-quoted string that follows.
// We use a regex that matches the value and replaces it.

// The old rules_content keys have "Team confirmation" in them.
// We'll do a targeted replacement for English, and add/replace for other languages.
// For simplicity, we replace the ENTIRE rules_content value for all languages
// with a version that has the new content.

// For non-English languages, we provide translated versions of the new rows.
const newRulesContentByLang = {
  en: newRulesContentEN,
  de: '<table style="width:100%;border-collapse:collapse;"><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;width:28px;font-size:1rem;">👥</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Teamgröße:</strong> 3–5 Mitglieder, vor dem Spiel festgelegt. Alle müssen verbunden sein, bevor das Spiel beginnt.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏱️</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Gleichzeitiger Start:</strong> Jeder Spieler muss auf <em>„Ich bin bereit"</em> klicken. Der Timer startet für alle gleichzeitig.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Individuelle Anforderung:</strong> Jeder Spieler muss jede Aufgabe unabhängig abschließen. Sie können einen Raum erst verlassen, wenn Sie persönlich alle Aufgaben erledigt haben.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Pause bei Trennung:</strong> Wenn ein Teammitglied die Verbindung verliert, wird das Spiel automatisch pausiert. Der Timer läuft erst weiter, wenn alle wieder da sind.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">🚪</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Bereichssperren:</strong> Jeder Bereich ist gesperrt, bis die vorherige Aufgabe abgeschlossen ist.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Versteckte Fragen:</strong> Jeder Raum enthält eine Bonusfrage. Richtige Antwort = Bonuspunkte — aber falsche Antworten kosten <strong style="color:var(--danger);">−50 Punkte</strong>.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❌</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Falsche Antworten:</strong> Jede falsche Antwort zieht <strong style="color:var(--danger);">50 Punkte</strong> ab — denken Sie nach, bevor Sie einreichen.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">💡</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Hinweise:</strong> Jeder Bereich hat einen Hinweis. Ein Hinweis kostet <strong style="color:var(--danger);">−60 Sekunden</strong> und <strong style="color:var(--danger);">−50 Punkte</strong>.</td></tr><tr style=""><td style="padding:7px 8px 7px 0;font-size:1rem;">🏁</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Ein Versuch:</strong> Jede Gruppe spielt einmal. Ergebnisse sind endgültig.</td></tr></table>',
};

// For most languages, we'll just replace the 🔑 row with the new 👤 + ⏸ + ❓ rows
// and fix ❌ to say 50 pts (was sometimes 10 pts in static fallback HTML).
// Strategy: do a regex replacement on the rules_content value for each lang.

// The pattern to find and replace in rules_content:
const OLD_TEAM_CONFIRM_ROW_PATTERN = /<tr[^>]*>[\s]*<td[^>]*>🔑<\/td>[\s]*<td[^>]*>.*?<\/td>[\s]*<\/tr>/gs;
const NEW_ROWS_EN = '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Per-player requirement:</strong> Every player must independently complete each task. You cannot advance past a room until you personally finish all its tasks.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Pause on disconnect:</strong> If any team member disconnects, the game pauses automatically. The timer resumes only when everyone is back.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Hidden questions:</strong> Each room contains one bonus question. Answer correctly for extra points — wrong answers cost <strong style="color:var(--danger);">−50 points</strong>.</td></tr>';

// Also fix "10 points" → "50 points" in wrong answers row for all langs
// (the static HTML fallback had 10 pts, translations.js already has 50 pts)

// Replace rules_content for English using the pre-built string
const EN_RULES_KEY = "'start.rules_content': '";
const enRulesIdx = src.indexOf(EN_RULES_KEY);
if (enRulesIdx !== -1) {
  const afterKey = src.slice(enRulesIdx + EN_RULES_KEY.length);
  // Find the closing ',\n pattern - the value ends at the first unescaped '
  let depth = 0;
  let i = 0;
  let inEscape = false;
  while (i < afterKey.length) {
    if (inEscape) { inEscape = false; i++; continue; }
    if (afterKey[i] === '\\') { inEscape = true; i++; continue; }
    if (afterKey[i] === "'") break;
    i++;
  }
  const oldValue = afterKey.slice(0, i);
  // Replace team confirmation row with the new rows
  const newValue = oldValue.replace(OLD_TEAM_CONFIRM_ROW_PATTERN, NEW_ROWS_EN);
  // Also fix 10 pts → 50 pts in wrong answers
  const fixedValue = newValue.replace(/each incorrect answer deducts <strong[^>]*>10 points<\/strong>/gi,
    'each incorrect answer deducts <strong style="color:var(--danger);">50 points</strong>');
  src = src.slice(0, enRulesIdx + EN_RULES_KEY.length) + fixedValue + src.slice(enRulesIdx + EN_RULES_KEY.length + i);
  console.log('Updated EN rules_content');
} else {
  console.warn('EN rules_content not found');
}

// For all other languages: find and replace the 🔑 team-confirm row in rules_content
// We need language-specific replacement text for the new rows
const newRowsByLang = {
  de: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Individuelle Anforderung:</strong> Jeder Spieler muss jede Aufgabe unabhängig abschließen.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Pause bei Trennung:</strong> Wenn ein Teammitglied die Verbindung verliert, wird das Spiel pausiert.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Versteckte Fragen:</strong> Jeder Raum enthält eine Bonusfrage für Extrapunkte.</td></tr>',
  es: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Requisito individual:</strong> Cada jugador debe completar independientemente cada tarea.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Pausa por desconexión:</strong> Si un miembro se desconecta, el juego se pausa automáticamente.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Preguntas ocultas:</strong> Cada sala tiene una pregunta de bonificación.</td></tr>',
  'pt-BR': '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Requisito individual:</strong> Cada jogador deve completar independentemente cada tarefa.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Pausa por desconexão:</strong> Se um membro se desconectar, o jogo pausa automaticamente.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Perguntas ocultas:</strong> Cada sala tem uma pergunta bônus.</td></tr>',
  fr: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Exigence individuelle:</strong> Chaque joueur doit accomplir indépendamment chaque tâche.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Pause sur déconnexion:</strong> Si un membre se déconnecte, le jeu se met en pause automatiquement.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Questions cachées:</strong> Chaque salle contient une question bonus.</td></tr>',
  ko: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">개인 완수 요건:</strong> 모든 플레이어가 각 과제를 독립적으로 완료해야 합니다.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">연결 끊김 시 일시정지:</strong> 팀원이 연결이 끊기면 게임이 자동으로 일시정지됩니다.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">숨겨진 질문:</strong> 각 방에는 보너스 질문이 있습니다.</td></tr>',
  da: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Individuelt krav:</strong> Hver spiller skal selvstændigt fuldføre alle opgaver.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Pause ved afbrydelse:</strong> Spillet sættes på pause, hvis en spiller mister forbindelsen.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Skjulte spørgsmål:</strong> Hvert rum indeholder ét bonusspørgsmål.</td></tr>',
  'zh-Hans': '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">个人完成要求:</strong> 每位玩家必须独立完成每项任务。</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">断线暂停:</strong> 若有团队成员断线，游戏自动暂停。</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">隐藏问题:</strong> 每个房间有一道奖励题。</td></tr>',
  'zh-Hant': '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">個人完成要求:</strong> 每位玩家必須獨立完成每項任務。</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">斷線暫停:</strong> 若有成員斷線，遊戲自動暫停。</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">隱藏問題:</strong> 每個房間有一道獎勵題。</td></tr>',
  ms: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Keperluan individu:</strong> Setiap pemain mesti menyelesaikan setiap tugas secara bebas.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Jeda semasa putus sambungan:</strong> Permainan dijeda secara automatik jika mana-mana ahli pasukan putus sambungan.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Soalan tersembunyi:</strong> Setiap bilik mempunyai soalan bonus.</td></tr>',
  ta: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">தனிப்பட்ட தேவை:</strong> ஒவ்வொரு வீரர் ஒவ்வொரு பணியையும் தனியாக முடிக்க வேண்டும்.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">துண்டிப்பில் இடைநிறுத்தம்:</strong> ஒரு உறுப்பினர் இணைப்பை இழந்தால், விளையாட்டு தானாகவே இடைநிறுத்தப்படும்.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">மறைந்த கேள்விகள்:</strong> ஒவ்வொரு அறையிலும் ஒரு போனஸ் கேள்வி உள்ளது.</td></tr>',
  hi: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">व्यक्तिगत आवश्यकता:</strong> प्रत्येक खिलाड़ी को प्रत्येक कार्य स्वतंत्र रूप से पूरा करना होगा।</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">डिस्कनेक्ट पर पॉज़:</strong> यदि कोई सदस्य डिस्कनेक्ट होता है, तो गेम स्वचालित रूप से रुक जाता है।</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">छिपे हुए प्रश्न:</strong> प्रत्येक कमरे में एक बोनस प्रश्न है।</td></tr>',
  he: '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">דרישה אישית:</strong> כל שחקן חייב להשלים כל משימה באופן עצמאי.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">השהייה בהתנתקות:</strong> אם חבר צוות מתנתק, המשחק מושהה אוטומטית.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">שאלות נסתרות:</strong> בכל חדר יש שאלת בונוס.</td></tr>',
  'sr-Latn': '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Individualni zahtev:</strong> Svaki igrač mora samostalno završiti svaki zadatak.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Pauza pri prekidu veze:</strong> Ako se član tima isključi, igra automatski pauzira.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Skrivena pitanja:</strong> Svaka soba ima bonus pitanje.</td></tr>',
  'sr-Cyrl': '<tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">👤</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Индивидуални захтев:</strong> Сваки играч мора самостално завршити сваки задатак.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">⏸</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Пауза при прекиду:</strong> Ако се члан тима искључи, игра аутоматски паузира.</td></tr><tr style="border-bottom:1px solid var(--border);"><td style="padding:7px 8px 7px 0;font-size:1rem;">❓</td><td style="padding:7px 0;color:var(--dim);"><strong style="color:var(--text);">Скривена питања:</strong> Свака соба има бонус питање.</td></tr>',
};

// For non-EN languages: replace the 🔑 team-confirm row in start.rules_content
// The pattern for 🔑 is: <tr...><td...>🔑</td><td...>...</td></tr>
const TEAM_CONFIRM_ROW_RE = /<tr[^>]*>[\s]*<td[^>]*>🔑<\/td>[\s]*<td[^>]*>.*?<\/td>[\s]*<\/tr>/gs;

// Find all occurrences of 'start.rules_content' after the first one (which is EN)
// We do this by processing each language section
const langSectionMarkers = [
  "  'de': {", "  'es': {", "  'pt-BR': {", "  'fr': {", "  'ko': {",
  "  'da': {", "  'zh-Hans': {", "  'zh-Hant': {", "  'ms': {", "  'ta': {",
  "  'hi': {", "  'he': {", "  'sr-Latn': {", "  'sr-Cyrl': {",
];
const langSectionLangs = ['de', 'es', 'pt-BR', 'fr', 'ko', 'da', 'zh-Hans', 'zh-Hant', 'ms', 'ta', 'hi', 'he', 'sr-Latn', 'sr-Cyrl'];

for (let i = 0; i < langSectionMarkers.length; i++) {
  const marker = langSectionMarkers[i];
  const lang = langSectionLangs[i];
  const replacement = newRowsByLang[lang];
  if (!replacement) { console.warn('No replacement rows for lang:', lang); continue; }

  const markerIdx = src.indexOf(marker);
  if (markerIdx === -1) { console.warn('Section marker not found:', marker); continue; }

  const rulesKeyStr = "'start.rules_content': '";
  const rulesIdx = src.indexOf(rulesKeyStr, markerIdx);
  if (rulesIdx === -1) { console.warn('rules_content not found for lang:', lang); continue; }

  // Extract the value (from after the opening quote to the closing quote)
  const afterOpenQuote = src.slice(rulesIdx + rulesKeyStr.length);
  let j = 0;
  let inEsc = false;
  while (j < afterOpenQuote.length) {
    if (inEsc) { inEsc = false; j++; continue; }
    if (afterOpenQuote[j] === '\\') { inEsc = true; j++; continue; }
    if (afterOpenQuote[j] === "'") break;
    j++;
  }
  const oldVal = afterOpenQuote.slice(0, j);

  if (oldVal.indexOf('🔑') === -1) {
    console.log('No 🔑 row found in', lang, '— already updated or different format');
    continue;
  }

  const newVal = oldVal.replace(TEAM_CONFIRM_ROW_RE, replacement);
  if (newVal === oldVal) {
    console.warn('Regex did not match for lang:', lang);
    continue;
  }
  src = src.slice(0, rulesIdx + rulesKeyStr.length) + newVal + src.slice(rulesIdx + rulesKeyStr.length + j);
  console.log('Updated rules_content for lang:', lang);
}

// ═══════════════════════════════════════════════════════════════════════════
// WRITE OUTPUT
// ═══════════════════════════════════════════════════════════════════════════
fs.writeFileSync(FILE, src);
console.log('\n✅ translations.js updated successfully');
