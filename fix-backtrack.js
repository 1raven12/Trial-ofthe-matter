#!/usr/bin/env node
// Fix 3: Backtracking mechanic — maintenance log moves from qaoffice to qclab
// - msg.capa_needs_maint: direct player BACK to QC Lab (all 17 languages)
// - room.desc.qaoffice: remove maintenance log mention (all languages that have it)
// - room.desc.qclab: add maintenance log mention (all languages)

const fs = require('fs');
const path = '/home/user/Trial-ofthe-matter/translations.js';
let src = fs.readFileSync(path, 'utf8');
const orig = src;
let ok = 0, miss = 0;

function replace(oldStr, newStr, label) {
  if (!src.includes(oldStr)) {
    console.error(`MISS [${label}]`);
    miss++;
    return;
  }
  src = src.replace(oldStr, newStr);
  console.log(`OK [${label}]`);
  ok++;
}

// ═══════════════════════════════════════════════════════
// msg.capa_needs_maint — direct player BACK to QC Lab
// ═══════════════════════════════════════════════════════
replace(
  `'msg.capa_needs_maint':   'CAPA workstation is open but you need evidence of the root cause before you can complete the analysis. Check the maintenance log on the side table.'`,
  `'msg.capa_needs_maint':   'CAPA workstation requires the maintenance log — go back to the QC Lab, it is on the side bench there.'`,
  'EN capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':   'CAPA-Arbeitsplatz ist geöffnet, aber Sie benötigen Belege für die Grundursache, bevor Sie die Analyse abschließen können. Prüfen Sie das Wartungsprotokoll auf dem Beistelltisch.'`,
  `'msg.capa_needs_maint':   'Der CAPA-Arbeitsplatz benötigt das Wartungsprotokoll — gehen Sie zurück ins QC-Labor, es liegt auf der Seitenbank dort.'`,
  'DE capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':   'La estación de trabajo CAPA está abierta, pero necesitas evidencia de la causa raíz antes de poder finalizar el análisis. Revisa el registro de mantenimiento en la mesa lateral.'`,
  `'msg.capa_needs_maint':   'La estación CAPA requiere el registro de mantenimiento — regresa al Laboratorio de CC, está en el banco lateral allí.'`,
  'ES capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':   'A estação de trabalho CAPA está aberta, mas você precisa de evidências da causa raiz antes de finalizar a análise. Verifique o registro de manutenção na mesa lateral.'`,
  `'msg.capa_needs_maint':   'A estação CAPA requer o registro de manutenção — volte ao Laboratório de CQ, ele está na bancada lateral lá.'`,
  'PT-BR capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':   'Le poste CAPA est ouvert, mais vous avez besoin de preuves de la cause première avant de pouvoir finaliser l\\'analyse. Vérifiez le journal de maintenance sur la table de côté.'`,
  `'msg.capa_needs_maint':   'Le poste CAPA requiert le journal de maintenance — retournez au laboratoire QC, il se trouve sur la paillasse latérale.'`,
  'FR capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':   'CAPA 워크스테이션이 열렸지만, 분석을 완료하기 전에 근본 원인의 증거가 필요합니다. 사이드 테이블의 유지보수 로그를 확인하세요.'`,
  `'msg.capa_needs_maint':   'CAPA 워크스테이션에 유지보수 로그가 필요합니다 — QC 실험실로 돌아가세요, 사이드 벤치에 있습니다.'`,
  'KO capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':  'Du skal gennemgå Vedligeholdelsesloggen og SOP-MAINT-009 for at gennemføre dette.'`,
  `'msg.capa_needs_maint':  'CAPA-stationen kræver vedligeholdelsesloggen — gå tilbage til QC-laboratoriet, den ligger på sidebænken der.'`,
  'DA capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':   'CAPA工作站已开放，但在完成分析前需要根本原因证据。请查看侧桌上的维护记录。'`,
  `'msg.capa_needs_maint':   'CAPA工作站需要维护记录——请返回质控实验室，维护记录在那里的侧面工作台上。'`,
  'ZH-HANS capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':   'CAPA工作站已開放，但在完成分析前需要根本原因證據。請查看側桌上的維護記錄。'`,
  `'msg.capa_needs_maint':   'CAPA工作站需要維護記錄——請返回品管實驗室，維護記錄在那裡的側面工作台上。'`,
  'ZH-HANT capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':   'Stesen kerja CAPA dibuka, tetapi anda memerlukan bukti punca akar sebelum boleh menyelesaikan analisis. Semak log penyelenggaraan di meja sisi.'`,
  `'msg.capa_needs_maint':   'Stesen kerja CAPA memerlukan log penyelenggaraan — kembali ke Makmal QC, ia ada di bangku sisi di sana.'`,
  'MS capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':   'CAPA ವರ್ಕ್‍‌ಸ್ಟೇಶನ್ ತೆರೆದಿದೆ ಆದರೆ ಮೂಲ ಕಾರಣದ ಸಾಕ್ಷ್ಯ ಬೇಕಾಗಿದೆ. ಬದಿ ಮೇಜಿನ ನಿರ್ವಹಣೆ ದಾಖಲೆ ಪರಿಶೀಲಿಸಿ.'`,
  `'msg.capa_needs_maint':   'CAPA ವರ್ಕ್‍‌ಸ್ಟೇಶನ್‍ಗೆ ನಿರ್ವಹಣೆ ದಾಖಲೆ ಬೇಕಾಗಿದೆ — QC ಪ್ರಯೋಗಾಲಯಕ್ಕೆ ಹಿಂದಿರುಗಿ, ಅದು ಅಲ್ಲಿ ಬದಿ ಬೆಂಚ್‍ನಲ್ಲಿ ಇದೆ.'`,
  'KN capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':   'CAPA பணிச்செய்கை திறந்துள்ளது, ஆனால் பகுப்பாய்வை முடிக்க மூல காரண ஆதாரம் தேவை. பக்க மேசையில் உள்ள பராமரிப்பு பதிவை சரிபார்க்கவும்.'`,
  `'msg.capa_needs_maint':   'CAPA நிலையத்திற்கு பராமரிப்பு பதிவு தேவை — QC ஆய்வகத்திற்கு திரும்பவும், அது அங்கே பக்க இடத்தில் உள்ளது.'`,
  'TA capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':  'CAPA वर्कस्टेशन खुला है — विश्लेषण से पहले साइड टेबल पर रखरखाव लॉग देखें।'`,
  `'msg.capa_needs_maint':  'CAPA वर्कस्टेशन के लिए रखरखाव लॉग आवश्यक है — QC प्रयोगशाला वापस जाएं, वह वहाँ साइड बेंच पर है।'`,
  'HI capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':   'CAPA radna stanica je otvorena, ali su vam potrebni dokazi o uzroku pre završetka analize. Proverite knjigu održavanja na bočnom stolu.'`,
  `'msg.capa_needs_maint':   'CAPA radna stanica zahtijeva dnevnik održavanja — idite nazad u QC laboratoriju, nalazi se na bočnoj klupi tamo.'`,
  'SR-LATN capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint': 'CAPA радна станица је отворена, али су вам потребни докази о узроку пре завршетка анализе. Проверите књигу одржавања на бочном столу.'`,
  `'msg.capa_needs_maint': 'CAPA радна станица захтева дневник одржавања — идите назад у QC лабораторију, налази се на бочној клупи тамо.'`,
  'SR-CYRL capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':  'תחנת CAPA פתוחה אך נדרשות ראיות לסיבה השורשית לפני השלמת הניתוח. בדוק את יומן התחזוקה על שולחן הצד.'`,
  `'msg.capa_needs_maint':  'תחנת CAPA דורשת את יומן התחזוקה — חזור למעבדת QC, הוא נמצא על ספסל הצד שם.'`,
  'HE capa_needs_maint'
);
replace(
  `'msg.capa_needs_maint':   'CAPA వర్క్‍‌స్టేషన్ తెరిచి ఉంది, కానీ విశ్లేషణ పూర్తి చేయడానికి ముందు మూల కారణానికి ఆధారాలు అవసరం. సైడ్ టేబుల్‍‌పై నిర్వహణ లాగ్ తనిఖీ చేయండి.'`,
  `'msg.capa_needs_maint':   'CAPA వర్క్‍‌స్టేషన్‍కు నిర్వహణ లాగ్ అవసరం — QC ప్రయోగశాలకు తిరిగి వెళ్ళండి, అది అక్కడ సైడ్ బెంచ్‍పై ఉంది.'`,
  'TE capa_needs_maint'
);

// ═══════════════════════════════════════════════════════
// room.desc.qaoffice — remove maintenance log mentions
// ═══════════════════════════════════════════════════════
// EN
replace(
  `'room.desc.qaoffice':   'The hub of quality operations. ISO 13485 clause labels run across the filing cabinets. The CAPA workstation shows: "NON-CONFORMANCE #NCR-0892 — AWAITING ROOT CAUSE ANALYSIS." A maintenance log has been left open on the side table — someone was in a hurry. An ISO 9001 management review board shows last quarter\\'s KPIs. The batch record safe on the wall requires CAPA + ISO 9001 + ISO 15378 verification to unlock. A framed quality pledge on the wall reads: "Progress in every step · Quality in every detail — We own our processes."'`,
  `'room.desc.qaoffice':   'The hub of quality operations. ISO 13485 clause labels run across the filing cabinets. The CAPA workstation shows: "NON-CONFORMANCE #NCR-0892 — AWAITING ROOT CAUSE ANALYSIS." An ISO 9001 management review board shows last quarter\\'s KPIs. The batch record safe on the wall requires CAPA + ISO 9001 + ISO 15378 verification to unlock. A framed quality pledge on the wall reads: "Progress in every step · Quality in every detail — We own our processes."'`,
  'EN room.desc.qaoffice'
);
// DE
replace(
  `'room.desc.qaoffice':   'Das Zentrum der Qualitätsoperationen. ISO-13485-Klauselbezeichnungen ziehen sich über alle Aktenschränke. Die CAPA-Workstation zeigt: „NICHTKONFORMITÄT #NCR-0892 — GRUNDURSACHENANALYSE AUSSTEHEND." Ein Wartungsprotokoll liegt offen auf dem Beistelltisch — jemand hatte es eilig. Ein ISO-9001-Managementbewertungs-Board zeigt die KPIs des letzten Quartals. Der Chargenprotokoll-Tresor an der Wand erfordert CAPA + ISO 9001 + ISO 15378 zur Öffnung. Ein gerahmtes Qualitätsversprechen an der Wand: „Fortschritt in jedem Schritt · Qualität in jedem Detail — Wir übernehmen Verantwortung für unsere Prozesse."'`,
  `'room.desc.qaoffice':   'Das Zentrum der Qualitätsoperationen. ISO-13485-Klauselbezeichnungen ziehen sich über alle Aktenschränke. Die CAPA-Workstation zeigt: „NICHTKONFORMITÄT #NCR-0892 — GRUNDURSACHENANALYSE AUSSTEHEND." Ein ISO-9001-Managementbewertungs-Board zeigt die KPIs des letzten Quartals. Der Chargenprotokoll-Tresor an der Wand erfordert CAPA + ISO 9001 + ISO 15378 zur Öffnung. Ein gerahmtes Qualitätsversprechen an der Wand: „Fortschritt in jedem Schritt · Qualität in jedem Detail — Wir übernehmen Verantwortung für unsere Prozesse."'`,
  'DE room.desc.qaoffice'
);
// FR
replace(
  `'room.desc.qaoffice':   'Le centre des opérations qualité. Les étiquettes des clauses ISO 13485 courent sur tous les classeurs. Le poste CAPA indique : « NON-CONFORMITÉ #NCR-0892 — ANALYSE CAUSE RACINE EN ATTENTE. » Un journal de maintenance a été laissé ouvert sur la table de côté — quelqu\\'un était pressé. Un tableau de revue de direction ISO 9001 affiche les KPI du trimestre passé. Le coffre des dossiers de lot au mur requiert CAPA + ISO 9001 + ISO 15378 pour s\\'ouvrir. Un engagement qualité encadré : « Progrès à chaque étape · Qualité dans chaque détail — Nous assumons nos processus. »'`,
  `'room.desc.qaoffice':   'Le centre des opérations qualité. Les étiquettes des clauses ISO 13485 courent sur tous les classeurs. Le poste CAPA indique : « NON-CONFORMITÉ #NCR-0892 — ANALYSE CAUSE RACINE EN ATTENTE. » Un tableau de revue de direction ISO 9001 affiche les KPI du trimestre passé. Le coffre des dossiers de lot au mur requiert CAPA + ISO 9001 + ISO 15378 pour s\\'ouvrir. Un engagement qualité encadré : « Progrès à chaque étape · Qualité dans chaque détail — Nous assumons nos processus. »'`,
  'FR room.desc.qaoffice'
);
// KN — remove "ನಿರ್ವಹಣೆ ದಾಖಲೆ ಬದಿ ಮೇಜಿನ ಮೇಲೆ ತೆರೆದಿದೆ."
replace(
  `'room.desc.qaoffice':   'ಗುಣಮಟ್ಟ ಕಾರ್ಯಾಚರಣೆ ಕೇಂದ್ರ. ISO 13485 ಕ್ಲಾಸ್ ಲೇಬಲ್ ಫೈಲಿಂಗ್ ಕ್ಯಾಬಿನೆಟ್ ಉದ್ದಕ್ಕೂ. CAPA ವರ್ಕ್‍‌ಸ್ಟೇಶನ್ ತೋರಿಸುತ್ತದೆ: "ಅಸಂಗತತೆ #NCR-0892 — ಮೂಲ ಕಾರಣ ವಿಶ್ಲೇಷಣೆ ಬಾಕಿ." ನಿರ್ವಹಣೆ ದಾಖಲೆ ಬದಿ ಮೇಜಿನ ಮೇಲೆ ತೆರೆದಿದೆ.'`,
  `'room.desc.qaoffice':   'ಗುಣಮಟ್ಟ ಕಾರ್ಯಾಚರಣೆ ಕೇಂದ್ರ. ISO 13485 ಕ್ಲಾಸ್ ಲೇಬಲ್ ಫೈಲಿಂಗ್ ಕ್ಯಾಬಿನೆಟ್ ಉದ್ದಕ್ಕೂ. CAPA ವರ್ಕ್‍‌ಸ್ಟೇಶನ್ ತೋರಿಸುತ್ತದೆ: "ಅಸಂಗತತೆ #NCR-0892 — ಮೂಲ ಕಾರಣ ವಿಶ್ಲೇಷಣೆ ಬಾಕಿ." CAPA ಪೂರ್ಣಗೊಳಿಸಲು ನಿರ್ವಹಣೆ ದಾಖಲೆ ಬೇಕಾಗಿದೆ — QC ಪ್ರಯೋಗಾಲಯಕ್ಕೆ ಹಿಂದಿರುಗಿ.'`,
  'KN room.desc.qaoffice'
);
// TA
replace(
  `'room.desc.qaoffice':   'தர செயல்பாடுகளின் மையம். ISO 13485 Clause லேபல்கள் கோப்பு அமைந்திருக்கு முழுவதும் பரவியுள்ளன. CAPA பணிச்செய்கை காட்டுகிறது: "இணக்கமின்மை #NCR-0892 — மூல காரண பகுப்பாய்வு காத்திருக்கிறது." பக்க மேசையில் பராமரிப்பு பதிவு திறந்தே விடப்பட்டுள்ளது — யாரோ அவசரப்பட்டனர். ISO 9001 மேலாண்மை சமீக்ஷை பலகை கடந்த காலாண்டு KPI களை காட்டுகிறது. சுவரில் தொகுதி பதிவு பாதுகாப்பு CAPA + ISO 9001 + ISO 15378 சரிபார்ப்பை திறக்க தேவைப்படுகிறது. சுவரில் சட்டகப்பட்ட தர சத்தியம்: "ஒவ்வொரு படியிலும் முன்னேற்றம் · ஒவ்வொரு விவரத்திலும் தரம் — நாம் நமது செயல்முறைகளை சொந்தமாக்குகிறோம்."'`,
  `'room.desc.qaoffice':   'தர செயல்பாடுகளின் மையம். ISO 13485 Clause லேபல்கள் கோப்பு அமைந்திருக்கு முழுவதும் பரவியுள்ளன. CAPA பணிச்செய்கை காட்டுகிறது: "இணக்கமின்மை #NCR-0892 — மூல காரண பகுப்பாய்வு காத்திருக்கிறது." ISO 9001 மேலாண்மை சமீக்ஷை பலகை கடந்த காலாண்டு KPI களை காட்டுகிறது. சுவரில் தொகுதி பதிவு பாதுகாப்பு CAPA + ISO 9001 + ISO 15378 சரிபார்ப்பை திறக்க தேவைப்படுகிறது. சுவரில் சட்டகப்பட்ட தர சத்தியம்: "ஒவ்வொரு படியிலும் முன்னேற்றம் · ஒவ்வொரு விவரத்திலும் தரம் — நாம் நமது செயல்முறைகளை சொந்தமாக்குகிறோம்."'`,
  'TA room.desc.qaoffice'
);
// HI
replace(
  `'room.desc.qaoffice':   'गुणवत्ता संचालन का केंद्र। फाइलिंग कैबिनेट पर ISO 13485 खंड लेबल हैं। CAPA वर्कस्टेशन दिखाता है: "असंगति #NCR-0892 — मूल कारण विश्लेषण प्रतीक्षित।" साइड टेबल पर रखरखाव लॉग खुला है। ISO 9001 प्रबंधन समीक्षा बोर्ड पर पिछली तिमाही के KPI हैं। दीवार पर बैच रिकॉर्ड सेफ के लिए CAPA + ISO 9001 + ISO 15378 सत्यापन आवश्यक है। फ्रेमबद्ध गुणवत्ता प्रतिज्ञा: "हर कदम में प्रगति · हर विवरण में गुणवत्ता — हम अपनी प्रक्रियाओं के मालिक हैं।"'`,
  `'room.desc.qaoffice':   'गुणवत्ता संचालन का केंद्र। फाइलिंग कैबिनेट पर ISO 13485 खंड लेबल हैं। CAPA वर्कस्टेशन दिखाता है: "असंगति #NCR-0892 — मूल कारण विश्लेषण प्रतीक्षित।" ISO 9001 प्रबंधन समीक्षा बोर्ड पर पिछली तिमाही के KPI हैं। दीवार पर बैच रिकॉर्ड सेफ के लिए CAPA + ISO 9001 + ISO 15378 सत्यापन आवश्यक है। फ्रेमबद्ध गुणवत्ता प्रतिज्ञा: "हर कदम में प्रगति · हर विवरण में गुणवत्ता — हम अपनी प्रक्रियाओं के मालिक हैं।"'`,
  'HI room.desc.qaoffice'
);
// SR-LATN
replace(
  `'room.desc.qaoffice':   'Centar operacija kvaliteta. Oznake klauzula ISO 13485 raspoređene su po ormanima. CAPA radna stanica prikazuje: "NEUSAGLAŠENOST #NCR-0892 — ČEKA SE ANALIZA UZROKA." Knjiga održavanja ostavljena je otvorena na bočnom stolu — neko je bio u žurbi. Tabla preispitivanja rukovodstva prema ISO 9001 pokazuje KPI-je iz prethodnog kvartala. Sef s evidencijama serije na zidu zahteva verifikaciju CAPA + ISO 9001 + ISO 15378 za otključavanje. Uramljena obaveza kvaliteta na zidu glasi: "Napredak u svakom koraku · Kvalitet u svakom detalju — Mi smo vlasnici svojih procesa."'`,
  `'room.desc.qaoffice':   'Centar operacija kvaliteta. Oznake klauzula ISO 13485 raspoređene su po ormanima. CAPA radna stanica prikazuje: "NEUSAGLAŠENOST #NCR-0892 — ČEKA SE ANALIZA UZROKA." Tabla preispitivanja rukovodstva prema ISO 9001 pokazuje KPI-je iz prethodnog kvartala. Sef s evidencijama serije na zidu zahteva verifikaciju CAPA + ISO 9001 + ISO 15378 za otključavanje. Uramljena obaveza kvaliteta na zidu glasi: "Napredak u svakom koraku · Kvalitet u svakom detalju — Mi smo vlasnici svojih procesa."'`,
  'SR-LATN room.desc.qaoffice'
);
// SR-CYRL
replace(
  `'room.desc.qaoffice': 'Центар операција квалитета. Ознаке клаузула ISO 13485 распоређене су по орманима. CAPA радна станица приказује: "НЕУСАГЛАШЕНОСТ #NCR-0892 — ЧЕКА СЕ АНАЛИЗА УЗРОКА." Књига одржавања остављена је отворена на бочном столу — неко је био у журби. Табла преиспитивања руководства према ISO 9001 показује KPI-је из претходног квартала. Сеф с евиденцијама серије на зиду захтева верификацију CAPA + ISO 9001 + ISO 15378 за откључавање. Урамљена обавеза квалитета на зиду гласи: "Напредак у сваком кораку · Квалитет у сваком детаљу — Ми смо власници својих процеса."'`,
  `'room.desc.qaoffice': 'Центар операција квалитета. Ознаке клаузула ISO 13485 распоређене су по орманима. CAPA радна станица приказује: "НЕУСАГЛАШЕНОСТ #NCR-0892 — ЧЕКА СЕ АНАЛИЗА УЗРОКА." Табла преиспитивања руководства према ISO 9001 показује KPI-је из претходног квартала. Сеф с евиденцијама серије на зиду захтева верификацију CAPA + ISO 9001 + ISO 15378 за откључавање. Урамљена обавеза квалитета на зиду гласи: "Напредак у сваком кораку · Квалитет у сваком детаљу — Ми смо власници својих процеса."'`,
  'SR-CYRL room.desc.qaoffice'
);
// HE
replace(
  `'room.desc.qaoffice':   'מוקד פעולות האיכות. תוויות סעיפי ISO 13485 מפוזרות על ארוניות התיוק. תחנת ה-CAPA מציגה: "אי-התאמה מספר NCR-0892 — ממתין לניתוח סיבה שורשית." יומן תחזוקה הושאר פתוח על שולחן הצד — מישהו היה ממהר. לוח סקירת הנהלה ISO 9001 מציג את KPI של הרבעון האחרון. כספת רשומות האצווה שעל הקיר דורשת אימות CAPA + ISO 9001 + ISO 15378 לפתיחה. מסגרת התחייבות איכות על הקיר קוראת: "התקדמות בכל שלב · איכות בכל פרט — אנחנו הבעלים של התהליכים שלנו."'`,
  `'room.desc.qaoffice':   'מוקד פעולות האיכות. תוויות סעיפי ISO 13485 מפוזרות על ארוניות התיוק. תחנת ה-CAPA מציגה: "אי-התאמה מספר NCR-0892 — ממתין לניתוח סיבה שורשית." לוח סקירת הנהלה ISO 9001 מציג את KPI של הרבעון האחרון. כספת רשומות האצווה שעל הקיר דורשת אימות CAPA + ISO 9001 + ISO 15378 לפתיחה. מסגרת התחייבות איכות על הקיר קוראת: "התקדמות בכל שלב · איכות בכל פרט — אנחנו הבעלים של התהליכים שלנו."'`,
  'HE room.desc.qaoffice'
);
// TE
replace(
  `'room.desc.qaoffice':   'నాణ్యత కార్యకలాపాల కేంద్రం. ఫైలింగ్ క్యాబినెట్‍‌లపై ISO 13485 క్లాజ్ లేబుల్స్ ఉన్నాయి. CAPA వర్క్‍‌స్టేషన్: "అనుసరణ రాహిత్యం #NCR-0892 — మూల కారణ విశ్లేషణ పెండింగ్‍‌లో." సైడ్ టేబుల్‍‌పై నిర్వహణ లాగ్ తెరిచి ఉంది. ISO 9001 మేనేజ్‍‌మెంట్ రివ్యూ బోర్డ్ గత త్రైమాసిక KPIs చూపిస్తోంది. గోడ మీద బ్యాచ్ రికార్డ్ సేఫ్‍కు CAPA + ISO 9001 + ISO 15378 ధృవీకరణ అవసరం. గోడపై నాణ్యత ప్రతిజ్ఞ: "ప్రతి అడుగులో పురోగతి · ప్రతి వివరంలో నాణ్యత — మేము మా ప్రక్రియలకు యజమానులం."'`,
  `'room.desc.qaoffice':   'నాణ్యత కార్యకలాపాల కేంద్రం. ఫైలింగ్ క్యాబినెట్‍‌లపై ISO 13485 క్లాజ్ లేబుల్స్ ఉన్నాయి. CAPA వర్క్‍‌స్టేషన్: "అనుసరణ రాహిత్యం #NCR-0892 — మూల కారణ విశ్లేషణ పెండింగ్‍‌లో." ISO 9001 మేనేజ్‍‌మెంట్ రివ్యూ బోర్డ్ గత త్రైమాసిక KPIs చూపిస్తోంది. గోడ మీద బ్యాచ్ రికార్డ్ సేఫ్‍కు CAPA + ISO 9001 + ISO 15378 ధృవీకరణ అవసరం. గోడపై నాణ్యత ప్రతిజ్ఞ: "ప్రతి అడుగులో పురోగతి · ప్రతి వివరంలో నాణ్యత — మేము మా ప్రక్రియలకు యజమానులం."'`,
  'TE room.desc.qaoffice'
);

