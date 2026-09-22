/**
 * Utils.gs
 * פונקציות עזר גנריות: גישה ל-Sheets לפי שם, מיפוי כותרות, המרת שורה <-> אובייקט,
 * יצירת מזהים, פורמט תאריכים, ועטיפת תשובות אחידה ל-Frontend.
 */

/**
 * זיכרון לבקשה אחת בלבד (ביצועים).
 * כל קריאת google.script.run היא הרצה נפרדת של Apps Script, ומשתנים גלובליים מתאפסים בתחילתה —
 * לכן אין כאן סכנה של מידע ישן בין בקשות או בין שני המשתמשים. בתוך אותה בקשה:
 * - ה-Spreadsheet נפתח פעם אחת (openById הוא קריאת רשת יקרה).
 * - כל Tab נקרא פעם אחת (getDataRange אחד = כותרות + נתונים), ומשותף לכל הפונקציות.
 * - כל כתיבה מבטלת את הזיכרון של ה-Tab שלה, וכתיבות קוראות תמיד מחדש (ראו DataService.gs).
 */
var REQUEST_MEMO_ = { ss: null, sheets: {} };

function invalidateSheetMemo_(sheetName) {
  delete REQUEST_MEMO_.sheets[sheetName];
}

/**
 * מחזיר את ה-Spreadsheet הפעיל של המערכת, לפי ה-ID השמור ב-Script Properties.
 * אין לקרוא לפונקציה הזו לפני שהופעל initializeSystem().
 */
function getActiveSpreadsheet_() {
  if (REQUEST_MEMO_.ss) return REQUEST_MEMO_.ss;
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(CONFIG.PROP_SPREADSHEET_ID);
  if (!id) {
    throw new Error('המערכת לא הוגדרה עדיין. יש להריץ את initializeSystem() פעם אחת מתוך עורך ה-Apps Script.');
  }
  // האפליקציה רצה בהרשאות המשתמש שנכנס (שני משתמשים: המשתמשת ודורון).
  // מי שאין לו גישת עריכה לקובץ ה-Sheets לא יקבל נתונים — Google אוכפת זאת, ואנחנו רק מציגים הודעה ברורה.
  try {
    REQUEST_MEMO_.ss = SpreadsheetApp.openById(id);
    return REQUEST_MEMO_.ss;
  } catch (e) {
    throw userFacingError_('אין לחשבון הזה גישה לנתונים של DORON\'S RAVE. צריך שבעלת המערכת תשתף איתך את קובץ ה-Google Sheets כעורך, ולהיכנס עם אותו חשבון Google.');
  }
}

/** שגיאה שהטקסט שלה מיועד להצגה למשתמש כמו שהוא */
function userFacingError_(message) {
  var err = new Error(message);
  err.userFacing = true;
  return err;
}

/** החשבון שנכנס כרגע (עם executeAs: USER_ACCESSING זה תמיד המשתמש עצמו) */
function currentUserEmail_() {
  try {
    return Session.getActiveUser().getEmail() || '';
  } catch (e) {
    return '';
  }
}

/** מחזיר Sheet לפי שם, וזורק שגיאה ברורה אם הוא לא קיים */
function getSheetByName_(sheetName) {
  var ss = getActiveSpreadsheet_();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('לא נמצא Tab בשם "' + sheetName + '". ייתכן שהמערכת לא הוגדרה כראוי — הריצי שוב את initializeSystem().');
  }
  return sheet;
}

/** מחזיר מפה של { headerName: columnIndex(0-based) } עבור Sheet נתון, לפי השורה הראשונה בפועל */
function getHeaderMap_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return {};
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    if (headerRow[i]) map[headerRow[i]] = i;
  }
  return map;
}

/**
 * ממיר שורת מערך לאובייקט JS לפי מפת הכותרות.
 * ערכי Date מומרים למחרוזת: google.script.run לא יכול להחזיר אובייקט Date ל-Frontend —
 * אם יש Date בתוך התשובה, כל התשובה מגיעה כ-null.
 */
function rowToObject_(row, headerMap) {
  var obj = {};
  for (var key in headerMap) {
    obj[key] = serializeCellValue_(row[headerMap[key]], key);
  }
  return obj;
}

/** עמודות תאריך -> 'yyyy-MM-dd'; כל Date אחר -> ISO מקומי (כמו nowIso_) */
function serializeCellValue_(value, columnName) {
  if (!(value instanceof Date)) return value;
  if (isNaN(value.getTime())) return '';
  var pattern = DATE_COLUMNS.indexOf(columnName) !== -1 ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm:ss";
  return Utilities.formatDate(value, CONFIG.TIMEZONE, pattern);
}

/** מחזיר מערך פורמטים (Number Formats) לפי סדר הכותרות של Tab נתון */
function getColumnFormats_(headers) {
  return headers.map(function (h) {
    if (DATE_COLUMNS.indexOf(h) !== -1) return DATE_NUMBER_FORMAT;
    if (NUMBER_COLUMNS.indexOf(h) !== -1) return AMOUNT_NUMBER_FORMAT;
    if (BOOLEAN_COLUMNS.indexOf(h) !== -1) return 'General';
    return '@';
  });
}

/** ממיר אובייקט JS לשורת מערך לפי סדר הכותרות בפועל ב-Sheet */
function objectToRow_(obj, headers) {
  return headers.map(function (h) {
    return (obj[h] === undefined || obj[h] === null) ? '' : obj[h];
  });
}

/** יוצר מזהה ייחודי חדש */
function generateId_() {
  return Utilities.getUuid();
}

/** חותמת זמן נוכחית בפורמט ISO, לפי אזור הזמן של המערכת */
function nowIso_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

