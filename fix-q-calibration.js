#!/usr/bin/env node
// Update all q.calibration question prompts from "correction factor" framing
// to "measurement deviation" framing to match body.calibration

const fs = require('fs');
const path = '/home/user/Trial-ofthe-matter/translations.js';
let src = fs.readFileSync(path, 'utf8');
const orig = src;

function replace(oldStr, newStr, label) {
  if (!src.includes(oldStr)) {
    console.error(`MISS [${label}]: "${oldStr.slice(0,80)}"`);
    return;
  }
  src = src.replace(oldStr, newStr);
  console.log(`OK [${label}]`);
}

// EN
replace(
  "'q.calibration':   'Calculate and enter the correction factor. The sign ± matters — enter the exact signed value:'",
  "'q.calibration':   'Calculate and enter the measurement deviation (instrument reading minus reference). The sign matters — enter the exact signed value:'",
  'EN q.calibration'
);

// DE
replace(
  "'q.calibration':   'Berechnen und geben Sie den Korrekturfaktor ein (mit Vorzeichen + oder −):'",
  "'q.calibration':   'Berechnen und geben Sie die Messabweichung ein (Messwert − Referenz, Vorzeichen + oder − erforderlich):'",
  'DE q.calibration'
);

// ES
replace(
  "'q.calibration':   'Calcula e ingresa el factor de corrección (incluye el signo + o −):'",
  "'q.calibration':   'Calcula e ingresa la desviación de medición (lectura − referencia, incluye el signo + o −):'",
  'ES q.calibration'
);

// PT-BR
replace(
  "'q.calibration':   'Calcule e insira o fator de correção (inclua o sinal + ou −):'",
  "'q.calibration':   'Calcule e insira o desvio de medição (leitura − referência, inclua o sinal + ou −):'",
  'PT-BR q.calibration'
);

// FR
replace(
  "'q.calibration':   'Calculez et entrez le facteur de correction (incluez le signe + ou −) :'",
  "'q.calibration':   'Calculez et entrez l\\'écart de mesure (lecture − référence, signe + ou − obligatoire) :'",
  'FR q.calibration'
);

// KO
replace(
  "'q.calibration':   '보정 계수를 계산하여 입력하세요 (부호 + 또는 − 포함):'",
  "'q.calibration':   '측정 편차를 계산하여 입력하세요 (기기 측정값 − 기준값, 부호 + 또는 − 필수):'",
  'KO q.calibration'
);

// DA
replace(
  "'q.calibration':   'Beregn og indtast korrektionsfaktoren (inkluder fortegnet + eller −):'",
  "'q.calibration':   'Beregn og indtast måleafvigelsen (aflæsning − reference, inkluder fortegnet + eller −):'",
  'DA q.calibration'
);

// ZH-HANS
replace(
  "'q.calibration':   '计算并输入校正因子（包含正负号 + 或 −）：'",
  "'q.calibration':   '计算并输入测量偏差（仪器读数 − 参考值，必须包含正负号 + 或 −）：'",
  'ZH-HANS q.calibration'
);

// ZH-HANT
replace(
  "'q.calibration':   '計算並輸入校正因子（包含正負號 + 或 −）：'",
  "'q.calibration':   '計算並輸入測量偏差（儀器讀數 − 參考值，必須包含正負號 + 或 −）：'",
  'ZH-HANT q.calibration'
);

// MS
replace(
  "'q.calibration':   'Kira dan masukkan faktor pembetulan (sertakan tanda + atau −):'",
  "'q.calibration':   'Kira dan masukkan sisihan pengukuran (bacaan − rujukan, sertakan tanda + atau −):'",
  'MS q.calibration'
);

// KN
replace(
  "'q.calibration':   'ಸರಿಪಡಿಸುವ ಅಂಶ ಲೆಕ್ಕ ಹಾಕಿ ಮತ್ತು ಹಾಕಿ (+ ಅಥವಾ − ಚಿಹ್ನೆ ಸೇರಿಸಿ):'",
  "'q.calibration':   'ಅಳತೆ ವ್ಯತ್ಯಾಸ ಲೆಕ್ಕ ಹಾಕಿ ಮತ್ತು ನಮೂದಿಸಿ (ಓದು − ಆಧಾರ, ಚಿಹ್ನೆ + ಅಥವಾ − ಅಗತ್ಯ):'",
  'KN q.calibration'
);

// TA
replace(
  "'q.calibration':   'திருத்தல் காரணியை கணக்கிட்டு உள்ளிடவும் (+ அல்லது − குறியுடன்):'",
  "'q.calibration':   'அளவீட்டு விலகலை கணக்கிட்டு உள்ளிடவும் (வாசிப்பு − குறிப்பு மதிப்பு, குறி + அல்லது − கட்டாயம்):'",
  'TA q.calibration'
);

// HI
replace(
  "'q.calibration':   'सुधार कारक की गणना करें और दर्ज करें (+ या − चिह्न सहित):'",
  "'q.calibration':   'माप विचलन की गणना करें और दर्ज करें (पठन − संदर्भ, चिह्न + या − आवश्यक):'",
  'HI q.calibration'
);

// SR-LATN
replace(
  "'q.calibration':   'Izračunajte i unesite faktor korekcije (uključite znak + ili −):'",
  "'q.calibration':   'Izračunajte i unesite mjerno odstupanje (očitavanje − referenca, predznak + ili − obavezan):'",
  'SR-LATN q.calibration'
);

// SR-CYRL
replace(
  "'q.calibration': 'Израчунајте и унесите фактор корекције (укључите знак + или −):'",
  "'q.calibration': 'Израчунајте и унесите мерно одступање (очитавање − референца, предзнак + или − обавезан):'",
  'SR-CYRL q.calibration'
);

// HE (RTL — keep colon-first format)
replace(
  "'q.calibration':   ':(חשב והזן את גורם התיקון (כולל הסימן + או −'",
  "'q.calibration':   ':(חשב והזן את סטיית המדידה (קריאה − ייחוס, הסימן + או − חובה'",
  'HE q.calibration'
);

// TE
replace(
  "'q.calibration':   'దిద్దుబాటు కారకం లెక్కించి నమోదు చేయండి (గుర్తు + లేదా − చేర్చండి):'",
  "'q.calibration':   'కొలత విచలనాన్ని లెక్కించి నమోదు చేయండి (రీడింగ్ − రిఫరెన్స్, గుర్తు + లేదా − అవసరం):'",
  'TE q.calibration'
);

if (src === orig) {
  console.error('\nNo changes made!');
  process.exit(1);
}

fs.writeFileSync(path, src, 'utf8');
console.log('\nDone. File written.');
