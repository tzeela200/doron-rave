/**
 * PaymentsService.gs
 * תשלומים ומקדמות (סעיפים 19–24, 53–56 באפיון).
 * כל Payment הוא רשומה עצמאית שקשורה ל-Expense. "שולם" = סכום התשלומים בסטטוס שולם.
 * "באיחור" אינו נשמר — מחושב בזמן טעינה: לא שולם + יש due_date + due_date עבר.
 */

function getPaymentMethods() {
  try {
    return ok_(loadPaymentMethods_());
  } catch (e) {
    return fail_('לא הצלחנו לטעון את אמצעי התשלום.', e);
  }
}

/** כל אמצעי התשלום, כולל מושבתים — למסך הניהול */
function getAllPaymentMethods() {
  try {
    var methods = listRecords_(CONFIG.SHEETS.PAYMENT_METHODS, true)
      .map(function (m) { return Object.assign({}, m, { is_active: toBool_(m.is_active) }); })
      .sort(function (a, b) { return toNumber_(a.sort_order) - toNumber_(b.sort_order); });
    return ok_(methods);
  } catch (e) {
    return fail_('לא הצלחנו לטעון את אמצעי התשלום.', e);
  }
}

/**
 * הוספה/עריכה של אמצעי תשלום (סעיף 24: "ניתן בעתיד להוסיף אפשרויות בלי לשנות את הקוד").
 * אין מחיקה — השבתה (is_active=false) בלבד, כדי לא לשבור תשלומים קיימים.
 */
function savePaymentMethod(data) {
  try {
    if (!data || !data.name || !String(data.name).trim()) return fail_('שם אמצעי התשלום הוא שדה חובה.');
    var name = String(data.name).trim();
    var all = listRecords_(CONFIG.SHEETS.PAYMENT_METHODS, true);

    if (data.payment_method_id) {
      var updates = { name: name };
      if (data.is_active !== undefined) updates.is_active = !!data.is_active;
      if (data.sort_order !== undefined) updates.sort_order = toNumber_(data.sort_order);
      return ok_(updateRecord_(CONFIG.SHEETS.PAYMENT_METHODS, 'payment_method_id', data.payment_method_id, updates));
    }

    var duplicate = all.filter(function (m) { return String(m.name).trim() === name; })[0];
    if (duplicate) {
      if (!toBool_(duplicate.is_active)) {
        return ok_(updateRecord_(CONFIG.SHEETS.PAYMENT_METHODS, 'payment_method_id', duplicate.payment_method_id, { is_active: true }));
      }
      return ok_(duplicate);
    }
    var nextOrder = all.reduce(function (max, m) { return Math.max(max, toNumber_(m.sort_order)); }, 0) + 1;
    return ok_(insertRecord_(CONFIG.SHEETS.PAYMENT_METHODS, 'payment_method_id', { name: name, sort_order: nextOrder, is_active: true }));
  } catch (e) {
    return fail_('לא הצלחנו לשמור את אמצעי התשלום.', e);
  }
}

/** יוצר תשלום חדש או מעדכן קיים, לפי נוכחות payment_id */
function savePayment(data) {
  try {
    if (!data || !data.expense_id) return fail_('חסר מזהה הוצאה.');
    var amount = toNumber_(data.amount);
    if (!(amount > 0)) return fail_('סכום התשלום חייב להיות גדול מ-0.');

    var expense = findRowById_(CONFIG.SHEETS.EXPENSES, 'expense_id', data.expense_id);
    if (!expense || toBool_(expense.obj.is_archived)) return fail_('ההוצאה לא נמצאה.');

    var status = normalizePaymentStatus_(data.payment_status);
    var fields = {
      amount: amount,
      due_date: data.due_date || '',
      payment_method_id: data.payment_method_id || '',
      payment_status: status,
      // תאריך ששולם נשמר רק לתשלום ששולם; ברירת מחדל — היום
      paid_date: status === PAYMENT_STATUS.PAID ? (data.paid_date || todayIso_()) : '',
      note: data.note || ''
    };

    var record = data.payment_id
      ? updateRecord_(CONFIG.SHEETS.PAYMENTS, 'payment_id', data.payment_id, fields)
      : insertRecord_(CONFIG.SHEETS.PAYMENTS, 'payment_id', Object.assign({ expense_id: data.expense_id }, fields));

    return ok_(enrichPayment_(record, todayIso_(), methodNameMap_(loadPaymentMethods_())));
  } catch (e) {
    return fail_('לא הצלחנו לשמור את התשלום.', e);
  }
}

