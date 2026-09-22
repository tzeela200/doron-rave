/**
 * SchemaService.gs
 * שדרוג סכימה בטוח ל-Spreadsheet קיים.
 *
 * כללי הברזל:
 * - עמודה חדשה מתווספת **רק בסוף** הטבלה. עמודה קיימת לעולם לא זזה.
 * - אין שכתוב של מידע קיים ואין migration עסקי.
 * - אם סדר העמודות הקיים אינו Prefix של הסדר המצופה — עוצרים עם שגיאה ברורה
 *   במקום לנסות "לתקן" לבד (הסיכון: הזזת נתונים לעמודות הלא נכונות).
 * - אידמפוטנטי, מוגן ב-LockService.
 */

// כל שינוי סכימה עתידי מחייב העלאת הגרסה כאן — אחרת הבדיקה לא תרוץ שוב אצל מי שכבר שודרג.
var SCHEMA_VERSION = '2026-09-20b-ticket-tiers';

/** Events.required_items נוספת בסוף בשימוש הראשון אחרי הפריסה. אידמפוטנטי. */
function ensureRequiredItemsSchema_() {
  return ensureEnhancementSchema_();
}

/**
 * @param {boolean=} force - התעלמות מגרסת הסכימה השמורה (להרצה ידנית מהעורך)
 * @returns {{changed: boolean, createdSheets: string[], addedColumns: string[]}}
 */
function ensureEnhancementSchema_(force) {
  var props = PropertiesService.getScriptProperties();
  if (!force && props.getProperty(CONFIG.PROP_SCHEMA_VERSION) === SCHEMA_VERSION) {
    return { changed: false, createdSheets: [], addedColumns: [], skipped: true };
  }

  var ss = getActiveSpreadsheet_();
  var plan = planSchemaUpgrade_(ss);

  if (!plan.createSheets.length && !plan.addColumns.length) {
    props.setProperty(CONFIG.PROP_SCHEMA_VERSION, SCHEMA_VERSION);
    return { changed: false, createdSheets: [], addedColumns: [] };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var createdSheets = [], addedColumns = [];
  try {
    plan = planSchemaUpgrade_(ss); // תכנון מחדש בתוך ה-Lock, למקרה שמשתמש אחר הספיק לשדרג

    plan.createSheets.forEach(function (sheetName) {
      ensureSheetWithHeaders_(ss, sheetName, SHEET_HEADERS[sheetName]);
      createdSheets.push(sheetName);
    });

    plan.addColumns.forEach(function (item) {
      var sheet = ss.getSheetByName(item.sheetName);
      var headers = SHEET_HEADERS[item.sheetName];
      var needed = headers.length;
      if (sheet.getMaxColumns() < needed) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), needed - sheet.getMaxColumns());
      }
      // כותרות בלבד — לא נוגעים בשורות הנתונים
      var range = sheet.getRange(1, item.startColumn, 1, item.missing.length);
      range.setValues([item.missing]);
      range.setFontWeight('bold');
      var formats = getColumnFormats_(headers).slice(item.startColumn - 1, item.startColumn - 1 + item.missing.length);
      var maxRows = sheet.getMaxRows();
      if (maxRows > 1) {
        formats.forEach(function (fmt, i) {
          sheet.getRange(2, item.startColumn + i, maxRows - 1, 1).setNumberFormat(fmt);
        });
      }
      invalidateSheetMemo_(item.sheetName);
      item.missing.forEach(function (col) { addedColumns.push(item.sheetName + '.' + col); });
    });

    props.setProperty(CONFIG.PROP_SCHEMA_VERSION, SCHEMA_VERSION);
  } finally {
    lock.releaseLock();
  }

  Logger.log('שדרוג סכימה: Tabs חדשים [' + createdSheets.join(', ') + '], עמודות חדשות [' + addedColumns.join(', ') + ']');
  return { changed: true, createdSheets: createdSheets, addedColumns: addedColumns };
}

/** מה חסר ב-Spreadsheet מול SHEET_HEADERS — בלי לשנות דבר */
function planSchemaUpgrade_(ss) {
  var createSheets = [], addColumns = [];

  Object.keys(SHEET_HEADERS).forEach(function (sheetName) {
    var expected = SHEET_HEADERS[sheetName];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) { createSheets.push(sheetName); return; }

    var lastCol = sheet.getLastColumn();
    var existing = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    while (existing.length && !String(existing[existing.length - 1]).trim()) existing.pop(); // כותרות ריקות בסוף

    if (!existing.length) { createSheets.push(sheetName); return; } // Tab ריק לגמרי — ייווצרו כותרות

    if (existing.length > expected.length) {
      throw userFacingError_('ב-Tab "' + sheetName + '" יש יותר עמודות מהמצופה. לא בוצע שינוי — צריך לבדוק ידנית את הגיליון.');
    }
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i]).trim() !== expected[i]) {
        throw userFacingError_('סדר העמודות ב-Tab "' + sheetName + '" לא תואם למצופה (עמודה ' + (i + 1) +
          ': נמצא "' + existing[i] + '", מצופה "' + expected[i] + '"). לא בוצע שינוי — צריך לבדוק ידנית את הגיליון.');
      }
    }
    if (existing.length < expected.length) {
      addColumns.push({ sheetName: sheetName, startColumn: existing.length + 1, missing: expected.slice(existing.length) });
    }
  });

  return { createSheets: createSheets, addColumns: addColumns };
}

/**
 * הרצה ידנית מעורך ה-Apps Script (בטוחה וניתנת לחזרה):
 * מוסיפה Tabs/עמודות חסרים בלבד ומדווחת מה נעשה.
 */
function upgradeSchema() {
  var result = ensureEnhancementSchema_(true);
  var message = result.changed
    ? 'שודרג. Tabs חדשים: ' + (result.createdSheets.join(', ') || 'אין') + '. עמודות חדשות: ' + (result.addedColumns.join(', ') || 'אין') + '.'
    : 'הסכימה כבר מעודכנת — לא בוצע שינוי.';
  Logger.log(message);
  return Object.assign({ message: message }, result);
}
