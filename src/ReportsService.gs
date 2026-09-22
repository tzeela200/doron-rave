/**
 * ReportsService.gs
 * השוואת אירועים (סעיף 60) וחיפוש/סינון הוצאות (סעיף 61).
 */

/** @param {string[]} eventIds - לפחות שני אירועים */
function getComparison(eventIds) {
  try {
    if (!eventIds || eventIds.length < 2) return fail_('יש לבחור לפחות שני אירועים.');
    var d = loadFinanceData_();
    var maps = buildNameMaps_(d);
    var eventMap = {};
    d.events.forEach(function (ev) { eventMap[ev.event_id] = ev; });

    var categoryTotals = {};
    var events = eventIds.filter(function (id) { return eventMap[id]; }).map(function (id) {
      var ev = eventMap[id];
      var byCategory = {};
      d.expenses.forEach(function (ex) {
        if (ex.event_id !== id) return;
        var cat = maps.categories[ex.category_id] || 'לא מסווג';
        byCategory[cat] = (byCategory[cat] || 0) + toNumber_(ex.agreed_amount);
        categoryTotals[cat] = (categoryTotals[cat] || 0) + toNumber_(ex.agreed_amount);
      });
      return {
        event_id: ev.event_id,
        name: ev.name,
        event_date: ev.event_date,
        totals: computeEventTotals_(id, d.expenses, d.income, d.payments),
        by_category: byCategory
      };
    });

    if (events.length < 2) return fail_('יש לבחור לפחות שני אירועים פעילים.');

    // קטגוריה שלא קיימת באירוע מסוים מוצגת בו כ-0 ₪ (סעיף 60)
    var categories = Object.keys(categoryTotals).sort(function (a, b) { return categoryTotals[b] - categoryTotals[a]; });
    events.forEach(function (ev) {
      categories.forEach(function (c) { if (ev.by_category[c] === undefined) ev.by_category[c] = 0; });
    });

    events.sort(function (a, b) { return String(a.event_date) < String(b.event_date) ? -1 : 1; });
    return ok_({ events: events, categories: categories });
  } catch (e) {
    return fail_('לא הצלחנו לטעון את ההשוואה.', e);
  }
}

/**
 * @param {Object} f - q, event_id, category_id, vendor_id, artist_id, status, payment_method_id,
 *                     paid_by, date_from, date_to, due_from, due_to (תאריכים כ-'yyyy-MM-dd')
 */
function searchExpenses(f) {
  try {
    f = f || {};
    var d = loadFinanceData_();
    var today = todayIso_();
    var maps = buildNameMaps_(d);
    var eventMap = {};
    d.events.forEach(function (ev) { eventMap[ev.event_id] = ev; });
    var paymentsByExpense = groupPaymentsByExpense_(d.payments);
    var q = String(f.q || '').trim().toLowerCase();
    var paidBy = String(f.paid_by || '').trim().toLowerCase();

    var results = d.expenses.filter(function (ex) {
      if (!eventMap[ex.event_id]) return false; // אירועים בארכיון לא נכללים
      if (f.event_id && ex.event_id !== f.event_id) return false;
      if (f.category_id && ex.category_id !== f.category_id) return false;
      if (f.subcategory_id && ex.subcategory_id !== f.subcategory_id) return false;
      if (f.vendor_id && ex.vendor_id !== f.vendor_id) return false;
      if (f.artist_id && ex.artist_id !== f.artist_id) return false;
      if (q && String(ex.name).toLowerCase().indexOf(q) === -1 && String(ex.internal_notes || '').toLowerCase().indexOf(q) === -1) return false;
      if (paidBy && String(ex.paid_by || '').toLowerCase().indexOf(paidBy) === -1) return false;
      if (f.date_from && (!ex.expense_date || String(ex.expense_date) < f.date_from)) return false;
      if (f.date_to && (!ex.expense_date || String(ex.expense_date) > f.date_to)) return false;

      var payments = paymentsByExpense[ex.expense_id] || [];
      if (f.payment_method_id && !payments.some(function (p) { return p.payment_method_id === f.payment_method_id; })) return false;
      if (f.due_from || f.due_to) {
        var inRange = payments.some(function (p) {
          if (!p.due_date) return false;
          var due = String(p.due_date);
          return (!f.due_from || due >= f.due_from) && (!f.due_to || due <= f.due_to);
        });
        if (!inRange) return false;
      }
      return true;
    }).map(function (ex) {
      var enriched = enrichExpense_(ex, maps.categories, maps.vendors, maps.artists, paymentsByExpense[ex.expense_id] || [], today, maps.subcategories);
      enriched.event_name = eventMap[ex.event_id].name;
      enriched.event_date = eventMap[ex.event_id].event_date;
      return enriched;
    }).filter(function (ex) {
      if (!f.status) return true;
      if (f.status === PAYMENT_DISPLAY_OVERDUE) return ex.has_overdue;
      return ex.computed_status === f.status;
    });

    results.sort(function (a, b) {
      if (a.event_date !== b.event_date) return String(a.event_date) < String(b.event_date) ? 1 : -1;
      return String(a.name).localeCompare(String(b.name), 'he');
    });

    var summary = results.reduce(function (s, ex) {
      s.total += ex.agreed_amount; s.paid += ex.paid_amount; s.remaining += ex.remaining_amount;
      return s;
    }, { count: results.length, total: 0, paid: 0, remaining: 0 });

    return ok_({ results: results.slice(0, 300), summary: summary, truncated: results.length > 300 });
  } catch (e) {
    return fail_('לא הצלחנו לבצע את החיפוש.', e);
  }
}