function archivePayment(paymentId) {
  try {
    if (!paymentId) return fail_('חסר מזהה תשלום.');
    return ok_(archiveRecord_(CONFIG.SHEETS.PAYMENTS, 'payment_id', paymentId));
  } catch (e) {
    return fail_('לא הצלחנו למחוק את התשלום.', e);
  }
}

/** תשלומים שלא שולמו ויש להם מועד, באירועים והוצאות פעילים — ממוינים מהקרוב לרחוק (באיחור ראשונים) */
function getUpcomingPayments() {
  try {
    return ok_(buildUpcomingPayments_(loadFinanceData_(), todayIso_()));
  } catch (e) {
    return fail_('לא הצלחנו לטעון את התשלומים הקרובים.', e);
  }
}

/* ============================================================
   Business logic (פנימי)
   ============================================================ */

/** טוען פעם אחת את כל ה-Tabs הפיננסיים הפעילים, כדי לא לקרוא ל-Sheets שוב ושוב */
function loadFinanceData_() {
  return {
    events: listRecords_(CONFIG.SHEETS.EVENTS, false),
    expenses: listRecords_(CONFIG.SHEETS.EXPENSES, false),
    payments: listRecords_(CONFIG.SHEETS.PAYMENTS, false),
    income: listRecords_(CONFIG.SHEETS.INCOME, false),
    categories: listRecords_(CONFIG.SHEETS.CATEGORIES, false),
    // כולל ארכיון — כדי שהוצאה היסטורית תמשיך להציג את שם תת-הקטגוריה שלה
    subcategories: listSubcategories_(true),
    vendors: listRecords_(CONFIG.SHEETS.VENDORS, false),
    artists: listRecords_(CONFIG.SHEETS.ARTISTS, false),
    methods: loadPaymentMethods_()
  };
}

function loadPaymentMethods_() {
  return listRecords_(CONFIG.SHEETS.PAYMENT_METHODS, true)
    .filter(function (m) { return toBool_(m.is_active); })
    .sort(function (a, b) { return toNumber_(a.sort_order) - toNumber_(b.sort_order); });
}

function methodNameMap_(methods) {
  var map = {};
  methods.forEach(function (m) { map[m.payment_method_id] = m.name; });
  return map;
}

/** { expense_id: [payments] } */
function groupPaymentsByExpense_(payments) {
  var map = {};
  payments.forEach(function (p) {
    (map[p.expense_id] = map[p.expense_id] || []).push(p);
  });
  return map;
}

