#!/usr/bin/env node
// Fix body.calibration for all remaining languages:
// - Change "correction factor" framing to "measurement deviation" framing
// - Fix inverted sign direction (was: positive=low, now: positive=high)
// - Fix English bugs (duplicate phrase, wrong placeholder)

const fs = require('fs');
const path = '/home/user/Trial-ofthe-matter/translations.js';
let src = fs.readFileSync(path, 'utf8');
const orig = src;

function replace(oldStr, newStr, label) {
  if (!src.includes(oldStr)) {
    console.error(`MISS [${label}]: "${oldStr.slice(0,80)}..."`);
    return;
  }
  src = src.replace(oldStr, newStr);
  console.log(`OK [${label}]`);
}

// ── English bug 1: duplicate "The sign matters —" ──────────────────────────
replace(
  '⚠ The sign matters — The sign matters — positive means the instrument reads too high; negative means it reads too low. Enter the reading minus the reference.</small>',
  '⚠ The sign matters — positive means the instrument reads too high; negative means it reads too low. Enter the reading minus the reference.</small>',
  'EN body.calibration duplicate'
);

// ── English bug 2: placeholder shows duplicate ─────────────────────────────
replace(
  "'q.calibration.ph':'e.g. +0.03 or +0.03',",
  "'q.calibration.ph':'e.g. +0.03',",
  'EN q.calibration.ph'
);

// ── zh-Hans: correction factor → measurement deviation ────────────────────
replace(
  '计算并输入<strong>修正系数</strong>：需要加到读数上以获得真实认证值的量。<br><small style="color:#5a6480;">注明符号——仪器测量值偏低时为正，偏高时为负。</small>',
  '计算并输入<strong>测量偏差</strong>：仪器读数减去认证参考值。<br><small style="color:#e05c00;font-weight:600;">⚠ 符号很重要 — 正值表示仪器读数偏高；负值表示读数偏低。仪器读数 − 参考值。</small>',
  'ZH-HANS body.calibration'
);

// ── zh-Hant: correction factor → measurement deviation ────────────────────
replace(
  '計算並輸入<strong>修正係數</strong>：需要加到讀數上以獲得真實認證值的量。<br><small style="color:#5a6480;">注明符號——儀器測量值偏低時為正，偏高時為負。</small>',
  '計算並輸入<strong>測量偏差</strong>：儀器讀數減去認證參考值。<br><small style="color:#e05c00;font-weight:600;">⚠ 符號很重要 — 正值表示儀器讀數偏高；負值表示讀數偏低。儀器讀數 − 參考值。</small>',
  'ZH-HANT body.calibration'
);

// ── Malay: correction factor → measurement deviation ─────────────────────
replace(
  'Kira dan masukkan <strong>faktor pembetulan</strong>: apa yang perlu anda TAMBAH kepada bacaan untuk mendapatkan nilai bertauliah sebenar.<br><small style="color:#5a6480;">Nyatakan tanda — positif jika instrumen mengukur terlalu rendah, negatif jika terlalu tinggi.</small>',
  'Kira dan masukkan <strong>sisihan pengukuran</strong>: bacaan instrumen tolak nilai rujukan bertauliah.<br><small style="color:#e05c00;font-weight:600;">⚠ Tanda adalah penting — positif bermakna instrumen membaca terlalu tinggi; negatif bermakna membaca terlalu rendah. Bacaan − rujukan.</small>',
  'MS body.calibration'
);

// ── Kannada: correction factor → measurement deviation ───────────────────
replace(
  '<strong>ಸರಿಪಡಿಸುವ ಅಂಶ</strong> ಲೆಕ್ಕ ಹಾಕಿ ಹಾಕಿ: ನಿಜ ಮೌಲ್ಯ ಪಡೆಯಲು ಉಪಕರಣ ಓದಿಗೆ ಸೇರಿಸಬೇಕಾದದ್ದು.<br><small style="color:#5a6480;">ಚಿಹ್ನೆ ಸೇರಿಸಿ — ಉಪಕರಣ ಕಡಿಮೆ ಓದಿದರೆ ಧನಾತ್ಮಕ, ಹೆಚ್ಚು ಓದಿದರೆ ಋಣಾತ್ಮಕ.</small>',
  '<strong>ಅಳತೆ ವ್ಯತ್ಯಾಸ</strong> ಲೆಕ್ಕ ಹಾಕಿ ಮತ್ತು ನಮೂದಿಸಿ: ಉಪಕರಣ ಓದುವಿಕೆ ಕಳೆಯು ಪ್ರಮಾಣೀಕೃತ ಆಧಾರ ಮೌಲ್ಯ.<br><small style="color:#e05c00;font-weight:600;">⚠ ಚಿಹ್ನೆ ಮುಖ್ಯ — ಧನಾತ್ಮಕ ಎಂದರೆ ಉಪಕರಣ ಹೆಚ್ಚು ಓದುತ್ತದೆ; ಋಣಾತ್ಮಕ ಎಂದರೆ ಕಡಿಮೆ ಓದುತ್ತದೆ. ಓದುವಿಕೆ − ಆಧಾರ.</small>',
  'KN body.calibration'
);