/** ממיר ערך בוליאני שנשמר ב-Sheet (עשוי לחזור כ-true/false, 'TRUE'/'FALSE' או '') לבוליאני אמיתי */
function toBool_(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toUpperCase() === 'TRUE';
  return !!v;
}

/** ממיר ערך מספרי שעשוי להגיע כמחרוזת ריקה למספר בטוח (0 כברירת מחדל) */
function toNumber_(v) {
  if (v === '' || v === null || v === undefined) return 0;
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

/**
 * קורא את כל השורות הפעילות (שאינן Archived) של Sheet נתון, כרשימת אובייקטים.
 * @param {string} sheetName
 * @param {boolean} includeArchived - אם true, מחזיר גם רשומות מסומנות is_archived
 */
function readAllRows_(sheetName, includeArchived) {
  // מחזירים עותקים — כדי שקוד שמשנה אובייקט לא ישנה את הזיכרון המשותף של הבקשה
  return readSheetSnapshot_(sheetName).rows
    .filter(function (r) { return includeArchived || !toBool_(r.is_archived); })
    .map(function (r) { return Object.assign({}, r); });
}

/**
 * קריאה אחת של Tab שלם (כותרות + נתונים ב-getDataRange אחד), עם זיכרון לבקשה הנוכחית.
 * @returns {{headerMap: Object, rows: Object[]}} rows כוללות __row (מספר השורה ב-Sheet)
 */
function readSheetSnapshot_(sheetName) {
  var memo = REQUEST_MEMO_.sheets[sheetName];
  if (memo) return memo;

  var values = getSheetByName_(sheetName).getDataRange().getValues();
  var headerMap = {};
  (values[0] || []).forEach(function (h, i) { if (h) headerMap[h] = i; });
  var firstHeaderKey = Object.keys(headerMap)[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = rowToObject_(values[i], headerMap);
    if (firstHeaderKey && !obj[firstHeaderKey]) continue; // שורה ריקה לגמרי — מדלגים
    obj.__row = i + 1; // מספר השורה בפועל ב-Sheet (1-based), לשימוש פנימי בעדכון
    rows.push(obj);
  }
  memo = { headerMap: headerMap, rows: rows };
  REQUEST_MEMO_.sheets[sheetName] = memo;
  return memo;
}

/**
 * מוצא שורה בודדת לפי עמודת ID. מחזיר { obj, rowIndex } או null אם לא נמצא.
 * idColumnName לדוגמה: 'event_id', 'expense_id' וכו'.
 */
function findRowById_(sheetName, idColumnName, idValue) {
  var snap = readSheetSnapshot_(sheetName);
  if (snap.headerMap[idColumnName] === undefined) {
    if (!snap.rows.length) return null;
    throw new Error('עמודה "' + idColumnName + '" לא נמצאה ב-Tab "' + sheetName + '".');
  }
  for (var i = 0; i < snap.rows.length; i++) {
    if (snap.rows[i][idColumnName] === idValue) {
      var obj = Object.assign({}, snap.rows[i]);
      var rowIndex = obj.__row;
      delete obj.__row;
      return { obj: obj, rowIndex: rowIndex, headerMap: snap.headerMap };
    }
  }
  return null;
}

/** עוטף תשובת הצלחה אחידה שחוזרת ל-Frontend */
function ok_(data) {
  return { success: true, data: data };
}

/** עוטף תשובת שגיאה אחידה שחוזרת ל-Frontend, בלי לחשוף Stack Trace */
function fail_(userMessage, err) {
  if (err) {
    console.error(userMessage + ' | ' + (err.stack || err.message || err));
  }
  return { success: false, error: (err && err.userFacing) ? err.message : userMessage };
}

/* ============================================================
   שעות הופעה (HH:mm) — אירוע לילה חוצה חצות
   ============================================================ */

/** 'HH:mm' -> דקות מחצות, או null אם לא תקין */
function parseTimeToMinutes_(value) {
  var m = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  var hours = Number(m[1]), minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * משך הופעה בדקות ובטקסט. End קטן מ-Start = חציית חצות (23:00–01:00 = 120 דקות).
 * @returns {{minutes: number, text: string}|null}
 */
function calculatePerformanceDuration_(startTime, endTime) {
  var start = parseTimeToMinutes_(startTime);
  var end = parseTimeToMinutes_(endTime);
  if (start === null || end === null) return null;
  var minutes = end - start;
  // חציית חצות היא הפרש שלילי בלבד (23:00-01:00). שעות זהות אינן הופעה של
  // 24 שעות — זו הזנה לא תקינה, ומחזירים null כדי שלא יוצג משך מומצא
  // ולא תחושב "עלות לשעה" מסכום חלקי 24.
  if (minutes === 0) return null;
  if (minutes < 0) minutes += 24 * 60;
  return { minutes: minutes, text: formatDurationText_(minutes) };
}

function formatDurationText_(minutes) {
  var hours = Math.floor(minutes / 60);
  var rest = minutes % 60;
  if (!hours) return rest + ' דקות';
  if (!rest) return hours === 1 ? 'שעה' : (hours === 2 ? 'שעתיים' : hours + ' שעות');
  return hours + ':' + (rest < 10 ? '0' + rest : rest) + ' שעות';
}

/**
 * מפתח מיון "רצף לילה": שעות אחרי חצות (00:00–11:59) נחשבות ללילה שאחרי.
 * כך 21:00 < 23:30 < 00:30 < 02:00, בלי לדרוש תאריך מלא.
 */
function nightSortKey_(timeValue) {
  var minutes = parseTimeToMinutes_(timeValue);
  if (minutes === null) return null;
  return minutes < 12 * 60 ? minutes + 24 * 60 : minutes;
}
