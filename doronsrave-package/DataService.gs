/**
 * DataService.gs
 * שכבת גישה גנרית לנתונים: הוספת שורה, עדכון שורה, Archive.
 * משתמשת ב-LockService כדי למנוע כתיבות מקבילות / כפילויות מ-Double Submit.
 */

/**
 * מוסיף רשומה חדשה ל-Sheet נתון.
 * @param {string} sheetName
 * @param {string} idColumnName - שם עמודת המזהה (למשל 'event_id')
 * @param {Object} data - שדות הרשומה (ללא id/created_at/updated_at — אלה מתווספים כאן)
 * @returns {Object} הרשומה שנוצרה, כולל id וחותמות זמן
 */
function insertRecord_(sheetName, idColumnName, data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheetByName_(sheetName);
    var headers = SHEET_HEADERS[sheetName];
    if (!headers) throw new Error('אין הגדרת כותרות עבור Tab "' + sheetName + '".');

    var id = generateId_();
    var ts = nowIso_();

    var record = {};
    headers.forEach(function (h) { record[h] = ''; });
    for (var key in data) {
      if (headers.indexOf(key) !== -1) record[key] = data[key];
    }
    record[idColumnName] = id;
    record.is_archived = false;
    record.created_at = ts;
    record.updated_at = ts;

    var row = objectToRow_(record, headers);
    sheet.appendRow(row);

    return record;
  } finally {
    lock.releaseLock();
  }
}

/**
 * מעדכן רשומה קיימת לפי ID. מעדכן רק את השדות שסופקו ב-updates, שומר על השאר.
 * @returns {Object} הרשומה המעודכנת המלאה
 */
function updateRecord_(sheetName, idColumnName, idValue, updates) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var found = findRowById_(sheetName, idColumnName, idValue);
    if (!found) {
      throw new Error('הרשומה המבוקשת לא נמצאה (' + idColumnName + ' = ' + idValue + ').');
    }
    var sheet = getSheetByName_(sheetName);
    var headers = SHEET_HEADERS[sheetName];
    var merged = found.obj;
    for (var key in updates) {
      if (headers.indexOf(key) !== -1 && key !== idColumnName && key !== 'created_at') {
        merged[key] = updates[key];
      }
    }
    merged.updated_at = nowIso_();

    var row = objectToRow_(merged, headers);
    sheet.getRange(found.rowIndex, 1, 1, row.length).setValues([row]);

    delete merged.__row;
    return merged;
  } finally {
    lock.releaseLock();
  }
}

/**
 * מסמן רשומה כ-Archived (מחיקה רכה) — לא מוחק פיזית מה-Sheet.
 */
function archiveRecord_(sheetName, idColumnName, idValue) {
  return updateRecord_(sheetName, idColumnName, idValue, { is_archived: true });
}

/**
 * מחזיר את כל הרשומות הפעילות (או כולן, כולל Archived) מ-Tab נתון, ממוינות אם צוין.
 */
function listRecords_(sheetName, includeArchived) {
  var rows = readAllRows_(sheetName, !!includeArchived);
  rows.forEach(function (r) { delete r.__row; });
  return rows;
}
