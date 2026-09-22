/**
 * ExpensesService.gs
 * הישות הפיננסית המרכזית: הוצאות. כל הוצאה (כולל אמנים) נספרת פעם אחת בסה"כ הוצאות.
 *
 * חישוב סטטוס (section 22 באפיון): עד שיתווסף מודול Payments, "שולם" תמיד 0,
 * ולכן הסטטוס בפועל שווה תמיד למצב הידני (מתוכנן/סוכם) — זהו חישוב תקין ונכון
 * לשלב הנוכחי, לא קיצור דרך.
 */

function getExpensesForEvent(eventId) {
  try {
    if (!eventId) return fail_('חסר מזהה אירוע.');
    var expenses = listRecords_(CONFIG.SHEETS.EXPENSES, false).filter(function (x) { return x.event_id === eventId; });
    var categories = listRecords_(CONFIG.SHEETS.CATEGORIES, false);
    var vendors = listRecords_(CONFIG.SHEETS.VENDORS, false);
    var artists = listRecords_(CONFIG.SHEETS.ARTISTS, false);

    var categoryMap = {}; categories.forEach(function (c) { categoryMap[c.category_id] = c.name; });
    var vendorMap = {}; vendors.forEach(function (v) { vendorMap[v.vendor_id] = v.name; });
    var artistMap = {}; artists.forEach(function (a) { artistMap[a.artist_id] = a.name; });

    var enriched = expenses.map(function (ex) { return enrichExpense_(ex, categoryMap, vendorMap, artistMap); });
    return ok_(enriched);
  } catch (e) {
    return fail_('לא הצלחנו לטעון את ההוצאות.', e);
  }
}

function createExpense(data) {
  try {
    var validationError = validateExpense_(data);
    if (validationError) return fail_(validationError);

    var record = insertRecord_(CONFIG.SHEETS.EXPENSES, 'expense_id', {
      event_id: data.event_id,
      name: String(data.name).trim(),
      category_id: data.category_id,
      planned_amount: toNumber_(data.planned_amount),
      agreed_amount: toNumber_(data.agreed_amount),
      vendor_id: data.vendor_id || '',
      artist_id: data.artist_id || '',
      paid_by: data.paid_by || '',
      manual_status: data.manual_status || EXPENSE_MANUAL_STATUS.PLANNED,
      expense_date: data.expense_date || '',
      internal_notes: data.internal_notes || ''
    });
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

    var updates = {
      name: String(data.name).trim(),
      category_id: data.category_id,
      planned_amount: toNumber_(data.planned_amount),
      agreed_amount: toNumber_(data.agreed_amount),
      vendor_id: data.vendor_id || '',
      artist_id: data.artist_id || '',
      paid_by: data.paid_by || '',
      manual_status: data.manual_status || EXPENSE_MANUAL_STATUS.PLANNED,
      expense_date: data.expense_date || ''
    };
    if (data.internal_notes !== undefined) updates.internal_notes = data.internal_notes;
    var record = updateRecord_(CONFIG.SHEETS.EXPENSES, 'expense_id', data.expense_id, updates);
    return ok_(record);
  } catch (e) {
    return fail_('לא הצלחנו לעדכן את ההוצאה.', e);
  }
}

function archiveExpense(expenseId) {
  try {
    if (!expenseId) return fail_('חסר מזהה הוצאה.');
    var record = archiveRecord_(CONFIG.SHEETS.EXPENSES, 'expense_id', expenseId);
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
  return null;
}

/** מוסיף שמות תצוגה וסטטוס מחושב להוצאה בודדת */
function enrichExpense_(ex, categoryMap, vendorMap, artistMap) {
  var agreed = toNumber_(ex.agreed_amount);
  var paid = 0; // ייכנס לתוקף עם מודול Payments
  var remaining = agreed - paid;
  var computedStatus = ex.manual_status;
  if (paid > 0 && paid < agreed) computedStatus = EXPENSE_COMPUTED_STATUS.PARTIALLY_PAID;
  else if (agreed > 0 && paid >= agreed) computedStatus = EXPENSE_COMPUTED_STATUS.PAID;

  return Object.assign({}, ex, {
    category_name: categoryMap[ex.category_id] || '',
    vendor_name: ex.vendor_id ? (vendorMap[ex.vendor_id] || '') : '',
    artist_name: ex.artist_id ? (artistMap[ex.artist_id] || '') : '',
    agreed_amount: agreed,
    planned_amount: toNumber_(ex.planned_amount),
    paid_amount: paid,
    remaining_amount: remaining,
    computed_status: computedStatus
  });
}
