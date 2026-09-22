/**
 * ExpensesService.gs
 * הישות הפיננסית המרכזית: הוצאות. כל הוצאה (כולל אמנים) נספרת פעם אחת בסה"כ הוצאות.
 * סטטוס בפועל (סעיף 22) מחושב מהתשלומים ב-summarizeExpensePayments_ (PaymentsService.gs).
 */

function getExpensesForEvent(eventId) {
  try {
    if (!eventId) return fail_('חסר מזהה אירוע.');
    var d = loadFinanceData_();
    var today = todayIso_();
    var maps = buildNameMaps_(d);
    var paymentsByExpense = groupPaymentsByExpense_(d.payments);
    var methodMap = methodNameMap_(d.methods);

    var enriched = d.expenses
      .filter(function (x) { return x.event_id === eventId; })
      .map(function (ex) {
        var list = paymentsByExpense[ex.expense_id] || [];
        var result = enrichExpense_(ex, maps.categories, maps.vendors, maps.artists, list, today, maps.subcategories);
        result.payments = list.map(function (p) { return enrichPayment_(p, today, methodMap); });
        return result;
      });
    return ok_(enriched);
  } catch (e) {
    return fail_('לא הצלחנו לטעון את ההוצאות.', e);
  }
}

function createExpense(data) {
  try {
    var validationError = validateExpense_(data);
    if (validationError) return fail_(validationError);

    var subcategoryError = resolveSubcategory_(data);
    if (subcategoryError) return fail_(subcategoryError);
    var timesError = resolvePerformanceTimes_(data);
    if (timesError) return fail_(timesError);

    var record = insertRecord_(CONFIG.SHEETS.EXPENSES, 'expense_id', {
      event_id: data.event_id,
      name: String(data.name).trim(),
      category_id: data.category_id,
      subcategory_id: data.subcategory_id,
      planned_amount: toNumber_(data.planned_amount),
      agreed_amount: toNumber_(data.agreed_amount),
      vendor_id: data.vendor_id || '',
      artist_id: data.artist_id || '',
      paid_by: data.paid_by || '',
      manual_status: normalizeManualStatus_(data.manual_status),
      expense_date: data.expense_date || '',
      internal_notes: data.internal_notes || '',
      performance_start_time: data.performance_start_time,
      performance_end_time: data.performance_end_time
    });
    var coverageError = resolveCoverage_(record.expense_id, coverageForExpense_(data));
    if (coverageError) return fail_(coverageError);
    if (data.simple_payment) syncSimplePayment_(record, data.simple_payment);
    return ok_(record);
  } catch (e) {
    return fail_('לא הצלחנו ליצור את ההוצאה.', e);
  }
}

function updateExpense(data) {
  try {
    if (!data || !data.expense_id) return fail_('חסר מזהה הוצאה לעדכון.');
    var validationError = validateExpense_(data);
    if (validationError) return fail_(validationError);

    var before = findRowById_(CONFIG.SHEETS.EXPENSES, 'expense_id', data.expense_id);
    if (!before) return fail_('ההוצאה לא נמצאה.');
    var subcategoryError = resolveSubcategory_(data);
    if (subcategoryError) return fail_(subcategoryError);
    var timesError = resolvePerformanceTimes_(data);
    if (timesError) return fail_(timesError);

    var updates = {
      name: String(data.name).trim(),
      category_id: data.category_id,
      subcategory_id: data.subcategory_id,
      planned_amount: toNumber_(data.planned_amount),
      agreed_amount: toNumber_(data.agreed_amount),
      vendor_id: data.vendor_id || '',
      artist_id: data.artist_id || '',
      paid_by: data.paid_by || '',
      manual_status: normalizeManualStatus_(data.manual_status),
      expense_date: data.expense_date || '',
      // מעבר מקטגוריית אמנים לקטגוריה אחרת מנקה את שעות ההופעה של ההוצאה הזו בלבד
      performance_start_time: data.performance_start_time,
      performance_end_time: data.performance_end_time
    };
    if (data.internal_notes !== undefined) updates.internal_notes = data.internal_notes;
    var record = updateRecord_(CONFIG.SHEETS.EXPENSES, 'expense_id', data.expense_id, updates);
    var coverageError = resolveCoverage_(record.expense_id, coverageForExpense_(data));
    if (coverageError) return fail_(coverageError);
    if (data.simple_payment) syncSimplePayment_(record, data.simple_payment, toNumber_(before.obj.agreed_amount));
    return ok_(record);
  } catch (e) {
    return fail_('לא הצלחנו לעדכן את ההוצאה.', e);
  }
}

