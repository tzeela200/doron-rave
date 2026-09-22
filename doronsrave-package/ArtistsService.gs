/**
 * ArtistsService.gs
 * ניהול אמנים. system_notes הן הערות קבועות ברמת האמן (לא ברמת הוצאה בודדת).
 */

function getArtists() {
  try {
    var artists = listRecords_(CONFIG.SHEETS.ARTISTS, false);
    var expenses = listRecords_(CONFIG.SHEETS.EXPENSES, false);

    var result = artists.map(function (a) {
      var artistExpenses = expenses.filter(function (ex) { return ex.artist_id === a.artist_id; });
      return Object.assign({}, a, {
        events_count: new Set(artistExpenses.map(function (ex) { return ex.event_id; })).size,
        total_amount: artistExpenses.reduce(function (sum, ex) { return sum + toNumber_(ex.agreed_amount); }, 0)
      });
    });
    result.sort(function (a, b) { return a.name.localeCompare(b.name, 'he'); });
    return ok_(result);
  } catch (e) {
    return fail_('לא הצלחנו לטעון את רשימת האמנים.', e);
  }
}

function getArtistExpenseHistory(artistId) {
  try {
    if (!artistId) return fail_('חסר מזהה אמן.');
    var expenses = listRecords_(CONFIG.SHEETS.EXPENSES, false).filter(function (ex) { return ex.artist_id === artistId; });
    var events = listRecords_(CONFIG.SHEETS.EVENTS, false);
    var eventMap = {};
    events.forEach(function (ev) { eventMap[ev.event_id] = ev; });

    var enriched = expenses.map(function (ex) {
      var ev = eventMap[ex.event_id];
      return Object.assign({}, ex, {
        event_name: ev ? ev.name : '',
        event_date: ev ? ev.event_date : ''
      });
    });
    return ok_(enriched);
  } catch (e) {
    return fail_('לא הצלחנו לטעון את היסטוריית האמן.', e);
  }
}

/** יוצר אמן חדש או מעדכן קיים, לפי נוכחות artist_id */
function saveArtist(data) {
  try {
    if (!data || !data.name || !String(data.name).trim()) {
      return fail_('שם האמן הוא שדה חובה.');
    }
    var payload = {
      name: String(data.name).trim(),
      phone: data.phone || '',
      contact_details: data.contact_details || '',
      notes: data.notes || '',
      system_notes: data.system_notes || ''
    };

    if (data.artist_id) {
      var record = updateRecord_(CONFIG.SHEETS.ARTISTS, 'artist_id', data.artist_id, payload);
      return ok_(record);
    }

    var created = insertRecord_(CONFIG.SHEETS.ARTISTS, 'artist_id', payload);
    return ok_(created);
  } catch (e) {
    return fail_('לא הצלחנו לשמור את האמן.', e);
  }
}

function archiveArtist(artistId) {
  try {
    if (!artistId) return fail_('חסר מזהה אמן.');
    var record = archiveRecord_(CONFIG.SHEETS.ARTISTS, 'artist_id', artistId);
    return ok_(record);
  } catch (e) {
    return fail_('לא הצלחנו לארכב את האמן.', e);
  }
}