// ── Tamil: correction factor → measurement deviation ─────────────────────
replace(
  '<strong>திருத்தக் காரணியை</strong> கணக்கிட்டு உள்ளிடவும்: உண்மையான சான்றிதழ் மதிப்பைப் பெற கருவி படிப்பில் நீங்கள் சேர்க்க வேண்டியது என்னவோ அது.<br><small style="color:#5a6480;">குறியை சேர்க்கவும் — கருவி குறைவாக படித்தால் நேர்மறை, அதிகமாக படித்தால் எதிர்மறை.</small>',
  '<strong>அளவீட்டு விலகல்</strong> கணக்கிட்டு உள்ளிடவும்: கருவி வாசிப்பு கழித்தல் சான்றிதழ் பெற்ற குறிப்பு மதிப்பு.<br><small style="color:#e05c00;font-weight:600;">⚠ குறி முக்கியமானது — நேர்மறை என்பது கருவி அதிகமாக வாசிக்கிறது; எதிர்மறை என்பது குறைவாக வாசிக்கிறது. வாசிப்பு − குறிப்பு மதிப்பு.</small>',
  'TA body.calibration'
);

// ── Hindi: correction factor → measurement deviation ─────────────────────
replace(
  '<strong>सुधार कारक</strong> की गणना और दर्ज करें: उपकरण के मूल्य में क्या जोड़ने पर सही प्रमाणित मूल्य मिलेगा।<br><small style="color:#5a6480;">चिह्न सहित दर्ज करें — धनात्मक यदि उपकरण कम पढ़ता है, ऋणात्मक यदि अधिक पढ़ता है।</small>',
  '<strong>माप विचलन</strong> की गणना करें और दर्ज करें: उपकरण पठन घटाकर प्रमाणित संदर्भ मान।<br><small style="color:#e05c00;font-weight:600;">⚠ चिह्न महत्वपूर्ण है — धनात्मक का मतलब है उपकरण अधिक पढ़ता है; ऋणात्मक का मतलब है कम पढ़ता है। पठन − संदर्भ।</small>',
  'HI body.calibration'
);

// ── sr-Latn: correction factor → measurement deviation ────────────────────
replace(
  'Izračunajte i unesite <strong>faktor korekcije</strong>: šta treba DODATI očitavanju instrumenta da biste dobili pravu sertifikovanu vrednost.<br><small style="color:#5a6480;">Uključite znak — pozitivan ako instrument čita prenisko, negativan ako čita previše.</small>',
  'Izračunajte i unesite <strong>mjerno odstupanje</strong>: očitavanje instrumenta minus certificirana referentna vrijednost.<br><small style="color:#e05c00;font-weight:600;">⚠ Predznak je važan — pozitivan znači da instrument mjeri previše; negativan znači da mjeri premalo. Očitavanje − referenca.</small>',
  'SR-LATN body.calibration'
);

// ── sr-Cyrl: correction factor → measurement deviation ────────────────────
replace(
  'Израчунајте и унесите <strong>фактор корекције</strong>: шта треба ДОДАТИ очитавању инструмента да бисте добили праву сертификовану вредност.<br><small style="color:#5a6480;">Укључите знак — позитиван ако инструмент чита прениско, негативан ако чита превише.</small>',
  'Израчунајте и унесите <strong>мерно одступање</strong>: очитавање инструмента минус сертификована референтна вредност.<br><small style="color:#e05c00;font-weight:600;">⚠ Предзнак је важан — позитиван значи да инструмент мери превише; негативан значи да мери премало. Очитавање − референца.</small>',
  'SR-CYRL body.calibration'
);

// ── Hebrew: correction factor → measurement deviation ────────────────────
replace(
  'חשב והזן את <strong>גורם התיקון</strong>: מה שיש להוסיף לקריאת המכשיר כדי לקבל את הערך המוסמך האמיתי.<br><small style="color:#5a6480;">כלול את הסימן — חיובי אם המכשיר קורא נמוך, שלילי אם קורא גבוה.</small>',
  'חשב והזן את <strong>סטיית המדידה</strong>: קריאת המכשיר פחות ערך הייחוס המוסמך.<br><small style="color:#e05c00;font-weight:600;">⚠ הסימן חשוב — חיובי פירושו שהמכשיר קורא גבוה מדי; שלילי פירושו שקורא נמוך מדי. קריאה − ייחוס.</small>',
  'HE body.calibration'
);

// ── Telugu: correction factor → measurement deviation ────────────────────
replace(
  '<strong>దిద్దుబాటు కారకం</strong> లెక్కించి నమోదు చేయండి: నిజమైన సర్టిఫైడ్ విలువ పొందడానికి పరికరం రీడింగ్‌కు మీరు ఏమి ADD చేయాలి.<br><small style="color:#5a6480;">గుర్తు చేర్చండి — పరికరం తక్కువగా చదివితే ధనాత్మకం, ఎక్కువగా చదివితే ఋణాత్మకం.</small>',
  '<strong>కొలత విచలనం</strong> లెక్కించి నమోదు చేయండి: పరికరం రీడింగ్ మైనస్ సర్టిఫైడ్ రిఫరెన్స్ విలువ.<br><small style="color:#e05c00;font-weight:600;">⚠ గుర్తు ముఖ్యం — ధనాత్మకం అంటే పరికరం ఎక్కువగా చదువుతుంది; ఋణాత్మకం అంటే తక్కువగా చదువుతుంది. రీడింగ్ − రిఫరెన్స్.</small>',
  'TE body.calibration'
);

if (src === orig) {
  console.error('No changes made!');
  process.exit(1);
}

fs.writeFileSync(path, src, 'utf8');
console.log('\nDone. File written.');