// ═══════════════════════════════════════════════════════
// room.desc.qclab — add maintenance log mention
// ═══════════════════════════════════════════════════════
// EN
replace(
  `'room.desc.qclab':      'The QC lab smells of IPA and calibration fluid. Dimensional gauges, particle counters, and sterility test equipment line the benches. A micrometer station in the corner carries a yellow "OUT OF CALIBRATION — DO NOT USE" sticker. The calibration reference cabinet is mounted on the wall. A sign on the QA Office door: "CALIBRATION SIGN-OFF REQUIRED FOR ENTRY." The ISO 15378 packaging compliance file sits on the far bench. Above the bench, the site motto is printed in bold: "Progress in every step · Quality in every detail."'`,
  `'room.desc.qclab':      'The QC lab smells of IPA and calibration fluid. Dimensional gauges, particle counters, and sterility test equipment line the benches. A micrometer station in the corner carries a yellow "OUT OF CALIBRATION — DO NOT USE" sticker. The calibration reference cabinet is mounted on the wall. A sign on the QA Office door: "CALIBRATION SIGN-OFF REQUIRED FOR ENTRY." The ISO 15378 packaging compliance file sits on the far bench. A maintenance log from Station 3 is open on the side bench — it looks like it was pulled during the investigation. Above the bench, the site motto is printed in bold: "Progress in every step · Quality in every detail."'`,
  'EN room.desc.qclab'
);
// DE
replace(
  `'room.desc.qclab':      'Das QK-Labor riecht nach IPA und Kalibrierflüssigkeit. Dimensionsmessgeräte, Partikelzähler und Sterilitätsprüfgeräte stehen auf den Werkbänken. Ein Mikrometer-Station in der Ecke trägt einen gelben Aufkleber „AUSSER KALIBRIERUNG — NICHT VERWENDEN". Der Kalibrierungs-Referenzschrank ist an der Wand montiert. An der Tür zum QA-Büro: „KALIBRIERUNGSFREIGABE FÜR ZUGANG ERFORDERLICH." Die ISO-15378-Verpackungskonformitätsakte liegt auf der hinteren Werkbank. Über der Werkbank das Standort-Motto: „Fortschritt in jedem Schritt · Qualität in jedem Detail."'`,
  `'room.desc.qclab':      'Das QK-Labor riecht nach IPA und Kalibrierflüssigkeit. Dimensionsmessgeräte, Partikelzähler und Sterilitätsprüfgeräte stehen auf den Werkbänken. Ein Mikrometer-Station in der Ecke trägt einen gelben Aufkleber „AUSSER KALIBRIERUNG — NICHT VERWENDEN". Der Kalibrierungs-Referenzschrank ist an der Wand montiert. An der Tür zum QA-Büro: „KALIBRIERUNGSFREIGABE FÜR ZUGANG ERFORDERLICH." Die ISO-15378-Verpackungskonformitätsakte liegt auf der hinteren Werkbank. Ein Wartungsprotokoll von Station 3 liegt offen auf der Seitenbank — es wurde offenbar während der Untersuchung herausgezogen. Über der Werkbank das Standort-Motto: „Fortschritt in jedem Schritt · Qualität in jedem Detail."'`,
  'DE room.desc.qclab'
);
// ES
replace(
  `'room.desc.qclab':       'El laboratorio de CC huele a alcohol isopropílico y fluido de calibración. Calibradores dimensionales, contadores de partículas y equipos de pruebas de esterilidad cubren las mesas. Una estación de micrómetro lleva una etiqueta amarilla "FUERA DE CALIBRACIÓN".'`,
  `'room.desc.qclab':       'El laboratorio de CC huele a alcohol isopropílico y fluido de calibración. Calibradores dimensionales, contadores de partículas y equipos de pruebas de esterilidad cubren las mesas. Una estación de micrómetro lleva una etiqueta amarilla "FUERA DE CALIBRACIÓN". Un registro de mantenimiento de la Estación 3 está abierto en el banco lateral — parece que fue sacado durante la investigación.'`,
  'ES room.desc.qclab'
);
// ES qaoffice (short, add hint)
replace(
  `'room.desc.qaoffice':    'El centro de las operaciones de calidad. Las etiquetas de cláusulas de la ISO 13485 recorren los archivadores. La estación de trabajo CAPA muestra: "NO CONFORMIDAD #NCR-0892 — PENDIENTE DE ANÁLISIS DE CAUSA RAÍZ".'`,
  `'room.desc.qaoffice':    'El centro de las operaciones de calidad. Las etiquetas de cláusulas de la ISO 13485 recorren los archivadores. La estación de trabajo CAPA muestra: "NO CONFORMIDAD #NCR-0892 — PENDIENTE DE ANÁLISIS DE CAUSA RAÍZ". Para el CAPA necesitas el registro de mantenimiento — búscalo en el Laboratorio de CC.'`,
  'ES room.desc.qaoffice'
);
// PT-BR
replace(
  `'room.desc.qclab':       'O laboratório de CQ cheira a IPA e fluido de calibração. Gabaritos dimensionais, contadores de partículas e equipamentos de teste de esterilidade cobrem as bancadas. Uma estação de micrômetro no canto tem um adesivo amarelo "FORA DE CALIBRAÇÃO — NÃO USAR".'`,
  `'room.desc.qclab':       'O laboratório de CQ cheira a IPA e fluido de calibração. Gabaritos dimensionais, contadores de partículas e equipamentos de teste de esterilidade cobrem as bancadas. Uma estação de micrômetro no canto tem um adesivo amarelo "FORA DE CALIBRAÇÃO — NÃO USAR". Um registro de manutenção da Estação 3 está aberto na bancada lateral — parece que foi retirado durante a investigação.'`,
  'PT-BR room.desc.qclab'
);
replace(
  `'room.desc.qaoffice':    'O centro das operações de qualidade. Etiquetas das cláusulas da ISO 13485 percorrem os arquivos. A estação de trabalho CAPA exibe: "NÃO CONFORMIDADE #NCR-0892 — AGUARDANDO ANÁLISE DE CAUSA RAIZ."'`,
  `'room.desc.qaoffice':    'O centro das operações de qualidade. Etiquetas das cláusulas da ISO 13485 percorrem os arquivos. A estação de trabalho CAPA exibe: "NÃO CONFORMIDADE #NCR-0892 — AGUARDANDO ANÁLISE DE CAUSA RAIZ." Para completar o CAPA, você precisa do registro de manutenção — encontre-o no Laboratório de CQ.'`,
  'PT-BR room.desc.qaoffice'
);
// FR
replace(
  `'room.desc.qclab':      'Le laboratoire QC sent l\\'IPA et le liquide d\\'étalonnage. Des jauges dimensionnelles, des compteurs de particules et des équipements de test de stérilité garnissent les paillasses. Un poste micromètre dans le coin porte un autocollant jaune « HORS ÉTALONNAGE — NE PAS UTILISER ». L\\'armoire de référence d\\'étalonnage est fixée au mur. Panneau sur la porte du bureau QA : « VALIDATION DE L\\'ÉTALONNAGE REQUISE POUR L\\'ACCÈS. » Le dossier de conformité emballage ISO 15378 se trouve sur la paillasse du fond. Au-dessus de la paillasse, le motto du site : « Progrès à chaque étape · Qualité dans chaque détail. »'`,
  `'room.desc.qclab':      'Le laboratoire QC sent l\\'IPA et le liquide d\\'étalonnage. Des jauges dimensionnelles, des compteurs de particules et des équipements de test de stérilité garnissent les paillasses. Un poste micromètre dans le coin porte un autocollant jaune « HORS ÉTALONNAGE — NE PAS UTILISER ». L\\'armoire de référence d\\'étalonnage est fixée au mur. Panneau sur la porte du bureau QA : « VALIDATION DE L\\'ÉTALONNAGE REQUISE POUR L\\'ACCÈS. » Le dossier de conformité emballage ISO 15378 se trouve sur la paillasse du fond. Un journal de maintenance de la station 3 est ouvert sur la paillasse latérale — il semble avoir été sorti pendant l\\'enquête. Au-dessus de la paillasse, le motto du site : « Progrès à chaque étape · Qualité dans chaque détail. »'`,
  'FR room.desc.qclab'
);
// KO
replace(
  `'room.desc.qclab':       'QC 실험실에서는 IPA와 교정 액체 냄새가 납니다. 치수 게이지, 입자 계수기, 무균 검사 장비가 작업대를 가득 채우고 있습니다. 모서리의 마이크로미터 스테이션에는 노란 "교정 기한 초과 — 사용 금지" 스티커가 붙어 있습니다.'`,
  `'room.desc.qclab':       'QC 실험실에서는 IPA와 교정 액체 냄새가 납니다. 치수 게이지, 입자 계수기, 무균 검사 장비가 작업대를 가득 채우고 있습니다. 모서리의 마이크로미터 스테이션에는 노란 "교정 기한 초과 — 사용 금지" 스티커가 붙어 있습니다. 스테이션 3 유지보수 로그가 사이드 벤치에 펼쳐져 있습니다 — 조사 중에 꺼낸 것으로 보입니다.'`,
  'KO room.desc.qclab'
);
replace(
  `'room.desc.qaoffice':    '품질 운영의 중심부입니다. ISO 13485 조항 레이블이 파일 캐비닛에 붙어 있습니다. CAPA 워크스테이션에 표시됩니다: "부적합 #NCR-0892 — 근본 원인 분석 대기 중."'`,
  `'room.desc.qaoffice':    '품질 운영의 중심부입니다. ISO 13485 조항 레이블이 파일 캐비닛에 붙어 있습니다. CAPA 워크스테이션에 표시됩니다: "부적합 #NCR-0892 — 근본 원인 분석 대기 중." CAPA를 완료하려면 유지보수 로그가 필요합니다 — QC 실험실에서 찾으세요.'`,
  'KO room.desc.qaoffice'
);
// DA
replace(
  `'room.desc.qaoffice':  'Gennemgå CAPA-rapporten og bekræft korrigerende foranstaltninger.'`,
  `'room.desc.qaoffice':  'Det centrale QA-kontor. CAPA-arbejdsstationen viser NCR-0892. For at gennemføre CAPA skal du bruge vedligeholdelsesloggen — find den i QC-laboratoriet.'`,
  'DA room.desc.qaoffice'
);
replace(
  `'room.desc.qclab':  'Verificér instrumentkalibrering og gennemfør AQL-inspektionsanalyse.'`,
  `'room.desc.qclab':  'QC-laboratoriet: verificér instrumentkalibrering og gennemfør AQL-inspektionsanalyse. Vedligeholdelsesloggen fra Station 3 er åben på sidebænken — den ser ud til at være trukket frem under undersøgelsen.'`,
  'DA room.desc.qclab'
);
// ZH-HANS
replace(
  `'room.desc.qclab':       '质量控制实验室弥漫着异丙醇和校准液的气味。工作台上摆满尺寸量规、粒子计数仪及无菌测试设备。角落的千分尺工作站贴有黄色"超期未校准——禁止使用"标签。'`,
  `'room.desc.qclab':       '质量控制实验室弥漫着异丙醇和校准液的气味。工作台上摆满尺寸量规、粒子计数仪及无菌测试设备。角落的千分尺工作站贴有黄色"超期未校准——禁止使用"标签。3号工位的维护记录摊开在侧面工作台上——看起来是调查期间取出的。'`,
  'ZH-HANS room.desc.qclab'
);
replace(
  `'room.desc.qaoffice':    '质量运营的核心所在。档案柜上标有ISO 13485各条款标签。CAPA工作站显示："不合格 #NCR-0892——等待根本原因分析。"'`,
  `'room.desc.qaoffice':    '质量运营的核心所在。档案柜上标有ISO 13485各条款标签。CAPA工作站显示："不合格 #NCR-0892——等待根本原因分析。"完成CAPA分析需要维护记录——请返回质控实验室查找。'`,
  'ZH-HANS room.desc.qaoffice'
);
// ZH-HANT
replace(
  `'room.desc.qclab':       '品質管制實驗室瀰漫著異丙醇和校準液的氣味。工作台上擺滿尺寸量規、粒子計數儀及無菌測試設備。角落的千分尺工作站貼有黃色「逾期未校準——禁止使用」標籤。'`,
  `'room.desc.qclab':       '品質管制實驗室瀰漫著異丙醇和校準液的氣味。工作台上擺滿尺寸量規、粒子計數儀及無菌測試設備。角落的千分尺工作站貼有黃色「逾期未校準——禁止使用」標籤。3號工位的維護記錄攤開在側面工作台上——看起來是調查期間取出的。'`,
  'ZH-HANT room.desc.qclab'
);
replace(
  `'room.desc.qaoffice':    '品質營運的核心所在。檔案櫃上標有 ISO 13485 各條款標籤。CAPA 工作站顯示：「不符合 #NCR-0892——等待根本原因分析。」'`,
  `'room.desc.qaoffice':    '品質營運的核心所在。檔案櫃上標有 ISO 13485 各條款標籤。CAPA 工作站顯示：「不符合 #NCR-0892——等待根本原因分析。」完成CAPA分析需要維護記錄——請返回品管實驗室查找。'`,
  'ZH-HANT room.desc.qaoffice'
);
// MS
replace(
  `'room.desc.qclab':       'Makmal kawalan kualiti berbau isopropanol dan cecair penentukuran. Meja kerja dipenuhi tolok dimensi, pembilang zarah dan peralatan ujian kesterilan. Stesen mikrometer di sudut mempunyai label kuning "TAMAT TEMPOH — JANGAN GUNA".'`,
  `'room.desc.qclab':       'Makmal kawalan kualiti berbau isopropanol dan cecair penentukuran. Meja kerja dipenuhi tolok dimensi, pembilang zarah dan peralatan ujian kesterilan. Stesen mikrometer di sudut mempunyai label kuning "TAMAT TEMPOH — JANGAN GUNA". Log penyelenggaraan dari Stesen 3 dibuka di bangku sisi — ia kelihatan seperti dikeluarkan semasa siasatan.'`,
  'MS room.desc.qclab'
);
replace(
  `'room.desc.qaoffice':    'Pusat operasi kualiti. Kabinet fail dilabel dengan klausa ISO 13485. Stesen kerja CAPA memaparkan: "Ketidakakuran #NCR-0892 — Menunggu analisis punca akar."'`,
  `'room.desc.qaoffice':    'Pusat operasi kualiti. Kabinet fail dilabel dengan klausa ISO 13485. Stesen kerja CAPA memaparkan: "Ketidakakuran #NCR-0892 — Menunggu analisis punca akar." Untuk melengkapkan CAPA, anda memerlukan log penyelenggaraan — carinya di Makmal QC.'`,
  'MS room.desc.qaoffice'
);
// KN
replace(
  `'room.desc.qclab':      'QC ಪ್ರಯೋಗಾಲಯ IPA ಮತ್ತು ಮಾಪನಾಂಶ ದ್ರವ ವಾಸನೆ. ಆಯಾಮ ಮಾಪಕ, ಕಣ ಎಣಿಕೆ ಮತ್ತು ಕ್ರಿಮಿ ಪರೀಕ್ಷಾ ಉಪಕರಣ ಮೇಜಿನ ಮೇಲೆ ಸಾಲಾಗಿ. ಮೂಲೆಯ ಮೈಕ್ರೋಮೀಟರ್ ನಿಲ್ದಾಣ ಹಳದಿ "ಮಾಪನಾಂಶ ಮೀಯಾದಿ ಮೀರಿದೆ — ಬಳಸಬೇಡಿ" ಸ್ಟಿಕ್ಕರ್ ಹೊಂದಿದೆ.'`,
  `'room.desc.qclab':      'QC ಪ್ರಯೋಗಾಲಯ IPA ಮತ್ತು ಮಾಪನಾಂಶ ದ್ರವ ವಾಸನೆ. ಆಯಾಮ ಮಾಪಕ, ಕಣ ಎಣಿಕೆ ಮತ್ತು ಕ್ರಿಮಿ ಪರೀಕ್ಷಾ ಉಪಕರಣ ಮೇಜಿನ ಮೇಲೆ ಸಾಲಾಗಿ. ಮೂಲೆಯ ಮೈಕ್ರೋಮೀಟರ್ ನಿಲ್ದಾಣ ಹಳದಿ "ಮಾಪನಾಂಶ ಮೀಯಾದಿ ಮೀರಿದೆ — ಬಳಸಬೇಡಿ" ಸ್ಟಿಕ್ಕರ್ ಹೊಂದಿದೆ. ನಿಲ್ದಾಣ 3 ಸ್ಟೇಷನ್‌ನ ನಿರ್ವಹಣೆ ದಾಖಲೆ ಬದಿ ಬೆಂಚ್‌ನಲ್ಲಿ ತೆರೆದಿದೆ — ತನಿಖೆ ಸಮಯ ತೆಗೆದಂತೆ ಕಾಣುತ್ತಿದೆ.'`,
  'KN room.desc.qclab'
);
// TA
replace(
  `'room.desc.qclab':      'QC ஆய்வகம் IPA மற்றும் அளவீட்டு திரவத்தின் வாசனையை கொண்டுள்ளது. பரிமாண அளவிகள், துகள் எண்ணிகள் மற்றும் மலட்டுத்தன்மை சோதனை கருவிகள் மேசைகளில் வரிசையாக உள்ளன. மூலையில் உள்ள மைக்ரோமீட்டர் நிலையத்தில் மஞ்சள் "அளவீட்டிற்கு வெளியே — பயன்படுத்த வேண்டாம்" ஸ்டிக்கர் உள்ளது. அளவீட்டு குறிப்பு அமைச்சரவை சுவரில் பொருத்தப்பட்டுள்ளது. QA அலுவலக கதவில் ஒரு அடையாளம்: "நுழைவிற்கு அளவீட்டு கையொப்பம் தேவை." ISO 15378 பேக்கேஜிங் இணக்கக் கோப்பு தொலைதூர மேசையில் உள்ளது. மேசைக்கு மேல் தளத்தின் முழக்கம்: "ஒவ்வொரு படியிலும் முன்னேற்றம் · ஒவ்வொரு விவரத்திலும் தரம்."'`,
  `'room.desc.qclab':      'QC ஆய்வகம் IPA மற்றும் அளவீட்டு திரவத்தின் வாசனையை கொண்டுள்ளது. பரிமாண அளவிகள், துகள் எண்ணிகள் மற்றும் மலட்டுத்தன்மை சோதனை கருவிகள் மேசைகளில் வரிசையாக உள்ளன. மூலையில் உள்ள மைக்ரோமீட்டர் நிலையத்தில் மஞ்சள் "அளவீட்டிற்கு வெளியே — பயன்படுத்த வேண்டாம்" ஸ்டிக்கர் உள்ளது. அளவீட்டு குறிப்பு அமைச்சரவை சுவரில் பொருத்தப்பட்டுள்ளது. QA அலுவலக கதவில் ஒரு அடையாளம்: "நுழைவிற்கு அளவீட்டு கையொப்பம் தேவை." ISO 15378 பேக்கேஜிங் இணக்கக் கோப்பு தொலைதூர மேசையில் உள்ளது. நிலையம் 3-இன் பராமரிப்பு பதிவு பக்க மேசையில் திறந்திருக்கிறது — விசாரணையின் போது எடுக்கப்பட்டதாகத் தெரிகிறது. மேசைக்கு மேல் தளத்தின் முழக்கம்: "ஒவ்வொரு படியிலும் முன்னேற்றம் · ஒவ்வொரு விவரத்திலும் தரம்."'`,
  'TA room.desc.qclab'
);
// HI
replace(
  `'room.desc.qclab':      'QC लैब में IPA और कैलिब्रेशन फ्लूड की गंध है। बेंच पर आयामी गेज, कण काउंटर और बंध्यता परीक्षण उपकरण हैं। कोने में माइक्रोमीटर स्टेशन पर "कैलिब्रेशन से बाहर — उपयोग न करें" का पीला स्टिकर है। कैलिब्रेशन संदर्भ कैबिनेट दीवार पर है। QA कार्यालय के दरवाजे पर: "प्रवेश के लिए कैलिब्रेशन साइन-ऑफ आवश्यक।" दूर की बेंच पर ISO 15378 पैकेजिंग अनुपालन फ़ाइल है। बेंच के ऊपर: "हर कदम में प्रगति · हर विवरण में गुणवत्ता।"'`,
  `'room.desc.qclab':      'QC लैब में IPA और कैलिब्रेशन फ्लूड की गंध है। बेंच पर आयामी गेज, कण काउंटर और बंध्यता परीक्षण उपकरण हैं। कोने में माइक्रोमीटर स्टेशन पर "कैलिब्रेशन से बाहर — उपयोग न करें" का पीला स्टिकर है। कैलिब्रेशन संदर्भ कैबिनेट दीवार पर है। QA कार्यालय के दरवाजे पर: "प्रवेश के लिए कैलिब्रेशन साइन-ऑफ आवश्यक।" दूर की बेंच पर ISO 15378 पैकेजिंग अनुपालन फ़ाइल है। स्टेशन 3 का रखरखाव लॉग साइड बेंच पर खुला है — जांच के दौरान निकाला गया लगता है। बेंच के ऊपर: "हर कदम में प्रगति · हर विवरण में गुणवत्ता।"'`,
  'HI room.desc.qclab'
);
// SR-LATN
replace(
  `'room.desc.qclab':      'QC laboratorija miriše na IPA i kalibracionu tečnost. Dimenzionalna merila, brojači čestica i oprema za ispitivanje sterilnosti postavljeni su po klupama. Mikrometarska stanica u uglu nosi žutu nalepnicu "VAN KALIBRACIJE — NE KORISTITI". Orman sa kalibracionim standardima montiran je na zid. Natpis na vratima QA kancelarije: "ZA ULAZ POTREBNA KALIBRACIJA." Fajl za usaglašenost sa ISO 15378 leži na dalekoj klupi. Iznad klupe, moto postrojenja je odštampan podebljanim slovima: "Napredak u svakom koraku · Kvalitet u svakom detalju."'`,
  `'room.desc.qclab':      'QC laboratorija miriše na IPA i kalibracionu tečnost. Dimenzionalna merila, brojači čestica i oprema za ispitivanje sterilnosti postavljeni su po klupama. Mikrometarska stanica u uglu nosi žutu nalepnicu "VAN KALIBRACIJE — NE KORISTITI". Orman sa kalibracionim standardima montiran je na zid. Natpis na vratima QA kancelarije: "ZA ULAZ POTREBNA KALIBRACIJA." Fajl za usaglašenost sa ISO 15378 leži na dalekoj klupi. Knjiga održavanja stanice 3 otvorena je na bočnoj klupi — izgleda da je izvučena tokom istrage. Iznad klupe, moto postrojenja je odštampan podebljanim slovima: "Napredak u svakom koraku · Kvalitet u svakom detalju."'`,
  'SR-LATN room.desc.qclab'
);
// SR-CYRL
replace(
  `'room.desc.qclab': 'QC лабораторија мирише на IPA и калибрациону течност. Димензионална мерила, бројачи честица и опрема за испитивање стерилности постављени су по клупама. Микрометарска станица у углу носи жуту налепницу "ВАН КАЛИБРАЦИЈЕ — НЕ КОРИСТИТИ". Орман са калибрационим стандардима монтиран је на зид. Натпис на вратима QA канцеларије: "ЗА УЛАЗ ПОТРЕБНА КАЛИБРАЦИЈА." Фајл за усаглашеност са ISO 15378 лежи на далекој клупи. Изнад клупе, мото постројења је одштампан подебљаним словима: "Напредак у сваком кораку · Квалитет у сваком детаљу."'`,
  `'room.desc.qclab': 'QC лабораторија мирише на IPA и калибрациону течност. Димензионална мерила, бројачи честица и опрема за испитивање стерилности постављени су по клупама. Микрометарска станица у углу носи жуту налепницу "ВАН КАЛИБРАЦИЈЕ — НЕ КОРИСТИТИ". Орман са калибрационим стандардима монтиран је на зид. Натпис на вратима QA канцеларије: "ЗА УЛАЗ ПОТРЕБНА КАЛИБРАЦИЈА." Фајл за усаглашеност са ISO 15378 лежи на далекој клупи. Књига одржавања станице 3 отворена је на бочној клупи — изгледа да је извучена током истраге. Изнад клупе, мото постројења је одштампан подебљаним словима: "Напредак у сваком кораку · Квалитет у сваком детаљу."'`,
  'SR-CYRL room.desc.qclab'
);
// HE
replace(
  `'room.desc.qclab':      'מעבדת QC ריחנית IPA ונוזל כיול. מדי ממד, מונים לחלקיקים וציוד בדיקות סטריליות מרופדים על הספסלים. תחנת מיקרומטר בפינה נושאת מדבקת "מחוץ לכיול — אין להשתמש" צהובה. ארון ייחוס הכיול מותקן על הקיר. שלט על דלת משרד QA: "נדרשת חתימת כיול לכניסה." קובץ ציות האריזה ISO 15378 נמצא על הספסל הרחוק. מעל הספסל מוטו האתר מודפס בהדגשה: "התקדמות בכל שלב · איכות בכל פרט."'`,
  `'room.desc.qclab':      'מעבדת QC ריחנית IPA ונוזל כיול. מדי ממד, מונים לחלקיקים וציוד בדיקות סטריליות מרופדים על הספסלים. תחנת מיקרומטר בפינה נושאת מדבקת "מחוץ לכיול — אין להשתמש" צהובה. ארון ייחוס הכיול מותקן על הקיר. שלט על דלת משרד QA: "נדרשת חתימת כיול לכניסה." קובץ ציות האריזה ISO 15378 נמצא על הספסל הרחוק. יומן תחזוקה של תחנה 3 פתוח על ספסל הצד — נראה שנלקח במהלך החקירה. מעל הספסל מוטו האתר מודפס בהדגשה: "התקדמות בכל שלב · איכות בכל פרט."'`,
  'HE room.desc.qclab'
);
// TE
replace(
  `'room.desc.qclab':      'QC ల్యాబ్‍‌లో IPA మరియు క్రమాంకన ద్రవపు వాసన వస్తోంది. డైమెన్షనల్ గేజ్‍‌లు, పార్టికల్ కౌంటర్‍‌లు మరియు స్టెరిలిటీ టెస్ట్ పరికరాలు బెంచ్‍‌లపై ఉన్నాయి. మూలలో మైక్రోమీటర్ స్టేషన్‍‌పై పసుపు "క్రమాంకనం చేయలేదు — వాడవద్దు" స్టిక్కర్ ఉంది. క్రమాంకన రిఫరెన్స్ క్యాబినెట్ గోడకు అమర్చారు. QA కార్యాలయం తలుపుపై: "క్రమాంకనం సైన్-ఆఫ్ అవసరం." ISO 15378 ప్యాకేజింగ్ ఫైల్ దూరపు బెంచ్‍‌పై ఉంది. పైన: "ప్రతి అడుగులో పురోగతి · ప్రతి వివరంలో నాణ్యత."'`,
  `'room.desc.qclab':      'QC ల్యాబ్‍‌లో IPA మరియు క్రమాంకన ద్రవపు వాసన వస్తోంది. డైమెన్షనల్ గేజ్‍‌లు, పార్టికల్ కౌంటర్‍‌లు మరియు స్టెరిలిటీ టెస్ట్ పరికరాలు బెంచ్‍‌లపై ఉన్నాయి. మూలలో మైక్రోమీటర్ స్టేషన్‍‌పై పసుపు "క్రమాంకనం చేయలేదు — వాడవద్దు" స్టిక్కర్ ఉంది. క్రమాంకన రిఫరెన్స్ క్యాబినెట్ గోడకు అమర్చారు. QA కార్యాలయం తలుపుపై: "క్రమాంకనం సైన్-ఆఫ్ అవసరం." ISO 15378 ప్యాకేజింగ్ ఫైల్ దూరపు బెంచ్‍‌పై ఉంది. స్టేషన్ 3 నిర్వహణ లాగ్ సైడ్ బెంచ్‍‌పై తెరిచి ఉంది — పరిశోధన సమయంలో తీయబడినట్లు కనిపిస్తోంది. పైన: "ప్రతి అడుగులో పురోగతి · ప్రతి వివరంలో నాణ్యత."'`,
  'TE room.desc.qclab'
);

console.log(`\nResults: ${ok} OK, ${miss} misses`);

if (src === orig) {
  console.error('\nERROR: No changes made!');
  process.exit(1);
}

fs.writeFileSync(path, src, 'utf8');
console.log('Done. File written.');
