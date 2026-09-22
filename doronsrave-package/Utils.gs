/**
 * Utils.gs
 * פונקציות עזר גנריות: גישה ל-Sheets לפי שם, מיפוי כותרות, המרת שורה <-> אובייקט,
 * יצירת מזהים, פורמט תאריכים, ועטיפת תשובות אחידה ל-Frontend.
 */

/**
 * מחזיר את ה-Spreadsheet הפעיל של המערכת, לפי ה-ID השמור ב-Script Properties.
 * אין לקרוא לפונקציה הזו לפני שהופעל initializeSystem().
 */
function getActiveSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(CONFIG.PROP_SPREADSHEET_ID);
  if (!id) {
    throw new Error('המערכת לא הוגדרה עדיין. יש להריץ את initializeSystem() פעם אחת מתוך עורך ה-Apps Script.');
  }
  return SpreadsheetApp.openById(id);
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

/** ממיר שורת מערך לאובייקט JS לפי מפת הכותרות */
function rowToObject_(row, headerMap) {
  var obj = {};
  for (var key in headerMap) {
    obj[key] = row[headerMap[key]];
  }
  return obj;
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
  var sheet = getSheetByName_(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var lastCol = sheet.getLastColumn();
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var headerMap = getHeaderMap_(sheet);
  var firstHeaderKey = Object.keys(headerMap)[0];
  var results = [];
  for (var i = 0; i < values.length; i++) {
    var obj = rowToObject_(values[i], headerMap);
    if (firstHeaderKey && !obj[firstHeaderKey]) continue; // שורה ריקה לגמרי — מדלגים
    obj.__row = i + 2; // מספר השורה בפועל ב-Sheet (1-based), לשימוש פנימי בעדכון/מחיקה
    if (includeArchived || !toBool_(obj.is_archived)) {
      results.push(obj);
    }
  }
  return results;
}

/**
 * מוצא שורה בודדת לפי עמודת ID. מחזיר { obj, rowIndex } או null אם לא נמצא.
 * idColumnName לדוגמה: 'event_id', 'expense_id' וכו'.
 */
function findRowById_(sheetName, idColumnName, idValue) {
  var sheet = getSheetByName_(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var lastCol = sheet.getLastColumn();
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var headerMap = getHeaderMap_(sheet);
  var idCol = headerMap[idColumnName];
  if (idCol === undefined) {
    throw new Error('עמודה "' + idColumnName + '" לא נמצאה ב-Tab "' + sheetName + '".');
  }
  for (var i = 0; i < values.length; i++) {
    if (values[i][idCol] === idValue) {
      return { obj: rowToObject_(values[i], headerMap), rowIndex: i + 2, headerMap: headerMap };
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
  return { success: false, error: userMessage };
}
