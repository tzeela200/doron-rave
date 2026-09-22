/**
 * AttentionService.gs
 * "מה לעשות עכשיו" — מאחד מידע שכבר קיים במערכת במקום ליצור מודול משימות חדש.
 *
 * הכלל: כל שורה מנוסחת כפעולה, לא כדיווח. "לשלם לאלעד 5,000 ₪", לא "תשלום ממתין".
 * מערכת שמציגה מידע היא פסיבית; מערכת שאומרת מה לעשות חוסכת למפיק את שלב התרגום.
 *
 * מקורות:
 * - תשלומים באיחור ותשלומים בטווח הימים הקרוב (Payments).
 * - תזכורות פתוחות שהגיע מועדן או שקרוב (Notes, note_type = reminder).
 * - **חוסרים בהיערכות לאירוע מתקרב**: עסקה שנסגרה בלי לוח תשלומים, הוצאות שעדיין
 *   לא סוכמו (כלומר ספק/אמן שטרם אישר), אירוע בלי מחיר כרטיס ואירוע בלי הכנסות.
 *   אלה הפריטים שגורמים ל"הכל מסודר" להיות אמיתי במקום ריק.
 *
 * אין כאן שום כתיבה, ואין ישות חדשה. הכול נגזר מנתונים קיימים.
 * חוסרים מקובצים לפריט אחד לאירוע, כדי שהרשימה תישאר קצרה ותניע פעולה.
 */

