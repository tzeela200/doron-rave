/**
 * EventsService.gs
 * ניהול אירועים: יצירה, עדכון, Archive, ורשימה עם סיכומים פיננסיים לכל Card.
 * נוסחאות (סעיף 41): הכנסות = סכום Income; הוצאות = סכום agreed_amount (כולל אמנים, פעם אחת);
 * יתרה = הכנסות - הוצאות; שולם = Payments ששולמו; נותר = הוצאות - שולם.
 */

/**
 * המספרים שכרטיס האירוע מציג מעבר לסיכומים: רווח צפוי, כרטיסים ואמנים.
 * הכל מחושב בזיכרון מנתונים שכבר נקראו — בלי קריאה נוספת ל-Sheets.
 * @param {Object} ev - רשומת אירוע
 * @param {Object} d - loadFinanceData_()
 */
function eventCardMetrics_(ev, d) {
  return {
    pnl: computeEventPnl_(ev, d.expenses, d.income),
    // נספר מההוצאות ולא מהליינאפ: הליינאפ כולל רק אמנים שהוזנו להם שעות,
    // ואירוע עם שישה אמנים בלי שעות היה מציג "0 אמנים".
    artists_count: d.expenses.filter(function (x) {
      return x.event_id === ev.event_id && x.artist_id;
    }).length
  };
}

