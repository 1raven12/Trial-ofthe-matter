#!/usr/bin/env node
// Fix fb.cal_bad: label says "standard/correction" framing but numbers show
// reading−reference order. Align label to "Deviation = reading − reference".

const fs = require('fs');
const path = '/home/user/Trial-ofthe-matter/translations.js';
let src = fs.readFileSync(path, 'utf8');
const orig = src;

function replace(oldStr, newStr, label) {
  if (!src.includes(oldStr)) {
    console.error(`MISS [${label}]: "${oldStr}"`);
    return;
  }
  src = src.replace(oldStr, newStr);
  console.log(`OK [${label}]`);
}

replace(
  "'fb.cal_bad':          'Incorrect. Correction = standard − reading = 12.53 − 12.50 = ?'",
  "'fb.cal_bad':          'Incorrect. Deviation = reading − reference = 12.53 − 12.50 = ?'",
  'EN fb.cal_bad'
);

replace(
  "'fb.cal_bad':          'Falsch. Korrekturfaktor = Referenz − Messung = 12,53 − 12,50 = ?'",
  "'fb.cal_bad':          'Falsch. Abweichung = Messwert − Referenz = 12,53 − 12,50 = ?'",
  'DE fb.cal_bad'
);

replace(
  "'fb.cal_bad':              'Incorrecto. Corrección = referencia − lectura = 12,53 − 12,50 = ?'",
  "'fb.cal_bad':              'Incorrecto. Desviación = lectura − referencia = 12,53 − 12,50 = ?'",
  'ES fb.cal_bad'
);

replace(
  "'fb.cal_bad':              'Incorreto. Correção = referência − leitura = 12,53 − 12,50 = ?'",
  "'fb.cal_bad':              'Incorreto. Desvio = leitura − referência = 12,53 − 12,50 = ?'",
  'PT-BR fb.cal_bad'
);

replace(
  "'fb.cal_bad':          'Incorrect. Facteur de correction = valeur de référence − lecture = 12,53 − 12,50 = ?'",
  "'fb.cal_bad':          'Incorrect. Écart = lecture − référence = 12,53 − 12,50 = ?'",
  'FR fb.cal_bad'
);

replace(
  "'fb.cal_bad':              '오답입니다. 수정 계수 = 기준값 − 측정값 = 12.53 − 12.50 = ?'",
  "'fb.cal_bad':              '오답입니다. 측정 편차 = 측정값 − 기준값 = 12.53 − 12.50 = ?'",
  'KO fb.cal_bad'
);

replace(
  "'fb.cal_bad':  'Forkert. Kontrollér regnestykket: hvad er afvigelsen? (måleinstrument − reference = 12,53 − 12,50 = ?)'",
  "'fb.cal_bad':  'Forkert. Afvigelse = aflæsning − reference = 12,53 − 12,50 = ?'",
  'DA fb.cal_bad'
);

replace(
  "'fb.cal_bad':              '不正确。修正值 = 标准值 − 读数 = 12.53 − 12.50 = ?'",
  "'fb.cal_bad':              '不正确。测量偏差 = 仪器读数 − 参考值 = 12.53 − 12.50 = ?'",
  'ZH-HANS fb.cal_bad'
);

replace(
  "'fb.cal_bad':              '不正確。校正值 = 標準值 − 讀數 = 12.53 − 12.50 = ?'",
  "'fb.cal_bad':              '不正確。測量偏差 = 儀器讀數 − 參考值 = 12.53 − 12.50 = ?'",
  'ZH-HANT fb.cal_bad'
);

replace(
  "'fb.cal_bad':              'Tidak betul. Pembetulan = nilai piawai − bacaan = 12.53 − 12.50 = ?'",
  "'fb.cal_bad':              'Tidak betul. Sisihan = bacaan − nilai rujukan = 12.53 − 12.50 = ?'",
  'MS fb.cal_bad'
);

replace(
  "'fb.cal_bad':          'ತಪ್ಪು. ಸರಿಪಡಿಸುವ ಅಂಶ = ಮಾನದಂಡ − ಓದು = 12.53 − 12.50 = ?'",
  "'fb.cal_bad':          'ತಪ್ಪು. ಅಳತೆ ವ್ಯತ್ಯಾಸ = ಉಪಕರಣ ಓದು − ಆಧಾರ = 12.53 − 12.50 = ?'",
  'KN fb.cal_bad'
);

replace(
  "'fb.cal_bad':          'தவறு. திருத்தம் = தரநிலை − படிப்பு = 12.53 − 12.50 = ?'",
  "'fb.cal_bad':          'தவறு. அளவீட்டு விலகல் = கருவி வாசிப்பு − குறிப்பு = 12.53 − 12.50 = ?'",
  'TA fb.cal_bad'
);

replace(
  "'fb.cal_bad':          'गलत। सुधार = मानक − पाठ्यांक = 12.53 − 12.50 = ?'",
  "'fb.cal_bad':          'गलत। माप विचलन = उपकरण पठन − संदर्भ = 12.53 − 12.50 = ?'",
  'HI fb.cal_bad'
);

replace(
  "'fb.cal_bad':          'Netačno. Korekcija = standard − očitavanje = 12,53 − 12,50 = ?'",
  "'fb.cal_bad':          'Netačno. Odstupanje = očitavanje − referenca = 12,53 − 12,50 = ?'",
  'SR-LATN fb.cal_bad'
);

replace(
  "'fb.cal_bad': 'Нетачно. Корекција = стандард − очитавање = 12,53 − 12,50 = ?'",
  "'fb.cal_bad': 'Нетачно. Одступање = очитавање − референца = 12,53 − 12,50 = ?'",
  'SR-CYRL fb.cal_bad'
);

replace(
  "'fb.cal_bad':          'שגוי. תיקון = תקן − קריאה = 12.53 − 12.50 = ?'",
  "'fb.cal_bad':          'שגוי. סטייה = קריאה − ייחוס = 12.53 − 12.50 = ?'",
  'HE fb.cal_bad'
);

replace(
  "'fb.cal_bad':          'సరికాదు. దిద్దుబాటు = ప్రమాణం − రీడింగ్ = 12.53 − 12.50 = ?'",
  "'fb.cal_bad':          'సరికాదు. విచలనం = రీడింగ్ − రిఫరెన్స్ = 12.53 − 12.50 = ?'",
  'TE fb.cal_bad'
);

if (src === orig) {
  console.error('\nNo changes made!');
  process.exit(1);
}

fs.writeFileSync(path, src, 'utf8');
console.log('\nDone. File written.');
