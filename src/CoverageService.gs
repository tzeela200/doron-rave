/**
 * CoverageService.gs
 * "מה כלול במחיר" — רכיבים שהוצאה אחת מכסה (בעיקר השכרת שטח).
 *
 * כללי הברזל:
 * - Coverage הוא **מידע תפעולי בלבד**. הוא לעולם לא נספר כספית, לא משנה סכום,
 *   ולא מחלק את מחיר העסקה בין הרכיבים.
 * - הוצאה נספרת פעם אחת בלבד, לפי ה-category_id/subcategory_id שלה.
 * - ביטול סימון = Archive, לעולם לא מחיקה פיזית.
 * - כתיבה של כל הרכיבים מתבצעת ב-Lock אחד ובכתיבה אחת, ולא רשומה-רשומה.
 */

/**
 * מפתח ייחודי לרכיב. תת-קטגוריה גוברת על קטגוריה, וטקסט חופשי עומד בפני עצמו.
 * @returns {string} ריק אם הרכיב לא תקין
 */
function coverageItemKey_(item) {
  if (!item) return '';
  if (item.subcategory_id) return 'sub:' + item.subcategory_id;
  if (item.category_id) return 'cat:' + item.category_id;
  var label = String(item.custom_label || '').trim();
  return label ? 'label:' + label : '';
}

/** כל שורות הכיסוי. מחזיר [] אם ה-Tab עוד לא נוצר (לפני שדרוג הסכימה). */
function listCoverageRows_(includeArchived) {
  var ss = getActiveSpreadsheet_();
  if (!ss.getSheetByName(CONFIG.SHEETS.EXPENSE_COVERAGE)) return [];
  return listRecords_(CONFIG.SHEETS.EXPENSE_COVERAGE, !!includeArchived);
}

/**
 * מפה expense_id → רשימת רכיבים מועשרת בשמות.
 * @param {Object} categoryMap - category_id → שם
 * @param {Object} subcategoryMap - subcategory_id → שם (כולל ארכיון, כדי שרכיב היסטורי יציג שם)
 */
function coverageMapByExpense_(categoryMap, subcategoryMap) {
  var map = {};
  listCoverageRows_(false).forEach(function (row) {
    var name = row.custom_label
      ? String(row.custom_label)
      : (row.subcategory_id ? ((subcategoryMap || {})[row.subcategory_id] || '')
                            : ((categoryMap || {})[row.category_id] || ''));
    if (!name) return; // רכיב שהקטגוריה שלו נמחקה מהגיליון — לא מציגים שורה ריקה
    (map[row.expense_id] = map[row.expense_id] || []).push({
      coverage_id: row.coverage_id,
      category_id: row.category_id || '',
      subcategory_id: row.subcategory_id || '',
      custom_label: row.custom_label || '',
      key: coverageItemKey_(row),
      name: name
    });
  });
  return map;
}

/**
 * מאמת רשימת רכיבים שהגיעה מהטופס ומנרמל אותה.
 * @returns {{error: (string|null), items: Object[]}}
 */
function normalizeCoverageItems_(items) {
  if (!items || !items.length) return { error: null, items: [] };
  if (items.length > 40) return { error: 'יותר מדי רכיבים כלולים. אפשר לסמן עד 40.', items: [] };

  var out = [], seen = {};
  for (var i = 0; i < items.length; i++) {
    var raw = items[i] || {};
    var item = {
      category_id: raw.category_id ? String(raw.category_id) : '',
      subcategory_id: raw.subcategory_id ? String(raw.subcategory_id) : '',
      custom_label: String(raw.custom_label || '').trim().slice(0, 60)
    };

    if (item.subcategory_id) {
      var sub = findRowById_(CONFIG.SHEETS.SUBCATEGORIES, 'subcategory_id', item.subcategory_id);
      if (!sub) return { error: 'אחד הרכיבים שסומנו לא נמצא במערכת. בחרי שוב מהרשימה.', items: [] };
      item.category_id = sub.obj.category_id; // תמיד נשמר עם ההורה שלו
      item.custom_label = '';
    } else if (item.category_id) {
      var cat = findRowById_(CONFIG.SHEETS.CATEGORIES, 'category_id', item.category_id);
      if (!cat) return { error: 'אחת הקטגוריות שסומנו לא נמצאה במערכת. בחרי שוב מהרשימה.', items: [] };
      item.custom_label = '';
    } else if (!item.custom_label) {
      continue; // רכיב ריק לגמרי — פשוט מדלגים, בלי להיכשל
    }

    var key = coverageItemKey_(item);
    if (!key || seen[key]) continue; // כפילות באותה הוצאה — מסומן פעם אחת
    seen[key] = true;
    out.push(item);
  }
  return { error: null, items: out };
}