/** תאריך ISO במרחק N ימים מהיום */
function isoPlusDays_(todayIso, days) {
  var parts = String(todayIso).split('-');
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

/**
 * דחיפות לפי תאריך, לצורך מיון ותצוגה.
 * @returns {{severity: string, text: string, rank: number}}
 */
function attentionUrgency_(dateIso, todayIso) {
  if (!dateIso) return { severity: 'later', text: 'ללא מועד', rank: 4 };
  var d = String(dateIso);
  if (d < todayIso) return { severity: 'overdue', text: 'באיחור', rank: 0 };
  if (d === todayIso) return { severity: 'today', text: 'היום', rank: 1 };
  if (d <= isoPlusDays_(todayIso, ATTENTION_HORIZON_DAYS)) return { severity: 'soon', text: 'השבוע', rank: 2 };
  return { severity: 'later', text: '', rank: 3 };
}

/**
 * כל התזכורות הפתוחות בטווח (כולל כאלה שעבר מועדן), על פני כל הישויות.
 * קריאה אחת ל-Tab Notes. מחזיר [] אם ה-Tab עוד לא נוצר.
 */
function listOpenReminders_(todayIso, horizonDays) {
  var ss = getActiveSpreadsheet_();
  if (!ss.getSheetByName(CONFIG.SHEETS.NOTES)) return [];
  var limit = isoPlusDays_(todayIso, horizonDays === undefined ? ATTENTION_HORIZON_DAYS : horizonDays);

  return listRecords_(CONFIG.SHEETS.NOTES, false)
    .filter(function (n) {
      return n.note_type === NOTE_TYPE.REMINDER
        && !toBool_(n.is_completed)
        && !!n.reminder_date
        && String(n.reminder_date) <= limit;
    })
    .map(enrichNote_)
    .sort(function (a, b) { return String(a.reminder_date).localeCompare(String(b.reminder_date)); });
}

/**
 * בונה את רשימת "דורש טיפול".
 *
 * @param {Object} d - התוצאה של loadFinanceData_()
 * @param {string} todayIso
 * @param {Object=} opts - { eventId: מסנן לאירוע אחד, reminders: רשימה מוכנה כדי לא לקרוא שוב }
 * @returns {Object[]} פריטים במבנה אחיד, ממוינים לפי דחיפות ואז לפי תאריך
 */
function buildAttentionItems_(d, todayIso, opts) {
  opts = opts || {};
  var items = [];

  var eventById = {};
  d.events.forEach(function (ev) { eventById[ev.event_id] = ev; });

  // מי עומד מאחורי ההוצאה — בלי זה אי אפשר לנסח משימה בציווי
  var whoName = {};
  var vendorName = {}, artistName = {};
  d.vendors.forEach(function (v) { vendorName[v.vendor_id] = v.name; });
  d.artists.forEach(function (a) { artistName[a.artist_id] = artistDisplayName_(a); });
  d.expenses.forEach(function (ex) {
    whoName[ex.expense_id] = (ex.artist_id && artistName[ex.artist_id])
      || (ex.vendor_id && vendorName[ex.vendor_id]) || '';
  });

  var expenseById = {};
  d.expenses.forEach(function (ex) {
    if (opts.eventId && ex.event_id !== opts.eventId) return;
    if (eventById[ex.event_id]) expenseById[ex.expense_id] = ex;
  });

  var horizon = isoPlusDays_(todayIso, ATTENTION_HORIZON_DAYS);

  // --- תשלומים ---
  d.payments.forEach(function (p) {
    var ex = expenseById[p.expense_id];
    if (!ex || isPaymentPaid_(p) || !p.due_date) return;
    if (String(p.due_date) > horizon) return;

    var ev = eventById[ex.event_id];
    var u = attentionUrgency_(p.due_date, todayIso);
    var who = whoName[ex.expense_id];
    items.push({
      kind: 'payment',
      id: p.payment_id,
      title: who ? ('לשלם ל' + who) : ('לשלם עבור ' + ex.name),
      subtitle: [ev ? ev.name : '', who ? ex.name : ''].filter(Boolean).join(' · '),
      amount: toNumber_(p.amount),
      date: String(p.due_date),
      severity: u.severity,
      urgency_text: u.text,
      rank: u.rank,
      event_id: ex.event_id,
      expense_id: ex.expense_id
    });
  });

  // --- תזכורות ---
  var reminders = opts.reminders || listOpenReminders_(todayIso);
  reminders.forEach(function (n) {
    if (opts.eventId && !(n.entity_type === NOTE_ENTITY_TYPE.EVENT && n.entity_id === opts.eventId)) return;

    var context = n.entity_type === NOTE_ENTITY_TYPE.EVENT
      ? ((eventById[n.entity_id] || {}).name || '')
      : (artistName[n.entity_id] || '');
    if (n.entity_type === NOTE_ENTITY_TYPE.EVENT && !eventById[n.entity_id]) return; // אירוע שארוכב

    var u = attentionUrgency_(n.reminder_date, todayIso);
    items.push({
      kind: 'reminder',
      id: n.note_id,
      title: n.content,
      subtitle: context,
      amount: null,
      date: String(n.reminder_date),
      severity: u.severity,
      urgency_text: u.text,
      rank: u.rank,
      entity_type: n.entity_type,
      entity_id: n.entity_id,
      event_id: n.entity_type === NOTE_ENTITY_TYPE.EVENT ? n.entity_id : ''
    });
  });

  // --- חוסרים בהיערכות ---
  addReadinessItems_(d, todayIso, opts, eventById, whoName, items);

  return items.sort(function (a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return String(a.date).localeCompare(String(b.date));
  });
}

/**
 * מוסיף פריטי "חוסר בהיערכות" לאירועים שמתקרבים.
 * @param {Object} whoName - expense_id → שם הספק/האמן, כדי לנסח משימה בציווי
 */
function addReadinessItems_(d, todayIso, opts, eventById, whoName, items) {
  var limit = isoPlusDays_(todayIso, EVENT_READINESS_HORIZON_DAYS);

  var scheduledExpenseIds = {};
  d.payments.forEach(function (p) {
    scheduledExpenseIds[p.expense_id] = true;
  });

  var incomeByEvent = {};
  d.income.forEach(function (i) { incomeByEvent[i.event_id] = true; });

  var byEvent = {};
  d.expenses.forEach(function (ex) {
    var ev = eventById[ex.event_id];
    if (!ev || !ev.event_date) return;
    if (opts.eventId && ex.event_id !== opts.eventId) return;
    if (String(ev.event_date) < todayIso || String(ev.event_date) > limit) return;

    var bucket = byEvent[ex.event_id] || (byEvent[ex.event_id] = { event: ev, unconfirmed: [], unscheduled: [], hasExpenses: false });
    bucket.hasExpenses = true;

    var who = whoName[ex.expense_id];
    var item = { label: who || ex.name, is_person: !!who, expense_id: ex.expense_id };
    if (normalizeManualStatus_(ex.manual_status) === EXPENSE_MANUAL_STATUS.PLANNED) {
      bucket.unconfirmed.push(item);
    } else if (toNumber_(ex.agreed_amount) > 0 && !scheduledExpenseIds[ex.expense_id]) {
      bucket.unscheduled.push(item);
    }
  });

  // אירוע קרוב בלי שום הוצאה — גם זה חוסר, אבל רק אם הוא ממש קרוב
  Object.keys(eventById).forEach(function (id) {
    var ev = eventById[id];
    if (!ev.event_date || byEvent[id]) return;
    if (opts.eventId && id !== opts.eventId) return;
    if (String(ev.event_date) < todayIso || String(ev.event_date) > limit) return;
    byEvent[id] = { event: ev, unconfirmed: [], unscheduled: [], hasExpenses: false };
  });

  Object.keys(byEvent).forEach(function (eventId) {
    var b = byEvent[eventId];
    var ev = b.event;
    var u = attentionUrgency_(String(ev.event_date), todayIso);
    var base = {
      kind: 'readiness',
      amount: null,
      date: String(ev.event_date),
      severity: u.severity === 'later' ? 'soon' : u.severity,
      urgency_text: relativeEventText_(ev.event_date, todayIso),
      rank: 3, // אחרי תשלומים ותזכורות — חשוב, אבל לא בוער כמו מועד שעבר
      event_id: eventId
    };
    var push = function (id, title, extra) {
      items.push(Object.assign({}, base, { id: eventId + ':' + id, title: title, subtitle: ev.name }, extra || {}));
    };

    // עד שלושה בשמם — "לסגור עם אמיר" שווה הרבה יותר מ-"3 הוצאות לא סוכמו".
    // מעבר לזה מקבצים, כדי שהרשימה לא תיהפך לרעש.
    namedOrGrouped_(b.unconfirmed,
      function (x) { return x.is_person ? ('לסגור עם ' + x.label) : ('לסגור את ' + x.label); },
      function (n) { return 'לסגור ' + n + ' הוצאות שעדיין לא סוכמו'; })
      .forEach(function (t, i) { push('unconfirmed-' + i, t.title, { expense_id: t.expense_id }); });

    namedOrGrouped_(b.unscheduled,
      function (x) { return 'לקבוע מועד תשלום ' + (x.is_person ? 'ל' + x.label : 'עבור ' + x.label); },
      function (n) { return 'לקבוע מועדי תשלום ל-' + n + ' עסקאות'; })
      .forEach(function (t, i) { push('unscheduled-' + i, t.title, { expense_id: t.expense_id }); });

    if (!b.hasExpenses) {
      push('no-expenses', 'להתחיל לתכנן — אין עדיין אף הוצאה');
    } else {
      if (toNumber_(ev.average_ticket_price) <= 0) push('no-ticket-price', 'להזין מחיר כרטיס כדי לחשב נקודת איזון');
      if (!incomeByEvent[eventId]) push('no-income', 'להזין את ההכנסות הראשונות');
      var gap = ticketGapForEvent_(ev, d);
      if (gap > 0) push('break-even', 'חסרים ' + formatCount_(gap) + ' כרטיסים לנקודת האיזון');
    }

    // האירוע עצמו, כשהוא ממש מעבר לפינה
    if (base.severity === 'overdue' || base.severity === 'today' ||
        String(ev.event_date) <= isoPlusDays_(todayIso, ATTENTION_HORIZON_DAYS)) {
      push('imminent', base.urgency_text + ' אירוע: ' + ev.name);
    }
  });
}

/**
 * עד שלושה פריטים בשמם; מעבר לזה — שורה מקובצת אחת.
 * "לסגור עם אמיר" שווה הרבה יותר מ-"3 הוצאות לא סוכמו", אבל שבע שורות כאלה הן רעש.
 * @param {function(Object): string} one - ניסוח לפריט בודד
 * @param {function(number): string} many - ניסוח לשורה המקובצת
 * @returns {Array<{title: string, expense_id: (string|undefined)}>}
 */
function namedOrGrouped_(list, one, many) {
  if (!list.length) return [];
  if (list.length <= 3) {
    return list.map(function (x) { return { title: one(x), expense_id: x.expense_id }; });
  }
  return [{ title: many(list.length) }];
}

/** כמה כרטיסים חסרים לנקודת האיזון, או 0 אם אין מה לחשב */
function ticketGapForEvent_(event, d) {
  var pnl = computeEventPnl_(event, d.expenses, d.income);
  return pnl.break_even_remaining > 0 ? pnl.break_even_remaining : 0;
}

function formatCount_(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}


/** "בעוד 8 ימים" / "היום" — לטקסט הדחיפות של פריטי היערכות */
function relativeEventText_(eventDate, todayIso) {
  var d = String(eventDate);
  if (d === todayIso) return 'היום';
  var diff = Math.round((isoToUtc_(d) - isoToUtc_(todayIso)) / 86400000);
  if (isNaN(diff)) return '';
  if (diff === 1) return 'מחר';
  return 'בעוד ' + diff + ' ימים';
}

/** Endpoint ל-"ראה הכל" במסך "דורש טיפול" */
function getAttentionItems() {
  try {
    var today = todayIso_();
    return ok_(buildAttentionItems_(loadFinanceData_(), today));
  } catch (e) {
    return fail_('לא הצלחנו לטעון את רשימת המשימות.', e);
  }
}