function archiveExpense(expenseId) {
  try {
    if (!expenseId) return fail_('חסר מזהה הוצאה.');
    var record = archiveRecord_(CONFIG.SHEETS.EXPENSES, 'expense_id', expenseId);
    // הוצאה שארוכבה כבר לא מכסה דבר — אחרת רכיבים ימשיכו להיראות "כלולים"
    archiveCoverageForExpense_(expenseId);
    return ok_(record);
  } catch (e) {
    return fail_('לא הצלחנו לארכב את ההוצאה.', e);
  }
}

/** מחזיר שמות הוצאות ייחודיים שנעשה בהם שימוש בעבר, לצורך Autocomplete */
function getExpenseNameSuggestions() {
  try {
    var expenses = listRecords_(CONFIG.SHEETS.EXPENSES, false);
    var names = Array.from(new Set(expenses.map(function (ex) { return ex.name; }).filter(Boolean)));
    return ok_(names);
  } catch (e) {
    return fail_('לא הצלחנו לטעון הצעות.', e);
  }
}

function validateExpense_(data) {
  if (!data) return 'חסרים נתוני הוצאה.';
  if (!data.event_id) return 'חסר מזהה אירוע.';
  if (!data.name || !String(data.name).trim()) return 'שם ההוצאה הוא שדה חובה.';
  if (!data.category_id) return 'יש לבחור קטגוריה.';
  if (toNumber_(data.agreed_amount) < 0) return 'הסכום לא יכול להיות שלילי.';
  if (toNumber_(data.planned_amount) < 0) return 'הסכום לא יכול להיות שלילי.';
  return null;
}

/**
 * מנרמל את שעות ההופעה במקום (data), ומחזיר הודעת שגיאה בעברית או null.
 * - שעות רלוונטיות רק לקטגוריית "אמנים"; בכל קטגוריה אחרת הן מנוקות.
 * - שתיהן ריקות = תקין. רק אחת מהן = שגיאה. חציית חצות = תקין.
 */
function resolvePerformanceTimes_(data) {
  var category = findRowById_(CONFIG.SHEETS.CATEGORIES, 'category_id', data.category_id);
  var isArtists = category && isArtistsCategoryName_(category.obj.name);
  var start = String(data.performance_start_time || '').trim();
  var end = String(data.performance_end_time || '').trim();

  if (!isArtists) {
    data.performance_start_time = '';
    data.performance_end_time = '';
    return null;
  }
  if (!start && !end) {
    data.performance_start_time = '';
    data.performance_end_time = '';
    return null;
  }
  if (!start || !end) return 'שעות הופעה: צריך למלא גם שעת התחלה וגם שעת סיום, או להשאיר את שתיהן ריקות.';
  if (parseTimeToMinutes_(start) === null || parseTimeToMinutes_(end) === null) return 'שעות הופעה: הפורמט צריך להיות שעה:דקות, למשל 22:00.';
  // בלי זה 22:00-22:00 היה נשמר ומוצג כהופעה של 24 שעות
  if (parseTimeToMinutes_(start) === parseTimeToMinutes_(end)) return 'שעות הופעה: שעת ההתחלה ושעת הסיום זהות. צריך טווח אמיתי.';

  data.performance_start_time = start;
  data.performance_end_time = end;
  return null;
}