function getEvents() {
  try {
    var d = loadFinanceData_();
    var result = d.events.map(function (ev) {
      return Object.assign({}, ev,
        computeEventTotals_(ev.event_id, d.expenses, d.income, d.payments),
        eventCardMetrics_(ev, d));
    });
    // אירועים עתידיים ראשונים ולפי סדר הגעה, ואחריהם ההיסטוריה מהאחרון לראשון.
    // כך האירוע הקרוב ביותר נמצא בראש הרשימה, כמו בבית.
    var today = todayIso_();
    var isUpcoming = function (ev) { return !!ev.event_date && String(ev.event_date) >= today; };
    result.sort(function (a, b) {
      var ua = isUpcoming(a), ub = isUpcoming(b);
      if (ua !== ub) return ua ? -1 : 1;
      var cmp = String(a.event_date || '').localeCompare(String(b.event_date || ''));
      return ua ? cmp : -cmp;
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

    var d = loadFinanceData_();
    var today = todayIso_();
    var expenses = d.expenses.filter(function (x) { return x.event_id === eventId; });
    var income = d.income.filter(function (x) { return x.event_id === eventId; }).map(enrichIncome_);

    var maps = buildNameMaps_(d);
    var paymentsByExpense = groupPaymentsByExpense_(d.payments);
    var methodMap = methodNameMap_(d.methods);
    var coverageMap = coverageMapByExpense_(maps.categories, maps.subcategories);

    var paidExpenseIds = paidExpenseIdSet_(d.payments);

    var enrichedExpenses = expenses.map(function (ex) {
      var enriched = enrichExpense_(ex, maps.categories, maps.vendors, maps.artists, paymentsByExpense[ex.expense_id] || [], today, maps.subcategories, coverageMap);
      enriched.payments = (paymentsByExpense[ex.expense_id] || [])
        .map(function (p) { return enrichPayment_(p, today, methodMap); })
        .sort(function (a, b) { return String(a.due_date || '9999') < String(b.due_date || '9999') ? -1 : 1; });
      return enriched;
    });

    var totals = computeEventTotals_(eventId, d.expenses, d.income, d.payments);
    var coverage = buildOperationalCoverage_(expenses, maps, coverageMap, paidExpenseIds);

    var byCategory = {};
    enrichedExpenses.forEach(function (ex) {
      var key = ex.category_name || 'לא מסווג';
      byCategory[key] = (byCategory[key] || 0) + ex.agreed_amount;
    });

    // פירוט לפי תת-קטגוריה בתוך כל קטגוריה. סכום תתי-הקטגוריות = סכום הקטגוריה (כל הוצאה נספרת פעם אחת).
    // "אמנים" לא מקבלת פירוט — אין לה תתי-קטגוריות.
    var bySubcategory = {};
    enrichedExpenses.forEach(function (ex) {
      var cat = ex.category_name || 'לא מסווג';
      if (isArtistsCategoryName_(cat)) return;
      var sub = ex.subcategory_name || NO_SUBCATEGORY_LABEL;
      bySubcategory[cat] = bySubcategory[cat] || {};
      bySubcategory[cat][sub] = (bySubcategory[cat][sub] || 0) + ex.agreed_amount;
    });

    // הוצאה בלי ספק נאספת ל"ללא ספק" במקום להישמט — אחרת החלוקה לא מסתכמת
    // לסה"כ ההוצאות, ושקלים נעלמים בלי שאיש רואה.
    var byVendor = {};
    enrichedExpenses.forEach(function (ex) {
      var key = ex.vendor_name || NO_VENDOR_LABEL;
      byVendor[key] = (byVendor[key] || 0) + ex.agreed_amount;
    });

    return ok_({
      event: event,
      expenses: enrichedExpenses,
      income: income,
      totals: totals,
      pnl: computeEventPnl_(event, expenses, income),
      coverage: coverage,
      readiness: buildEventReadiness_(event, coverage, maps),
      attention: buildAttentionItems_(d, today, { eventId: eventId }),
      artistLineup: buildArtistLineup_(enrichedExpenses),
      notes: listEntityNotes_(NOTE_ENTITY_TYPE.EVENT, eventId),
      expensesByCategory: byCategory,
      expensesBySubcategory: bySubcategory,
      expensesByVendor: byVendor,
      paymentMethods: d.methods
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
    ensureEnhancementSchema_();
    var record = insertRecord_(CONFIG.SHEETS.EVENTS, 'event_id', Object.assign({
      name: String(data.name).trim(),
      event_date: data.event_date,
      location: data.location || '',
      general_notes: data.general_notes || ''
    }, ticketForecastFields_(data)));
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

    ensureEnhancementSchema_();
    var record = updateRecord_(CONFIG.SHEETS.EVENTS, 'event_id', data.event_id, Object.assign({
      name: String(data.name).trim(),
      event_date: data.event_date,
      location: data.location || '',
      general_notes: data.general_notes || ''
    }, ticketForecastFields_(data)));
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
 * מחשב סיכומים לאירוע מתוך רשימות שכבר נטענו (למניעת קריאות כפולות ל-Sheets).
 * רק תשלומים של הוצאות פעילות של האירוע נספרים ב"שולם".
 */
function computeEventTotals_(eventId, allExpenses, allIncome, allPayments) {
  var expenses = allExpenses.filter(function (x) { return x.event_id === eventId; });
  var income = allIncome.filter(function (x) { return x.event_id === eventId; });

  var expenseIds = {};
  expenses.forEach(function (x) { expenseIds[x.expense_id] = true; });

  var totalExpenses = expenses.reduce(function (sum, x) { return sum + toNumber_(x.agreed_amount); }, 0);
  var totalIncome = income.reduce(function (sum, x) { return sum + toNumber_(x.total_amount); }, 0);
  var totalPaid = (allPayments || [])
    .filter(function (p) { return expenseIds[p.expense_id] && isPaymentPaid_(p); })
    .reduce(function (sum, p) { return sum + toNumber_(p.amount); }, 0);

  return {
    total_income: totalIncome,
    total_expenses: totalExpenses,
    balance: totalIncome - totalExpenses,
    total_paid: totalPaid,
    total_remaining: totalExpenses - totalPaid
  };
}

function buildNameMaps_(d) {
  var maps = { categories: {}, vendors: {}, artists: {}, subcategories: {} };
  d.categories.forEach(function (c) { maps.categories[c.category_id] = c.name; });
  (d.subcategories || []).forEach(function (s) { maps.subcategories[s.subcategory_id] = s.name; });
  d.vendors.forEach(function (v) { maps.vendors[v.vendor_id] = v.name; });
  d.artists.forEach(function (a) { maps.artists[a.artist_id] = a.name; });
  return maps;
}

/** שדות תחזית הכרטיסים של אירוע — אופציונליים, נשמרים רק אם נשלחו */
function ticketForecastFields_(data) {
  var fields = {};
  if (data.average_ticket_price !== undefined) fields.average_ticket_price = toNumber_(data.average_ticket_price);
  if (data.expected_ticket_count !== undefined) fields.expected_ticket_count = toNumber_(data.expected_ticket_count);
  return fields;
}

/**
 * תמונה פיננסית מורחבת (P&L) — בנוסף ל-computeEventTotals_, בלי לשנות את משמעות השדות שלו.
 * @param {Object} event - רשומת האירוע
 * @param {Object[]} allExpenses - הוצאות פעילות
 * @param {Object[]} allIncome - הכנסות פעילות
 */
/**
 * סבבי התמחור של האירוע, לפי הסדר שבו הם נמכרים.
 * @returns {{name: string, quantity: number, price: number}[]}
 */
function parseTicketTiers_(value) {
  if (!value) return [];
  var raw;
  try { raw = JSON.parse(value); } catch (e) { return []; }
  if (!raw || !raw.length) return [];
  return raw.map(function (t, i) {
    return {
      name: String((t && t.name) || ('סבב ' + (i + 1))).trim(),
      quantity: Math.max(0, Math.round(toNumber_(t && t.quantity))),
      price: Math.max(0, toNumber_(t && t.price))
    };
  }).filter(function (t) { return t.quantity > 0; });
}

/**
 * כמה כרטיסים צריך למכור כדי לכסות סכום, כשהמחיר משתנה בין סבבים.
 * נמכר לפי סדר הסבבים — קודם הראשון, ורק כשהוא נגמר עוברים לבא.
 * @returns {{tickets: number|null, covered: boolean}}
 */
function ticketsToCover_(tiers, amount) {
  if (amount <= 0) return { tickets: 0, covered: true };
  var left = amount, tickets = 0;
  for (var i = 0; i < tiers.length; i++) {
    var t = tiers[i];
    if (t.price <= 0) { tickets += t.quantity; continue; }
    var needed = Math.ceil(left / t.price);
    if (needed <= t.quantity) return { tickets: tickets + needed, covered: true };
    tickets += t.quantity;
    left -= t.quantity * t.price;
  }
  return { tickets: null, covered: false };   // כל הסבבים יחד לא מכסים
}

function computeEventPnl_(event, allExpenses, allIncome) {
  var eventId = event.event_id;
  var expenses = allExpenses.filter(function (x) { return x.event_id === eventId; });
  var income = allIncome.filter(function (x) { return x.event_id === eventId; }).map(enrichIncome_);

  // הוצאה בלי סכום מתוכנן נספרת לפי הסכום שסוכם, כדי שאירועים ותיקים לא ייראו בלי עלות מתוכננת
  var plannedExpenses = expenses.reduce(function (sum, x) {
    var planned = toNumber_(x.planned_amount);
    return sum + (planned > 0 ? planned : toNumber_(x.agreed_amount));
  }, 0);

  var ticketRows = income.filter(function (i) { return i.is_ticket_income; });
  var ticketsSold = ticketRows.reduce(function (sum, i) { return sum + toNumber_(i.quantity); }, 0);
  var ticketIncome = ticketRows.reduce(function (sum, i) { return sum + toNumber_(i.total_amount); }, 0);
  var nonTicketIncome = income.filter(function (i) { return !i.is_ticket_income; })
    .reduce(function (sum, i) { return sum + toNumber_(i.total_amount); }, 0);

  var actualAverage = ticketsSold > 0 ? ticketIncome / ticketsSold : null;
  var plannedAverage = toNumber_(event.average_ticket_price);
  // עדיפות למחיר שהמשתמשת הזינה — כך אפשר לחשב איזון עוד לפני שהתחילו מכירות
  var averageUsed = plannedAverage > 0 ? plannedAverage : ((actualAverage && actualAverage > 0) ? actualAverage : null);

  var remainingCost = Math.max(0, plannedExpenses - nonTicketIncome);

  // סבבי תמחור, אם הוגדרו, גוברים על המחיר הבודד: הם מתארים את התוכנית
  // האמיתית למכירה, כולל כמה כרטיסים יש בכל מחיר.
  var tiers = parseTicketTiers_(event.ticket_tiers);
  var tierCapacity = tiers.reduce(function (s, t) { return s + t.quantity; }, 0);

  var breakEvenTickets, breakEvenCovered = true;
  if (tiers.length) {
    var cover = ticketsToCover_(tiers, remainingCost);
    breakEvenTickets = cover.tickets;
    breakEvenCovered = cover.covered;
  } else {
    breakEvenTickets = averageUsed > 0 ? Math.ceil(remainingCost / averageUsed) : null;
  }
  var breakEvenRemaining = breakEvenTickets === null ? null : Math.max(0, breakEvenTickets - ticketsSold);

  var expectedTickets = tiers.length ? tierCapacity : toNumber_(event.expected_ticket_count);
  var forecastTicketIncome = null, forecastTotalIncome = null, forecastProfit = null;
  if (tiers.length) {
    forecastTicketIncome = tiers.reduce(function (s, t) { return s + t.quantity * t.price; }, 0);
    forecastTotalIncome = forecastTicketIncome + nonTicketIncome;
    forecastProfit = forecastTotalIncome - plannedExpenses;
  } else if (expectedTickets > 0 && averageUsed > 0) {
    forecastTicketIncome = expectedTickets * averageUsed;
    forecastTotalIncome = forecastTicketIncome + nonTicketIncome;
    forecastProfit = forecastTotalIncome - plannedExpenses;
  }

  return {
    ticket_tiers: tiers,
    // כל הסבבים יחד לא מכסים את העלות — מספר האיזון לא קיים, וזה לא "0"
    break_even_unreachable: tiers.length ? !breakEvenCovered : false,
    planned_expenses: plannedExpenses,
    tickets_sold: ticketsSold,
    ticket_income: ticketIncome,
    non_ticket_income: nonTicketIncome,
    actual_average_ticket_price: actualAverage,
    average_ticket_price_used: averageUsed,
    remaining_cost_to_cover: remainingCost,
    break_even_tickets: breakEvenTickets,
    break_even_remaining: breakEvenRemaining,
    expected_ticket_count: expectedTickets > 0 ? expectedTickets : null,
    forecast_ticket_income: forecastTicketIncome,
    forecast_total_income: forecastTotalIncome,
    forecast_profit: forecastProfit
  };
}

/**
 * לוח אמנים: הוצאות אמנים עם שעות בלבד, בסדר כרונולוגי של רצף לילה (21:00 -> 00:30 -> 02:00),
 * עם סימון חפיפות. חפיפה היא אזהרה בלבד ואינה חוסמת שמירה.
 */
/**
 * "מצב הפקה" — מה כבר סגור באירוע.
 *
 * שני סיפורים נפרדים באותו מסך: הכספי (כמה סוכם ושולם) והתפעולי (מה מכוסה).
 * רכיב יכול להיות סגור תפעולית גם בלי הוצאה נפרדת עבורו.
 *
 * מקורות לכל רכיב:
 * - הוצאה ישירה עם סכום שסוכם  → "מכוסה"
 * - הוצאה ישירה עדיין במצב מתוכנן → "בתהליך"
 * - שורת ExpenseCoverage        → "כלול ב-[שם ההוצאה]"
 *
 * הוצאה ישירה תמיד גוברת על כיסוי, כדי שרכיב לא יופיע פעמיים.
 * בשלב הזה לא מוצג "חסר" — אין עדיין רשימת "צרכים לאירוע", ולכן אין ממה לגזור חוסר.
 * שום דבר כאן לא נספר כספית.
 */
/**
 * האירוע הקרוב ביותר בעתיד שבו הישות הזו מופיעה — להקשר בכרטיס ספק/אמן.
 * @param {Object[]} entityExpenses - ההוצאות של הספק/האמן
 * @param {Object} eventById
 * @returns {{next_event_id: string, next_event_name: string, next_event_date: string}}
 */
function nextEventForExpenses_(entityExpenses, eventById, todayIso) {
  var candidates = [];
  var seen = {};
  (entityExpenses || []).forEach(function (ex) {
    var ev = eventById[ex.event_id];
    if (!ev || seen[ev.event_id]) return;
    if (!ev.event_date || String(ev.event_date) < todayIso) return;
    seen[ev.event_id] = true;
    candidates.push(ev);
  });
  candidates.sort(function (a, b) { return String(a.event_date).localeCompare(String(b.event_date)); });
  var next = candidates[0];
  return {
    next_event_id: next ? next.event_id : '',
    next_event_name: next ? next.name : '',
    next_event_date: next ? String(next.event_date) : ''
  };
}

/**
 * מסמן או מבטל "לא צריך" לרכיב אחד באירוע.
 * שומר רק את החריגים; אירוע בלי אף סימון מתנהג כאילו כל הרשימה נדרשת.
 */
/**
 * הוספה או הסרה של רכיב אחד מרשימת הצרכים של האירוע.
 * `needed=true` מוסיף, `false` מסיר. אותה חתימה כמו קודם, משמעות חדשה:
 * קודם זה סימן "לא צריך" מתוך רשימה קבועה; עכשיו הרשימה היא של המשתמשת.
 */
function setEventRequirement(eventId, key, needed) {
  try {
    if (!eventId) return fail_('חסר מזהה אירוע.');
    if (!requirementKeyExists_(key)) return fail_('רכיב לא מוכר.');
    ensureRequiredItemsSchema_();

    var found = findRowById_(CONFIG.SHEETS.EVENTS, 'event_id', eventId);
    if (!found) return fail_('האירוע המבוקש לא נמצא.');

    var items = parseRequiredItems_(found.obj.required_items);
    var at = items.indexOf(key);
    if (needed && at === -1) items.push(key);
    if (!needed && at !== -1) items.splice(at, 1);

    updateRecord_(CONFIG.SHEETS.EVENTS, 'event_id', eventId, { required_items: items.join(',') });
    return ok_({ required_items: items });
  } catch (e) {
    return fail_('לא הצלחנו לעדכן את מצב ההפקה.', e);
  }
}

/**
 * שמירת כל הבחירה בבת אחת, מתוך מסך הבחירה.
 * קריאה אחת במקום אחת לכל סימון.
 */
function setEventRequiredItems(eventId, keys) {
  try {
    if (!eventId) return fail_('חסר מזהה אירוע.');
    ensureRequiredItemsSchema_();

    var found = findRowById_(CONFIG.SHEETS.EVENTS, 'event_id', eventId);
    if (!found) return fail_('האירוע המבוקש לא נמצא.');

    var seen = {}, clean = [];
    (keys || []).forEach(function (k) {
      k = String(k || '').trim();
      if (!seen[k] && requirementKeyExists_(k)) { seen[k] = true; clean.push(k); }
    });

    updateRecord_(CONFIG.SHEETS.EVENTS, 'event_id', eventId, { required_items: clean.join(',') });
    return ok_({ required_items: clean });
  } catch (e) {
    return fail_('לא הצלחנו לשמור את מצב ההפקה.', e);
  }
}

/** מפתח תקף = קטגוריה או תת-קטגוריה שקיימות בפועל */
function requirementKeyExists_(key) {
  key = String(key || '');
  if (key.indexOf('cat:') === 0) {
    return !!findRowById_(CONFIG.SHEETS.CATEGORIES, 'category_id', key.slice(4));
  }
  if (key.indexOf('sub:') === 0) {
    ensureSubcategorySchema_();
    return !!findRowById_(CONFIG.SHEETS.SUBCATEGORIES, 'subcategory_id', key.slice(4));
  }
  return false;
}


/**
 * מצב ההפקה: מה סגור ומה חסר, לכל שלב ברשימה הקבועה.
 *
 * ✓ מכוסה    — יש הוצאה שסוכמה, או שהרכיב כלול בעסקה אחרת
 * • בתהליך   — יש הוצאה, עדיין "מתוכנן"
 * ⚠ חסר      — נדרש, ואין לו כיסוי
 * (לא מוצג)  — סומן "לא צריך לאירוע הזה"
 *
 * הכלל של המשתמשת: "זה שלא צריך זה לא אומר שזה חסר".
 */
/**
 * סיכום מוכנות לאירוע אחד — כמה שלבים סגורים מתוך כמה שנדרשים.
 * משמש את רשימת האירועים בבית, כדי שאפשר יהיה לראות באיזה אירוע מפגרים.
 */
/**
 * אחוז המוכנות. אירוע שלא הוגדרו לו צרכים מחזיר total=0 ו-configured=false,
 * והממשק לא מציג אחוז — עדיף בלי מספר מאשר מספר על מכנה שהמשתמשת לא בחרה.
 */
function summarizeEventReadiness_(event, allExpenses, maps, coverageMap, paidExpenseIds) {
  var mine = allExpenses.filter(function (x) { return x.event_id === event.event_id; });
  var rows = buildEventReadiness_(event, buildOperationalCoverage_(mine, maps, coverageMap, paidExpenseIds), maps);
  var done = rows.filter(function (r) { return r.status === 'covered' || r.status === 'included'; }).length;
  return {
    configured: rows.length > 0,
    done: done,
    total: rows.length,
    missing: rows.filter(function (r) { return r.status === 'missing'; }).length,
    percent: rows.length ? Math.round(done / rows.length * 100) : 0
  };
}

/**
 * שמירת סבבי התמחור של האירוע.
 * @param {string} eventId
 * @param {{name: string, quantity: number, price: number}[]} tiers - לפי סדר המכירה
 */
function setEventTicketTiers(eventId, tiers) {
  try {
    if (!eventId) return fail_('חסר מזהה אירוע.');
    ensureRequiredItemsSchema_();

    var found = findRowById_(CONFIG.SHEETS.EVENTS, 'event_id', eventId);
    if (!found) return fail_('האירוע המבוקש לא נמצא.');

    var clean = [];
    (tiers || []).forEach(function (t, i) {
      var quantity = Math.round(toNumber_(t && t.quantity));
      var price = toNumber_(t && t.price);
      if (quantity <= 0) return;                       // שורה ריקה פשוט לא נשמרת
      if (price < 0) return;
      clean.push({
        name: String((t && t.name) || ('סבב ' + (i + 1))).trim().slice(0, 60),
        quantity: quantity,
        price: price
      });
    });
    if (clean.length > 20) return fail_('אפשר להגדיר עד 20 סבבי תמחור.');

    updateRecord_(CONFIG.SHEETS.EVENTS, 'event_id', eventId,
      { ticket_tiers: clean.length ? JSON.stringify(clean) : '' });
    return ok_({ ticket_tiers: clean });
  } catch (e) {
    return fail_('לא הצלחנו לשמור את סבבי התמחור.', e);
  }
}

/** מפתחות הצרכים שהמשתמשת סימנה לאירוע. ריק = לא הוגדר. */
function parseRequiredItems_(value) {
  return String(value || '').split(',')
    .map(function (x) { return x.trim(); })
    .filter(function (x) { return /^(sub|cat):/.test(x); });
}

/**
 * שורות "מצב ההפקה" — אחת לכל רכיב שהמשתמשת סימנה שהאירוע צריך.
 * ההתאמה לפי מזהה, ולכן שינוי שם של קטגוריה לא משפיע.
 *
 * @param {Object} event - שורת האירוע (נדרש `required_items`)
 * @param {Object[]} coverageItems - buildOperationalCoverage_
 * @param {Object} maps - buildNameMaps_, לשמות התצוגה
 */
function buildEventReadiness_(event, coverageItems, maps) {
  var required = parseRequiredItems_(event.required_items);
  if (!required.length) return [];

  var byKey = {};
  (coverageItems || []).forEach(function (c) {
    if (!byKey[c.key] || readinessRank_(c.status) < readinessRank_(byKey[c.key].status)) byKey[c.key] = c;
  });

  maps = maps || { categories: {}, subcategories: {} };
  return required.map(function (key) {
    var hit = byKey[key] || null;
    var id = key.slice(4);
    var label = key.indexOf('sub:') === 0
      ? (maps.subcategories[id] || (hit && hit.name) || 'רכיב שנמחק')
      : (maps.categories[id] || (hit && hit.name) || 'רכיב שנמחק');
    return {
      key: key,
      label: label,
      status: hit ? hit.status : 'missing',
      // שם הרכיב שסגר את הצורך — כדי שלא יופיע שוב כ"סגור גם"
      matched_name: hit ? hit.name : label,
      source_name: hit ? hit.source_name : '',
      source_expense_id: hit ? hit.source_expense_id : ''
    };
  });
}

var READINESS_RANK_ = { covered: 0, included: 1, in_progress: 2 };
function readinessRank_(status) {
  var r = READINESS_RANK_[status];
  return r === undefined ? 9 : r;
}

/** אילו הוצאות שולמו ולו חלקית — קובע אם עסקה נחשבת סגורה */
function paidExpenseIdSet_(payments) {
  var set = {};
  (payments || []).forEach(function (p) { if (isPaymentPaid_(p)) set[p.expense_id] = true; });
  return set;
}

/**
 * @param {Object[]} expenses - שורות גולמיות של הוצאות האירוע
 * @param {Object} maps - buildNameMaps_
 * @param {Object} coverageMap - coverageMapByExpense_
 * @param {Object} paidExpenseIds - paidExpenseIdSet_
 */
function buildOperationalCoverage_(expenses, maps, coverageMap, paidExpenseIds) {
  var byKey = {};

  var put = function (key, item) {
    if (!key) return;
    var prev = byKey[key];
    // מכוסה > כלול > בתהליך
    var rank = { covered: 0, included: 1, in_progress: 2 };
    if (prev && rank[prev.status] <= rank[item.status]) return;
    byKey[key] = item;
  };

  (expenses || []).forEach(function (ex) {
    // גם הוצאת אמן סוגרת צורך ("אמנים" ברשימת שלבי ההפקה).
    // היא נספרת לפי הקטגוריה שלה, כי לקטגוריית "אמנים" אין תתי-קטגוריות.
    var key = ex.subcategory_id ? ('sub:' + ex.subcategory_id) : (ex.category_id ? ('cat:' + ex.category_id) : '');
    var subName = ex.subcategory_id ? (maps.subcategories[ex.subcategory_id] || '') : '';
    var catName = maps.categories[ex.category_id] || '';
    var name = subName || catName;
    if (key && name) {
      // "מכוסה" רק כשהעסקה באמת נסגרה: סוכמה, או שכבר יצא ממנה כסף.
      var closed = toNumber_(ex.agreed_amount) > 0 &&
        (normalizeManualStatus_(ex.manual_status) === EXPENSE_MANUAL_STATUS.AGREED || !!paidExpenseIds[ex.expense_id]);
      put(key, {
        key: key,
        name: name,
        parent_name: subName ? catName : '',
        status: closed ? 'covered' : 'in_progress',
        source_expense_id: ex.expense_id,
        source_name: ex.name
      });
    }

    ((coverageMap || {})[ex.expense_id] || []).forEach(function (item) {
      put(item.key, {
        key: item.key,
        name: item.name,
        parent_name: '',
        status: 'included',
        source_expense_id: ex.expense_id,
        source_name: ex.name
      });
    });
  });

  var order = { covered: 0, included: 1, in_progress: 2 };
  return Object.keys(byKey).map(function (k) { return byKey[k]; })
    .sort(function (a, b) {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return String(a.name).localeCompare(String(b.name), 'he');
    });
}

function buildArtistLineup_(enrichedExpenses) {
  var slots = enrichedExpenses
    .filter(function (ex) { return ex.performance_start_time && ex.performance_end_time && ex.performance_duration_minutes; })
    .map(function (ex) {
      var start = nightSortKey_(ex.performance_start_time);
      return {
        expense_id: ex.expense_id,
        artist_id: ex.artist_id || '',
        name: ex.artist_name || ex.name,
        expense_name: ex.name,
        start_time: ex.performance_start_time,
        end_time: ex.performance_end_time,
        duration_minutes: ex.performance_duration_minutes,
        duration_text: ex.performance_duration_text,
        agreed_amount: ex.agreed_amount,
        hourly_rate: ex.hourly_rate,
        __start: start,
        __end: start + ex.performance_duration_minutes
      };
    })
    .sort(function (a, b) { return a.__start - b.__start; });

  slots.forEach(function (slot) {
    slot.overlaps_with = slots.filter(function (other) {
      return other !== slot && slot.__start < other.__end && other.__start < slot.__end;
    }).map(function (other) { return other.name; });
  });

  return slots.map(function (slot) {
    delete slot.__start;
    delete slot.__end;
    return slot;
  });
}