/**
 * מסנכרן את הרכיבים של הוצאה אחת למצב המבוקש, ב-Lock אחד.
 * רכיב שהוסר מסומן is_archived; רכיב שסומן מחדש מוחזר לפעיל במקום ליצור שורה כפולה.
 *
 * @param {string} expenseId
 * @param {Array|undefined} items - undefined = אל תיגע בכיסוי הקיים; [] = נקה הכל
 * @returns {string|null} הודעת שגיאה בעברית, או null
 */
function resolveCoverage_(expenseId, items) {
  if (items === undefined || items === null) return null;
  ensureEnhancementSchema_();

  var normalized = normalizeCoverageItems_(items);
  if (normalized.error) return normalized.error;

  var desired = {};
  normalized.items.forEach(function (item) { desired[coverageItemKey_(item)] = item; });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // כתיבה לא נשענת על זיכרון — קוראים מחדש בתוך ה-Lock
    invalidateSheetMemo_(CONFIG.SHEETS.EXPENSE_COVERAGE);
    var sheet = getSheetByName_(CONFIG.SHEETS.EXPENSE_COVERAGE);
    var headers = SHEET_HEADERS.ExpenseCoverage;
    var formats = getColumnFormats_(headers);
    var ts = nowIso_();

    var existing = readSheetSnapshot_(CONFIG.SHEETS.EXPENSE_COVERAGE).rows
      .filter(function (r) { return r.expense_id === expenseId; });

    var handled = {};
    existing.forEach(function (row) {
      var key = coverageItemKey_(row);
      var isArchived = toBool_(row.is_archived);
      var wanted = !!desired[key];

      if (wanted && handled[key]) return;       // שורה כפולה היסטורית — משאירים אחת בלבד
      if (wanted && !isArchived) { handled[key] = true; return; } // כבר במצב הנכון

      if (wanted === isArchived) {              // צריך להפוך מצב
        var merged = Object.assign({}, row);
        delete merged.__row;
        merged.is_archived = !isArchived;
        merged.updated_at = ts;
        var r = sheet.getRange(row.__row, 1, 1, headers.length);
        r.setNumberFormats([formats]);
        r.setValues([objectToRow_(merged, headers)]);
        if (wanted) handled[key] = true;
      }
    });

    // רכיבים חדשים — שורה אחת לכל רכיב, בכתיבה אחת
    var newRows = [];
    Object.keys(desired).forEach(function (key) {
      if (handled[key]) return;
      var item = desired[key];
      var record = {};
      headers.forEach(function (h) { record[h] = ''; });
      record.coverage_id = generateId_();
      record.expense_id = expenseId;
      record.category_id = item.category_id;
      record.subcategory_id = item.subcategory_id;
      record.custom_label = item.custom_label;
      record.is_archived = false;
      record.created_at = ts;
      record.updated_at = ts;
      newRows.push(objectToRow_(record, headers));
    });

    if (newRows.length) {
      var range = sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length);
      range.setNumberFormats(newRows.map(function () { return formats; }));
      range.setValues(newRows);
    }

    invalidateSheetMemo_(CONFIG.SHEETS.EXPENSE_COVERAGE);
    return null;
  } finally {
    lock.releaseLock();
  }
}

/**
 * מארכב את כל הכיסוי של הוצאה שנמחקה (ארכוב), כדי שהרכיבים לא ימשיכו להיראות "מכוסים".
 */
function archiveCoverageForExpense_(expenseId) {
  if (!getActiveSpreadsheet_().getSheetByName(CONFIG.SHEETS.EXPENSE_COVERAGE)) return;
  resolveCoverage_(expenseId, []);
}