/**
 * מה נשלח ל-resolveCoverage_ עבור ההוצאה הזו.
 * כל הוצאה יכולה להיות עסקה כוללת — אין יותר התניה על שם קטגוריה.
 * הטופס לא שלח שדה בכלל (קורא ישן / שכפול) → undefined = אל תיגע בכיסוי הקיים.
 * הסכומים של ההוצאה לא מושפעים בשום מקרה.
 */
function coverageForExpense_(data) {
  if (data.coverage === undefined || data.coverage === null) return undefined;
  return data.coverage;
}

/**
 * מנרמל את data.subcategory_id במקום (החלטות 2026-09-14):
 * - אופציונלי: ריק מותר.
 * - קטגוריית "אמנים": תמיד ריק, גם אם נשלח ערך.
 * - ערך שנשלח חייב להיות תת-קטגוריה פעילה של הקטגוריה שנבחרה.
 * @returns {string|null} הודעת שגיאה בעברית, או null
 */
function resolveSubcategory_(data) {
  ensureSubcategorySchema_();
  var subId = data.subcategory_id ? String(data.subcategory_id) : '';
  var category = findRowById_(CONFIG.SHEETS.CATEGORIES, 'category_id', data.category_id);
  if (!category) return 'הקטגוריה שנבחרה לא נמצאה.';
  if (isArtistsCategoryName_(category.obj.name) || !subId) {
    data.subcategory_id = '';
    return null;
  }
  var sub = findRowById_(CONFIG.SHEETS.SUBCATEGORIES, 'subcategory_id', subId);
  if (!sub || toBool_(sub.obj.is_archived) || sub.obj.category_id !== data.category_id) {
    return 'תת-הקטגוריה שנבחרה לא שייכת לקטגוריה הזו. בחרי שוב מהרשימה.';
  }
  data.subcategory_id = subId;
  return null;
}

/** הסטטוס הידני הוא רק מתוכנן/סוכם; "שולם" נגזר מהתשלומים */
function normalizeManualStatus_(status) {
  return status === EXPENSE_MANUAL_STATUS.AGREED ? EXPENSE_MANUAL_STATUS.AGREED : EXPENSE_MANUAL_STATUS.PLANNED;
}

/** מוסיף שמות תצוגה, סיכום תשלומים וסטטוס מחושב להוצאה בודדת */
function enrichExpense_(ex, categoryMap, vendorMap, artistMap, payments, today, subcategoryMap, coverageMap) {
  return Object.assign({}, ex, {
    covered_items: (coverageMap || {})[ex.expense_id] || [],
    category_name: categoryMap[ex.category_id] || '',
    subcategory_id: ex.subcategory_id || '',
    subcategory_name: ex.subcategory_id ? ((subcategoryMap || {})[ex.subcategory_id] || '') : '',
    vendor_name: ex.vendor_id ? (vendorMap[ex.vendor_id] || '') : '',
    artist_name: ex.artist_id ? (artistMap[ex.artist_id] || '') : '',
    agreed_amount: toNumber_(ex.agreed_amount),
    planned_amount: toNumber_(ex.planned_amount)
  }, performanceInfo_(ex), summarizeExpensePayments_(ex, payments || [], today || todayIso_()));
}

/** ערכים מחושבים בלבד לשעות הופעה — לא נשמרים ב-Sheet */
function performanceInfo_(ex) {
  var start = ex.performance_start_time || '';
  var end = ex.performance_end_time || '';
  var duration = calculatePerformanceDuration_(start, end);
  var hours = duration ? duration.minutes / 60 : 0;
  var agreed = toNumber_(ex.agreed_amount);
  return {
    performance_start_time: start,
    performance_end_time: end,
    performance_duration_minutes: duration ? duration.minutes : null,
    performance_duration_text: duration ? duration.text : '',
    // עלות לשעת נגינה — תצוגה בלבד, בלי שדה חדש ב-Sheet
    hourly_rate: (duration && hours > 0 && agreed > 0) ? Math.round(agreed / hours) : null
  };
}