function todayIso_() {
  return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function normalizePaymentStatus_(status) {
  var allowed = [PAYMENT_STATUS.PLANNED, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID];
  return allowed.indexOf(status) !== -1 ? status : PAYMENT_STATUS.PLANNED;
}

function isPaymentPaid_(p) {
  return p.payment_status === PAYMENT_STATUS.PAID;
}

/** תאריכים נשמרים/נקראים כ-'yyyy-MM-dd', ולכן השוואת מחרוזות שקולה להשוואת תאריכים */
function isPaymentOverdue_(p, today) {
  return !isPaymentPaid_(p) && !!p.due_date && String(p.due_date) < today;
}

function enrichPayment_(p, today, methodMap) {
  var overdue = isPaymentOverdue_(p, today);
  return Object.assign({}, p, {
    amount: toNumber_(p.amount),
    is_paid: isPaymentPaid_(p),
    is_overdue: overdue,
    display_status: overdue ? PAYMENT_DISPLAY_OVERDUE : p.payment_status,
    method_name: methodMap[p.payment_method_id] || ''
  });
}

/**
 * סיכום תשלומים של הוצאה (סעיפים 21–22):
 * שולם = סכום תשלומים ששולמו; נותר = agreed - שולם;
 * סטטוס: שולם 0 → הסטטוס הידני; 0 < שולם < סכום → שולם חלקית; שולם >= סכום → שולם.
 */
function summarizeExpensePayments_(expense, payments, today) {
  var agreed = toNumber_(expense.agreed_amount);
  var paid = payments.filter(isPaymentPaid_).reduce(function (s, p) { return s + toNumber_(p.amount); }, 0);

  var status = expense.manual_status || EXPENSE_MANUAL_STATUS.PLANNED;
  if (paid > 0 && paid < agreed) status = EXPENSE_COMPUTED_STATUS.PARTIALLY_PAID;
  else if (paid > 0 && paid >= agreed) status = EXPENSE_COMPUTED_STATUS.PAID;

  var unpaidDue = payments
    .filter(function (p) { return !isPaymentPaid_(p) && p.due_date; })
    .map(function (p) { return String(p.due_date); })
    .sort();

  return {
    paid_amount: paid,
    remaining_amount: agreed - paid,
    computed_status: status,
    next_due_date: unpaidDue[0] || '',
    has_overdue: payments.some(function (p) { return isPaymentOverdue_(p, today); }),
    payments_count: payments.length
  };
}

function buildUpcomingPayments_(d, today) {
  var activeEvents = {};
  d.events.forEach(function (ev) { activeEvents[ev.event_id] = ev; });
  var expenseMap = {};
  d.expenses.forEach(function (ex) { if (activeEvents[ex.event_id]) expenseMap[ex.expense_id] = ex; });

  var vendorMap = {}; d.vendors.forEach(function (v) { vendorMap[v.vendor_id] = v.name; });
  var artistMap = {}; d.artists.forEach(function (a) { artistMap[a.artist_id] = a.name; });
  var methodMap = methodNameMap_(d.methods);

  return d.payments
    .filter(function (p) { return expenseMap[p.expense_id] && !isPaymentPaid_(p) && p.due_date; })
    .map(function (p) {
      var ex = expenseMap[p.expense_id];
      var ev = activeEvents[ex.event_id];
      return Object.assign(enrichPayment_(p, today, methodMap), {
        expense_name: ex.name,
        who_name: (ex.artist_id && artistMap[ex.artist_id]) || (ex.vendor_id && vendorMap[ex.vendor_id]) || '',
        event_id: ev.event_id,
        event_name: ev.name
      });
    })
    .sort(function (a, b) { return String(a.due_date) < String(b.due_date) ? -1 : 1; });
}

/**
 * "מצב פשוט" של טופס ההוצאה (החלטת המשתמשת, 2026-09-14):
 * כשלהוצאה אין תשלומים, או יש תשלום אחד שסכומו שווה לסכום ההוצאה — השדות "מועד תשלום" ו"איך שולם?"
 * בטופס הראשי מנהלים את התשלום היחיד הזה. מרגע שיש פיצול (כמה תשלומים / מקדמה חלקית) — לא נוגעים.
 * @param {Object} expense - רשומת ההוצאה אחרי השמירה
 * @param {Object} sp - { is_paid, due_date, payment_method_id }
 * @param {number=} previousAgreed - סכום ההוצאה לפני העדכון (לזיהוי תשלום "פשוט")
 */
function syncSimplePayment_(expense, sp, previousAgreed) {
  var active = listRecords_(CONFIG.SHEETS.PAYMENTS, false).filter(function (p) { return p.expense_id === expense.expense_id; });
  if (active.length > 1) return;
  var existing = active[0] || null;
  if (existing && previousAgreed !== undefined && toNumber_(existing.amount) !== toNumber_(previousAgreed)) return;

  var agreed = toNumber_(expense.agreed_amount);
  var wantsPaid = !!sp.is_paid;
  var hasInfo = wantsPaid || !!sp.due_date || !!sp.payment_method_id;

  if (!hasInfo || agreed <= 0) {
    if (existing) archiveRecord_(CONFIG.SHEETS.PAYMENTS, 'payment_id', existing.payment_id);
    return;
  }

  var fields = {
    amount: agreed,
    due_date: sp.due_date || '',
    payment_method_id: sp.payment_method_id || '',
    payment_status: wantsPaid
      ? PAYMENT_STATUS.PAID
      : (expense.manual_status === EXPENSE_MANUAL_STATUS.AGREED ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.PLANNED),
    paid_date: wantsPaid ? ((existing && existing.paid_date) || todayIso_()) : ''
  };

  if (existing) {
    updateRecord_(CONFIG.SHEETS.PAYMENTS, 'payment_id', existing.payment_id, fields);
  } else {
    insertRecord_(CONFIG.SHEETS.PAYMENTS, 'payment_id', Object.assign({ expense_id: expense.expense_id, note: '' }, fields));
  }
}
