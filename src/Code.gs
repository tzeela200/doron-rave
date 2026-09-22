/**
 * Code.gs
 * נקודת הכניסה של ה-Web App.
 */

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle("DORON'S RAVE")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** מאפשר לכלול קבצי HTML/CSS/JS נוספים בתוך Index.html באמצעות <?!= include('Filename'); ?> */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * טוען בבת אחת את כל המידע הדרוש למסך הראשי (בית), כדי לצמצם קריאות google.script.run.
 */
function getInitialData() {
  try {
    var d = loadFinanceData_();
    var today = todayIso_();

    // האירוע ב"פוסטר" הוא הקרוב ביותר **בעתיד**, לא המאוחר ביותר.
    var upcomingRaw = d.events.filter(function (ev) { return ev.event_date && String(ev.event_date) >= today; })
      .sort(function (a, b) { return String(a.event_date).localeCompare(String(b.event_date)); });
    var pastRaw = d.events.filter(function (ev) { return !ev.event_date || String(ev.event_date) < today; })
      .sort(function (a, b) { return String(b.event_date).localeCompare(String(a.event_date)); });

    // אם אין אף אירוע עתידי, הבית עדיין מראה משהו: האחרון שהיה.
    var heroList = upcomingRaw.length ? upcomingRaw : pastRaw.slice(0, 1);

    // המוכנות נבנית פעם אחת מהמפות המשותפות — בלי קריאה נוספת ל-Sheets לכל אירוע
    var maps = buildNameMaps_(d);
    var coverageMap = coverageMapByExpense_(maps.categories, maps.subcategories);
    var paidExpenseIds = paidExpenseIdSet_(d.payments);

    var withTotals = function (ev) {
      var totals = computeEventTotals_(ev.event_id, d.expenses, d.income, d.payments);
      // כרטיס האירוע מציג רווח צפוי, כרטיסים ואמנים — ולכן כל אירוע מקבל אותם,
      // לא רק זה שבראש. החישוב בזיכרון בלבד, בלי קריאה נוספת ל-Sheets.
      return Object.assign({}, ev, totals, eventCardMetrics_(ev, d), {
        is_upcoming: String(ev.event_date || '') >= today,
        readiness: summarizeEventReadiness_(ev, d.expenses, maps, coverageMap, paidExpenseIds)
      });
    };

    var hero = heroList.length ? withTotals(heroList[0]) : null;

    // הפוסטר כבר מציג את הראשון ברשימה שממנה נלקח — הרשימות הבאות מדלגות עליו
    var heroFromPast = !upcomingRaw.length && pastRaw.length;
    // כל האירועים העתידיים, לא שניים — הבית צריך להראות את העסק, לא אירוע אחד
    var upcomingList = upcomingRaw.slice(1).map(withTotals);
    var pastList = pastRaw.slice(heroFromPast ? 1 : 0, (heroFromPast ? 1 : 0) + 3).map(withTotals);

    var upcoming = buildUpcomingPayments_(d, today);
    var attention = buildAttentionItems_(d, today);

    return ok_({
      heroEvent: hero,
      upcomingEvents: upcomingList,
      pastEvents: pastList,
      upcomingEventsCount: upcomingRaw.length,
      financial: summarizeActiveFinances_(d, upcomingRaw),
      // ארבע משימות — זה מה שנכנס במסך הראשון בטלפון יחד עם ה-KPI. השאר במסך המלא.
      attention: attention.slice(0, 4),
      attentionCount: attention.length,
      upcomingPayments: upcoming.slice(0, 5),
      upcomingCount: upcoming.length,
      overdueCount: upcoming.filter(function (p) { return p.is_overdue; }).length,
      categories: categoriesWithSubcategories_(d.categories, d.subcategories),
      // הבית מסמן את המטמון כטעון, ולכן חייב להחזיר גם את רשימת רכיבי "מה כלול".
      // הבנייה היא בזיכרון בלבד, מנתונים שכבר נקראו — בלי קריאה נוספת ל-Sheets.
      coverageOptions: buildCoverageOptions_(d.categories, d.subcategories),
      vendors: d.vendors,
      artists: d.artists,
      paymentMethods: d.methods,
      eventsCount: d.events.length,
      currentUser: currentUserEmail_()
    });
  } catch (e) {
    return fail_('לא הצלחנו לטעון את נתוני הבית. ודאי ש-initializeSystem() הופעלה.', e);
  }
}

/**
 * מצב כספי על האירועים הפעילים (העתידיים), במעבר אחד.
 * מתוכנן / מוסכם / שולם / נותר הם ארבעה מושגים נפרדים — לא מערבבים ביניהם.
 * "מתוכנן" נופל חזרה ל"מוסכם" רק לרשומות שאין להן סכום מתוכנן (כמו ב-computeEventPnl_).
 */
function summarizeActiveFinances_(d, activeEvents) {
  var inScope = {};
  activeEvents.forEach(function (ev) { inScope[ev.event_id] = true; });

  var planned = 0, agreed = 0, expenseInScope = {};
  d.expenses.forEach(function (ex) {
    if (!inScope[ex.event_id]) return;
    expenseInScope[ex.expense_id] = true;
    var a = toNumber_(ex.agreed_amount);
    var pl = toNumber_(ex.planned_amount);
    agreed += a;
    planned += (pl > 0 ? pl : a);
  });

  var paid = 0;
  d.payments.forEach(function (p) {
    if (expenseInScope[p.expense_id] && isPaymentPaid_(p)) paid += toNumber_(p.amount);
  });

  var income = 0;
  d.income.forEach(function (i) { if (inScope[i.event_id]) income += toNumber_(i.total_amount); });

  // "רווח צפוי" משתמש בתחזית הכרטיסים כשהיא קיימת,
  // ואחרת נופל למאזן בפועל. כך ה-KPI מציג מספר גם לפני שהוזנה תחזית.
  var forecast = 0, hasForecast = false;
  activeEvents.forEach(function (ev) {
    var pnl = computeEventPnl_(ev, d.expenses, d.income);
    if (pnl.forecast_profit !== null) { forecast += pnl.forecast_profit; hasForecast = true; }
    else forecast += (pnl.ticket_income + pnl.non_ticket_income) - pnl.planned_expenses;
  });

  return {
    events_count: activeEvents.length,
    planned: planned,
    agreed: agreed,
    paid: paid,
    remaining: agreed - paid,
    income: income,
    balance: income - agreed,
    forecast_profit: forecast,
    forecast_is_projection: hasForecast
  };
}

/**
 * כל רשימות הבחירה של טופס ההוצאה/החיפוש בקריאה אחת (במקום 4 קריאות נפרדות).
 */
function getFormLookups() {
  try {
    var byName = function (a, b) { return String(a.name).localeCompare(String(b.name), 'he'); };
    var categories = listRecords_(CONFIG.SHEETS.CATEGORIES, false);
    var subcategories = listSubcategories_(false);
    return ok_({
      categories: categoriesWithSubcategories_(categories, subcategories),
      vendors: listRecords_(CONFIG.SHEETS.VENDORS, false).sort(byName),
      artists: listRecords_(CONFIG.SHEETS.ARTISTS, false).sort(byName),
      paymentMethods: loadPaymentMethods_(),
      coverageOptions: buildCoverageOptions_(categories, subcategories)
    });
  } catch (e) {
    return fail_('לא הצלחנו לטעון את הרשימות.', e);
  }
}

/** החשבון המחובר — בלי לקרוא את ה-Sheet בכלל */
function getCurrentUser() {
  return ok_({ email: currentUserEmail_() });
}
