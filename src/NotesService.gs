/**
 * NotesService.gs
 * הערות ותזכורות מתוארכות, לאירוע או לאמן.
 * פשוט בכוונה: אין Push, אין מייל, אין Cron ואין מערכת משימות.
 * מחיקה = Archive בלבד.
 */

/** הערות פעילות של ישות אחת, מהחדשה לישנה */
function getEntityNotes(entityType, entityId) {
  try {
    var validation = validateNoteEntity_(entityType, entityId);
    if (validation) return fail_(validation);
    ensureEnhancementSchema_();
    return ok_(listEntityNotes_(entityType, entityId));
  } catch (e) {
    return fail_('לא הצלחנו לטעון את ההערות.', e);
  }
}

/** יוצר הערה/תזכורת חדשה או מעדכן קיימת (לפי note_id) */
function saveEntityNote(data) {
  try {
    if (!data) return fail_('חסרים נתוני הערה.');
    if (!data.content || !String(data.content).trim()) return fail_('תוכן ההערה הוא שדה חובה.');
    ensureEnhancementSchema_();

    var noteType = data.note_type === NOTE_TYPE.REMINDER ? NOTE_TYPE.REMINDER : NOTE_TYPE.NOTE;
    var fields = {
      note_type: noteType,
      content: String(data.content).trim(),
      reminder_date: noteType === NOTE_TYPE.REMINDER ? (data.reminder_date || '') : ''
    };

    if (data.note_id) {
      if (data.is_completed !== undefined) fields.is_completed = !!data.is_completed;
      return ok_(enrichNote_(updateRecord_(CONFIG.SHEETS.NOTES, 'note_id', data.note_id, fields)));
    }

    var validation = validateNoteEntity_(data.entity_type, data.entity_id);
    if (validation) return fail_(validation);
    fields.entity_type = data.entity_type;
    fields.entity_id = data.entity_id;
    fields.is_completed = false;
    return ok_(enrichNote_(insertRecord_(CONFIG.SHEETS.NOTES, 'note_id', fields)));
  } catch (e) {
    return fail_('לא הצלחנו לשמור את ההערה.', e);
  }
}

/** סימון תזכורת כהושלמה, או פתיחה מחדש */
function toggleNoteCompleted(noteId, completed) {
  try {
    if (!noteId) return fail_('חסר מזהה הערה.');
    ensureEnhancementSchema_();
    return ok_(enrichNote_(updateRecord_(CONFIG.SHEETS.NOTES, 'note_id', noteId, { is_completed: !!completed })));
  } catch (e) {
    return fail_('לא הצלחנו לעדכן את התזכורת.', e);
  }
}

function archiveEntityNote(noteId) {
  try {
    if (!noteId) return fail_('חסר מזהה הערה.');
    ensureEnhancementSchema_();
    return ok_(archiveRecord_(CONFIG.SHEETS.NOTES, 'note_id', noteId));
  } catch (e) {
    return fail_('לא הצלחנו למחוק את ההערה.', e);
  }
}

/* ============================================================
   Internal
   ============================================================ */

function validateNoteEntity_(entityType, entityId) {
  var allowed = [NOTE_ENTITY_TYPE.EVENT, NOTE_ENTITY_TYPE.ARTIST];
  if (allowed.indexOf(entityType) === -1) return 'סוג הישות להערה אינו נתמך.';
  if (!entityId) return 'חסר מזהה לישות של ההערה.';
  return null;
}

/** קריאה ישירה (בלי מעטפת ok_) — לשימוש פנימי, למשל מתוך getEventDetails */
function listEntityNotes_(entityType, entityId) {
  var ss = getActiveSpreadsheet_();
  if (!ss.getSheetByName(CONFIG.SHEETS.NOTES)) return [];
  return listRecords_(CONFIG.SHEETS.NOTES, false)
    .filter(function (n) { return n.entity_type === entityType && n.entity_id === entityId; })
    .map(enrichNote_)
    .sort(function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); });
}

function enrichNote_(note) {
  return Object.assign({}, note, {
    is_completed: toBool_(note.is_completed),
    reminder_date: note.reminder_date || '',
    note_type: note.note_type === NOTE_TYPE.REMINDER ? NOTE_TYPE.REMINDER : NOTE_TYPE.NOTE
  });
}
