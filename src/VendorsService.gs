/**
 * VendorsService.gs
 * ניהול ספקים.
 */

function getVendors() {
  try {
    var vendors = listRecords_(CONFIG.SHEETS.VENDORS, false);
    var expenses = listRecords_(CONFIG.SHEETS.EXPENSES, false);
    var today = todayIso_();
    var eventById = {};
    listRecords_(CONFIG.SHEETS.EVENTS, false).forEach(function (ev) { eventById[ev.event_id] = ev; });

    var result = vendors.map(function (v) {
      var vendorExpenses = expenses.filter(function (ex) { return ex.vendor_id === v.vendor_id; });
      return Object.assign({}, v, {
        events_count: new Set(vendorExpenses.map(function (ex) { return ex.event_id; })).size,
        total_amount: vendorExpenses.reduce(function (sum, ex) { return sum + toNumber_(ex.agreed_amount); }, 0)
      }, nextEventForExpenses_(vendorExpenses, eventById, today));
    });
    result.sort(function (a, b) { return a.name.localeCompare(b.name, 'he'); });
    return ok_(result);
  } catch (e) {
    return fail_('לא הצלחנו לטעון את רשימת הספקים.', e);
  }
}

/** יוצר ספק חדש או מעדכן קיים, לפי נוכחות vendor_id */
function saveVendor(data) {
  try {
    if (!data || !data.name || !String(data.name).trim()) {
      return fail_('שם הספק הוא שדה חובה.');
    }
    var payload = {
      name: String(data.name).trim(),
      phone: data.phone || '',
      contact_details: data.contact_details || '',
      notes: data.notes || ''
    };

    if (data.vendor_id) {
      var record = updateRecord_(CONFIG.SHEETS.VENDORS, 'vendor_id', data.vendor_id, payload);
      return ok_(record);
    }

    var created = insertRecord_(CONFIG.SHEETS.VENDORS, 'vendor_id', payload);
    return ok_(created);
  } catch (e) {
    return fail_('לא הצלחנו לשמור את הספק.', e);
  }
}

/** ייבוא רשימת ספקים (שם בכל שורה) — ראו importNamedRecords_ ב-ArtistsService.gs */
function importVendors(namesText) {
  try {
    return ok_(importNamedRecords_(CONFIG.SHEETS.VENDORS, 'vendor_id', namesText));
  } catch (e) {
    return fail_('לא הצלחנו לייבא את רשימת הספקים.', e);
  }
}

function archiveVendor(vendorId) {
  try {
    if (!vendorId) return fail_('חסר מזהה ספק.');
    var record = archiveRecord_(CONFIG.SHEETS.VENDORS, 'vendor_id', vendorId);
    return ok_(record);
  } catch (e) {
    return fail_('לא הצלחנו לארכב את הספק.', e);
  }
}
