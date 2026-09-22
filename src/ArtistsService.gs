/**
 * ArtistsService.gs
 * ניהול אמנים. system_notes הן הערות קבועות ברמת האמן (לא ברמת הוצאה בודדת).
 */

function getArtists() {
  try {
    var artists = listRecords_(CONFIG.SHEETS.ARTISTS, false);
    var expenses = listRecords_(CONFIG.SHEETS.EXPENSES, false);
    var today = todayIso_();
    var eventById = {};
    listRecords_(CONFIG.SHEETS.EVENTS, false).forEach(function (ev) { eventById[ev.event_id] = ev; });

    var result = artists.map(function (a) {
      var artistExpenses = expenses.filter(function (ex) { return ex.artist_id === a.artist_id; });
      return Object.assign({}, a, {
        real_name: a.real_name || '',
        stage_name: a.stage_name || '',
        display_name: artistDisplayName_(a),
        events_count: new Set(artistExpenses.map(function (ex) { return ex.event_id; })).size,
        total_amount: artistExpenses.reduce(function (sum, ex) { return sum + toNumber_(ex.agreed_amount); }, 0)
      }, nextEventForExpenses_(artistExpenses, eventById, today));
    });
    result.sort(function (a, b) { return String(a.display_name).localeCompare(String(b.display_name), 'he'); });
    return ok_(result);
  } catch (e) {
    return fail_('לא הצלחנו לטעון את רשימת האמנים.', e);
  }
}

/** שם התצוגה של אמן: שם במה, ואם אין — השם הקיים, ואם אין — השם האמיתי */
function artistDisplayName_(artist) {
  if (!artist) return '';
  return String(artist.stage_name || artist.name || artist.real_name || '').trim();
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
      var duration = calculatePerformanceDuration_(ex.performance_start_time, ex.performance_end_time);
      return Object.assign({}, ex, {
        event_name: ev ? ev.name : '',
        event_date: ev ? ev.event_date : '',
        performance_start_time: ex.performance_start_time || '',
        performance_end_time: ex.performance_end_time || '',
        performance_duration_minutes: duration ? duration.minutes : null,
        performance_duration_text: duration ? duration.text : ''
      });
    });
    enriched.sort(function (a, b) { return String(b.event_date).localeCompare(String(a.event_date)); });
    return ok_(enriched);
  } catch (e) {
    return fail_('לא הצלחנו לטעון את היסטוריית האמן.', e);
  }
}

/** יוצר אמן חדש או מעדכן קיים, לפי נוכחות artist_id */
function saveArtist(data) {
  try {
    if (!data) return fail_('חסרים נתוני אמן.');
    ensureEnhancementSchema_();
    var stageName = String(data.stage_name || '').trim();
    var realName = String(data.real_name || '').trim();
    // name נשאר לתאימות לאחור: אם לא נשלח, נגזר משם הבמה/השם האמיתי. רשומות קיימות לא משתנות מעצמן.
    var name = String(data.name || '').trim() || stageName || realName;
    if (!name) return fail_('צריך למלא שם במה או שם אמיתי.');

    var payload = {
      name: name,
      phone: data.phone || '',
      contact_details: data.contact_details || '',
      notes: data.notes || '',
      system_notes: data.system_notes || '',
      real_name: realName,
      stage_name: stageName
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

/** ייבוא רשימת שמות (שם בכל שורה) — כל אמן מקבל UUID; שמות קיימים מדולגים */
function importArtists(namesText) {
  try {
    return ok_(importNamedRecords_(CONFIG.SHEETS.ARTISTS, 'artist_id', namesText));
  } catch (e) {
    return fail_('לא הצלחנו לייבא את רשימת האמנים.', e);
  }
}

/**
 * ייבוא גנרי של רשימת שמות לטבלת אנשי קשר (Artists / Vendors).
 * מנקה רווחים ושורות ריקות, ומדלג על כפילויות — גם מול הקיים וגם בתוך הרשימה עצמה (ללא תלות באותיות גדולות/קטנות).
 */
function importNamedRecords_(sheetName, idColumnName, namesText) {
  var lines = Array.isArray(namesText) ? namesText : String(namesText || '').split(/\r?\n/);
  var existing = {};
  listRecords_(sheetName, false).forEach(function (r) { existing[String(r.name).trim().toLowerCase()] = true; });

  var created = [], skipped = [];
  lines.forEach(function (raw) {
    var name = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!name) return;
    var key = name.toLowerCase();
    if (existing[key]) { skipped.push(name); return; }
    insertRecord_(sheetName, idColumnName, { name: name, phone: '', contact_details: '', notes: '' });
    existing[key] = true;
    created.push(name);
  });
  return { created: created, skipped: skipped };
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
