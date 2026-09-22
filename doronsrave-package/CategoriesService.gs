/**
 * CategoriesService.gs
 * ניהול קטגוריות. קטגוריה אינה נמחקת פיזית לעולם — רק Archive.
 */

function getCategories() {
  try {
    var categories = listRecords_(CONFIG.SHEETS.CATEGORIES, false);
    categories.sort(function (a, b) { return toNumber_(a.sort_order) - toNumber_(b.sort_order); });
    return ok_(categories);
  } catch (e) {
    return fail_('לא הצלחנו לטעון את הקטגוריות.', e);
  }
}

/**
 * יוצר קטגוריה חדשה או מעדכן קיימת, לפי נוכחות category_id ב-data.
 */
function saveCategory(data) {
  try {
    if (!data || !data.name || !String(data.name).trim()) {
      return fail_('שם הקטגוריה הוא שדה חובה.');
    }
    var name = String(data.name).trim();

    if (data.category_id) {
      var updates = { name: name };
      if (data.sort_order !== undefined) updates.sort_order = data.sort_order;
      if (data.is_visible !== undefined) updates.is_visible = data.is_visible;
      var record = updateRecord_(CONFIG.SHEETS.CATEGORIES, 'category_id', data.category_id, updates);
      return ok_(record);
    }

    // בדיקת כפילות שם בקטגוריות פעילות
    var existing = listRecords_(CONFIG.SHEETS.CATEGORIES, false);
    var duplicate = existing.filter(function (c) { return c.name === name; });
    if (duplicate.length > 0) {
      return ok_(duplicate[0]); // כבר קיימת — מחזירים אותה במקום ליצור כפילות
    }

    var nextOrder = existing.reduce(function (max, c) { return Math.max(max, toNumber_(c.sort_order)); }, 0) + 1;
    var created = insertRecord_(CONFIG.SHEETS.CATEGORIES, 'category_id', {
      name: name,
      sort_order: nextOrder,
      is_visible: true
    });
    return ok_(created);
  } catch (e) {
    return fail_('לא הצלחנו לשמור את הקטגוריה.', e);
  }
}

function archiveCategory(categoryId) {
  try {
    if (!categoryId) return fail_('חסר מזהה קטגוריה.');
    var record = archiveRecord_(CONFIG.SHEETS.CATEGORIES, 'category_id', categoryId);
    return ok_(record);
  } catch (e) {
    return fail_('לא הצלחנו לארכב את הקטגוריה.', e);
  }
}
