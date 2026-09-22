/**
 * EventsService.gs
 * ניהול אירועים: יצירה, עדכון, Archive, ורשימה עם סיכומים פיננסיים לכל Card.
 *
 * הערה: בשלב הנוכחי (עד Expenses כולל) עדיין אין Payments — לכן "שולם" ו"נותר לתשלום"
 * מוצגים לפי מה שקיים בפועל (0 עד שיתווסף מודול Payments), כדי לא להציג נתון שגוי.
 */

function getEvents() {
  try {
    var events = listRecords_(CONFIG.SHEETS.EVENTS, false);
    var allExpenses = listRecords_(CONFIG.SHEETS.EXPENSES, false);
    var allIncome = listRecords_(CONFIG.SHEETS.INCOME, false);

    var result = events.map(function (ev) {
      var totals = computeEventTotals_(ev.event_id, allExpenses, allIncome);
      return Object.assign({}, ev, totals);
    });

    result.sort(function (a, b) {
      return new Date(b.event_date) - new Date(a.event_date);
    });

    return ok_(result);
  } catch (e) {
    return fail_('לא הצלחנו לטעון את רשימת האירועים.', e);
  }
}

function getEventDetails(eventId) {
  try {
    var found = findRowById_(CONFIG.SHEETS.EVENTS, 'event_id', eventId);
    if (!found) return fail_('האירוע המבוקש לא נמצא.');
    var event = found.obj;
    delete event.__row;

    var expenses = listRecords_(CONFIG.SHEETS.EXPENSES, false).filter(function (x) { return x.event_id === eventId; });
    var income = listRecords_(CONFIG.SHEETS.INCOME, false).filter(function (x) { return x.event_id === eventId; });
    var categories = listRecords_(CONFIG.SHEETS.CATEGORIES, false);
    var vendors = listRecords_(CONFIG.SHEETS.VENDORS, false);
    var artists = listRecords_(CONFIG.SHEETS.ARTISTS, false);

    var categoryMap = {};
    categories.forEach(function (c) { categoryMap[c.category_id] = c.name; });
    var vendorMap = {};
    vendors.forEach(function (v) { vendorMap[v.vendor_id] = v.name; });
    var artistMap = {};
    artists.forEach(function (a) { artistMap[a.artist_id] = a.name; });

    var enrichedExpenses = expenses.map(function (ex) {
      return Object.assign({}, ex, {
        category_name: categoryMap[ex.category_id] || '',
        vendor_name: ex.vendor_id ? (vendorMap[ex.vendor_id] || '') : '',
        artist_name: ex.artist_id ? (artistMap[ex.artist_id] || '') : '',
        agreed_amount: toNumber_(ex.agreed_amount),
        planned_amount: toNumber_(ex.planned_amount)
      });
    });

    var totals = computeEventTotals_(eventId, expenses, income);

    var byCategory = {};
    enrichedExpenses.forEach(function (ex) {
      var key = ex.category_name || 'לא מסווג';
      byCategory[key] = (byCategory[key] || 0) + toNumber_(ex.agreed_amount);
    });

    var byVendor = {};
    enrichedExpenses.forEach(function (ex) {
      if (!ex.vendor_name) return;
      byVendor[ex.vendor_name] = (byVendor[ex.vendor_name] || 0) + toNumber_(ex.agreed_amount);
    });

    return ok_({
      event: event,
      expenses: enrichedExpenses,
      income: income,
      totals: totals,
      expensesByCategory: byCategory,
      expensesByVendor: byVendor
    });
  } catch (e) {
    return fail_('לא הצלחנו לטעון את פרטי האירוע.', e);
  }
}

function createEvent(data) {
  try {
    if (!data || !data.name || !String(data.name).trim()) {
      return fail_('שם האירוע הוא שדה חובה.');
    }
    if (!data.event_date) {
      return fail_('תאריך האירוע הוא שדה חובה.');
    }
    var record = insertRecord_(CONFIG.SHEETS.EVENTS, 'event_id', {
      name: String(data.name).trim(),
      event_date: data.event_date,
      location: data.location || '',
      general_notes: data.general_notes || ''
    });
    return ok_(record);
  } catch (e) {
    return fail_('לא הצלחנו ליצור את האירוע.', e);
  }
}

function updateEvent(data) {
  try {
    if (!data || !data.event_id) return fail_('חסר מזהה אירוע לעדכון.');
    if (!data.name || !String(data.name).trim()) return fail_('שם האירוע הוא שדה חובה.');
    if (!data.event_date) return fail_('תאריך האירוע הוא שדה חובה.');

    var record = updateRecord_(CONFIG.SHEETS.EVENTS, 'event_id', data.event_id, {
      name: String(data.name).trim(),
      event_date: data.event_date,
      location: data.location || '',
      general_notes: data.general_notes || ''
    });
    return ok_(record);
  } catch (e) {
    return fail_('לא הצלחנו לעדכן את האירוע.', e);
  }
}

function archiveEvent(eventId) {
  try {
    if (!eventId) return fail_('חסר מזהה אירוע.');
    var record = archiveRecord_(CONFIG.SHEETS.EVENTS, 'event_id', eventId);
    return ok_(record);
  } catch (e) {
    return fail_('לא הצלחנו לארכב את האירוע.', e);
  }
}

/**
 * מחשב סה"כ הכנסות/הוצאות/יתרה עבור אירוע נתון, מתוך רשימות שכבר נטענו (למניעת קריאות כפולות ל-Sheets).
 * שולם/נותר יתווספו כאשר יתווסף מודול Payments.
 */
function computeEventTotals_(eventId, allExpenses, allIncome) {
  var expenses = allExpenses.filter(function (x) { return x.event_id === eventId; });
  var income = allIncome.filter(function (x) { return x.event_id === eventId; });

  var totalExpenses = expenses.reduce(function (sum, x) { return sum + toNumber_(x.agreed_amount); }, 0);
  var totalIncome = income.reduce(function (sum, x) { return sum + toNumber_(x.total_amount); }, 0);

  return {
    total_income: totalIncome,
    total_expenses: totalExpenses,
    balance: totalIncome - totalExpenses,
    total_paid: 0,        // ייכנס לתוקף עם מודול Payments
    total_remaining: totalExpenses // עד שיתווסף Payments, "נותר" = כל ההוצאה
  };
}
