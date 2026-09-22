/**
 * SetupService.gs
 * initializeSystem() — פונקציית התקנה חד-פעמית ואידמפוטנטית.
 *
 * הרצה: בעורך ה-Apps Script, לבחור את הפונקציה initializeSystem מהתפריט העליון וללחוץ Run.
 * אפשר להריץ אותה שוב בעתיד בבטחה — היא לא תיצור כפילויות של Tabs, Headers, קטגוריית
 * ברירת המחדל או אמצעי התשלום ההתחלתיים.
 */
function initializeSystem() {
  var props = PropertiesService.getScriptProperties();
  var ss;
  var existingId = props.getProperty(CONFIG.PROP_SPREADSHEET_ID);

  if (existingId) {
    try {
      ss = SpreadsheetApp.openById(existingId);
    } catch (e) {
      ss = null; // ה-ID השמור לא תקין יותר — ניצור/נחבר מחדש
    }
  }

  if (!ss) {
    ss = SpreadsheetApp.create("DORON'S RAVE — נתונים");
    props.setProperty(CONFIG.PROP_SPREADSHEET_ID, ss.getId());
  }

  ss.setSpreadsheetLocale(CONFIG.LOCALE);
  ss.setSpreadsheetTimeZone(CONFIG.TIMEZONE);

  // יצירת כל ה-Tabs וה-Headers, אם עוד לא קיימים
  for (var sheetName in SHEET_HEADERS) {
    ensureSheetWithHeaders_(ss, sheetName, SHEET_HEADERS[sheetName]);
  }

  // הסרת "Sheet1" ברירת המחדל של Google, אם קיים ואם יש Tabs אחרים
  var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('גיליון1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // קטגוריית ברירת מחדל יחידה: "אמנים" — רק אם עדיין אין קטגוריות בכלל
  ensureDefaultCategory_();

  // אמצעי תשלום התחלתיים — רק אם ה-Tab ריק
  ensureDefaultPaymentMethods_();

  var url = ss.getUrl();
  Logger.log('המערכת מוכנה. קישור ל-Spreadsheet: ' + url);
  return { spreadsheetId: ss.getId(), spreadsheetUrl: url };
}

/** מחזיר את כתובת ה-Spreadsheet הפעיל, לשימוש במסך ההגדרות ("פתח Google Sheet") */
function getSpreadsheetUrl() {
  try {
    var ss = getActiveSpreadsheet_();
    return ok_({ url: ss.getUrl() });
  } catch (e) {
    return fail_('המערכת לא הוגדרה עדיין.', e);
  }
}

/** יוצר Sheet עם השם והכותרות הנתונים, רק אם הוא לא קיים כבר */
function ensureSheetWithHeaders_(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  var lastCol = sheet.getLastColumn();
  var existingHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var headersMatch = existingHeaders.length === headers.length &&
    headers.every(function (h, i) { return existingHeaders[i] === h; });

  if (!headersMatch) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }

  invalidateSheetMemo_(sheetName);

  // פורמט עמודות (סעיף 6.4 באפיון): טקסט/תאריך/מספר. אידמפוטנטי — לא משנה ערכים קיימים.
  // שורות קיימות שכבר נשמרו לפני התיקון (למשל טלפון שאיבד 0) לא משוחזרות אוטומטית.
  var maxRows = sheet.getMaxRows();
  if (maxRows > 1) {
    getColumnFormats_(headers).forEach(function (fmt, i) {
      sheet.getRange(2, i + 1, maxRows - 1, 1).setNumberFormat(fmt);
    });
  }
  return sheet;
}

/** יוצר את קטגוריית "אמנים" פעם אחת בלבד, אם עדיין אין אף קטגוריה */
function ensureDefaultCategory_() {
  var existing = listRecords_(CONFIG.SHEETS.CATEGORIES, true);
  if (existing.length > 0) return;
  insertRecord_(CONFIG.SHEETS.CATEGORIES, 'category_id', {
    name: DEFAULT_CATEGORY_NAME,
    sort_order: 1,
    is_visible: true
  });
}

/** יוצר את אמצעי התשלום ההתחלתיים פעם אחת בלבד, אם ה-Tab ריק */
function ensureDefaultPaymentMethods_() {
  var existing = listRecords_(CONFIG.SHEETS.PAYMENT_METHODS, true);
  if (existing.length > 0) return;
  DEFAULT_PAYMENT_METHODS.forEach(function (name, index) {
    insertRecord_(CONFIG.SHEETS.PAYMENT_METHODS, 'payment_method_id', {
      name: name,
      sort_order: index + 1,
      is_active: true
    });
  });
}
