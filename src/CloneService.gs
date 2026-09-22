/**
 * CloneService.gs
 * יצירת אירוע מאירוע קודם (סעיפים 32–39).
 * כלל קריטי: שכפול לעולם לא משנה את המקור. Event/Expense/Payment חדשים מקבלים UUID חדש;
 * ספקים ואמנים לא משוכפלים — משתמשים ב-vendor_id / artist_id הקיימים.
 */

var CLONE_MODE = { STRUCTURE: 'structure', ALL: 'all' };

/**
 * @param {Object} config
 *   source_event_id, mode ('structure' | 'all'), expense_ids [..],
 *   name, event_date, location, general_notes
 */
function cloneEvent(config) {
  try {
    if (!config || !config.source_event_id) return fail_('יש לבחור אירוע מקור.');
    if (!config.name || !String(config.name).trim()) return fail_('שם האירוע הוא שדה חובה.');
    if (!config.event_date) return fail_('תאריך האירוע הוא שדה חובה.');
    var mode = config.mode === CLONE_MODE.ALL ? CLONE_MODE.ALL : CLONE_MODE.STRUCTURE;

    var source = findRowById_(CONFIG.SHEETS.EVENTS, 'event_id', config.source_event_id);
    if (!source) return fail_('אירוע המקור לא נמצא.');

    var selected = {};
    (config.expense_ids || []).forEach(function (id) { selected[id] = true; });

    var sourceExpenses = listRecords_(CONFIG.SHEETS.EXPENSES, false)
      .filter(function (ex) { return ex.event_id === config.source_event_id && selected[ex.expense_id]; });
    var paymentsByExpense = mode === CLONE_MODE.ALL
      ? groupPaymentsByExpense_(listRecords_(CONFIG.SHEETS.PAYMENTS, false))
      : {};

    // "מה כלול" מועתק רק ב"הכל כבסיס" — הוא חלק מהעסקה, כמו שעות ההופעה (החלטה נעולה 31)
    var coverageByExpense = {};
    if (mode === CLONE_MODE.ALL) {
      listCoverageRows_(false).forEach(function (row) {
        (coverageByExpense[row.expense_id] = coverageByExpense[row.expense_id] || []).push(row);
      });
    }

    // מועדי תשלום זזים יחד עם תאריך האירוע (אחרת כל התשלומים המשוכפלים ייראו "באיחור")
    var offsetDays = daysBetweenIso_(source.obj.event_date, config.event_date);

    var newEvent = insertRecord_(CONFIG.SHEETS.EVENTS, 'event_id', Object.assign({
      name: String(config.name).trim(),
      event_date: config.event_date,
      location: config.location || '',
      general_notes: config.general_notes || ''
    }, ticketForecastFields_(config)));

    var copiedExpenses = 0, copiedPayments = 0;
    sourceExpenses.forEach(function (ex) {
      var fields = {
        event_id: newEvent.event_id,
        name: ex.name,
        category_id: ex.category_id,
        subcategory_id: ex.subcategory_id || '',
        vendor_id: ex.vendor_id || '',
        artist_id: ex.artist_id || '',
        paid_by: '',
        expense_date: ''
      };
      if (mode === CLONE_MODE.ALL) {
        fields.planned_amount = toNumber_(ex.planned_amount);
        fields.agreed_amount = toNumber_(ex.agreed_amount);
        fields.manual_status = normalizeManualStatus_(ex.manual_status);
        fields.internal_notes = ex.internal_notes || '';
        // שעות הופעה מועתקות רק ב"הכל כבסיס". ב"מבנה בלבד" הלו"ז נקבע מחדש באירוע החדש.
        fields.performance_start_time = ex.performance_start_time || '';
        fields.performance_end_time = ex.performance_end_time || '';
      } else {
        fields.planned_amount = 0;
        fields.agreed_amount = 0;
        fields.manual_status = EXPENSE_MANUAL_STATUS.PLANNED;
        fields.internal_notes = '';
        fields.performance_start_time = '';
        fields.performance_end_time = '';
      }
      var newExpense = insertRecord_(CONFIG.SHEETS.EXPENSES, 'expense_id', fields);
      copiedExpenses++;

      var sourceCoverage = coverageByExpense[ex.expense_id] || [];
      if (sourceCoverage.length) {
        resolveCoverage_(newExpense.expense_id, sourceCoverage.map(function (c) {
          return { category_id: c.category_id, subcategory_id: c.subcategory_id, custom_label: c.custom_label };
        }));
      }

      if (mode === CLONE_MODE.ALL) {
        (paymentsByExpense[ex.expense_id] || []).forEach(function (p) {
          insertRecord_(CONFIG.SHEETS.PAYMENTS, 'payment_id', {
            expense_id: newExpense.expense_id,
            amount: toNumber_(p.amount),
            due_date: p.due_date && offsetDays !== null ? shiftIsoDate_(p.due_date, offsetDays) : '',
            payment_method_id: p.payment_method_id || '',
            // אין להעתיק תשלום כ"שולם" ואין להעתיק paid_date (סעיף 36)
            payment_status: p.payment_status === PAYMENT_STATUS.PAID ? PAYMENT_STATUS.PLANNED : normalizePaymentStatus_(p.payment_status),
            paid_date: '',
            note: p.note || ''
          });
          copiedPayments++;
        });
      }
    });

    return ok_({ event: newEvent, copied_expenses: copiedExpenses, copied_payments: copiedPayments });
  } catch (e) {
    return fail_('לא הצלחנו ליצור את האירוע מהאירוע הקודם.', e);
  }
}

function isoToUtc_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function daysBetweenIso_(fromIso, toIso) {
  var a = isoToUtc_(fromIso), b = isoToUtc_(toIso);
  return (a === null || b === null) ? null : Math.round((b - a) / 86400000);
}

function shiftIsoDate_(iso, days) {
  var t = isoToUtc_(iso);
  return t === null ? '' : new Date(t + days * 86400000).toISOString().slice(0, 10);
}
