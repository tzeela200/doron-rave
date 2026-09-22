/**
 * CategoriesService.gs
 * ניהול קטגוריות ותתי-קטגוריות. שום רשומה אינה נמחקת פיזית — רק Archive.
 * "אמנים" היא קטגוריה ללא תתי-קטגוריות, והלוגיקה שלה (בחירה מתוך Artists) לא משתנה.
 */

/** כל הקטגוריות הפעילות, כל אחת עם subcategories פעילות וממוינות */
function getCategories() {
  try {
    return ok_(categoriesWithSubcategories_(listRecords_(CONFIG.SHEETS.CATEGORIES, false), listSubcategories_(false)));
  } catch (e) {
    return fail_('לא הצלחנו לטעון את הקטגוריות.', e);
  }
}

/** קטגוריות ממוינות, כל אחת עם תתי-הקטגוריות הפעילות שלה ("אמנים" — תמיד רשימה ריקה) */
function categoriesWithSubcategories_(categories, subcategories) {
  var byParent = groupSubcategoriesByCategory_(subcategories.filter(function (s) { return !toBool_(s.is_archived); }));
  return categories.slice()
    .sort(function (a, b) { return toNumber_(a.sort_order) - toNumber_(b.sort_order); })
    .map(function (c) {
      return Object.assign({}, c, { subcategories: isArtistsCategoryName_(c.name) ? [] : (byParent[c.category_id] || []) });
    });
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

    return ok_(findOrCreateCategory_(name));
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

/* ============================================================
   Subcategories
   ============================================================ */

/**
 * יוצר תת-קטגוריה חדשה או מעדכן קיימת.
 * שם ייחודי בתוך אותה קטגוריה בלבד ("שונות" יכולה להופיע תחת כמה הורים).
 */
function saveSubcategory(data) {
  try {
    if (!data || !data.name || !String(data.name).trim()) return fail_('שם תת-הקטגוריה הוא שדה חובה.');
    var name = String(data.name).trim();

    if (data.subcategory_id) {
      var updates = { name: name };
      if (data.sort_order !== undefined) updates.sort_order = data.sort_order;
      if (data.is_visible !== undefined) updates.is_visible = data.is_visible;
      return ok_(updateRecord_(CONFIG.SHEETS.SUBCATEGORIES, 'subcategory_id', data.subcategory_id, updates));
    }

    if (!data.category_id) return fail_('יש לבחור קטגוריה לפני הוספת תת-קטגוריה.');
    var parent = findRowById_(CONFIG.SHEETS.CATEGORIES, 'category_id', data.category_id);
    if (!parent || toBool_(parent.obj.is_archived)) return fail_('הקטגוריה לא נמצאה.');
    if (isArtistsCategoryName_(parent.obj.name)) return fail_('לקטגוריית אמנים אין תתי-קטגוריות.');

    return ok_(findOrCreateSubcategory_(data.category_id, name));
  } catch (e) {
    return fail_('לא הצלחנו לשמור את תת-הקטגוריה.', e);
  }
}

function archiveSubcategory(subcategoryId) {
  try {
    if (!subcategoryId) return fail_('חסר מזהה תת-קטגוריה.');
    ensureSubcategorySchema_();
    return ok_(archiveRecord_(CONFIG.SHEETS.SUBCATEGORIES, 'subcategory_id', subcategoryId));
  } catch (e) {
    return fail_('לא הצלחנו לארכב את תת-הקטגוריה.', e);
  }
}

/**
 * זריעה חד-פעמית של מבנה הקטגוריות שהמשתמשת הגדירה (DEFAULT_SUBCATEGORY_TAXONOMY).
 * אידמפוטנטית: קטגוריה/תת-קטגוריה שכבר קיימת (לפי שם, תחת אותו הורה) לא נוצרת שוב.
 * הרצה: מעורך ה-Apps Script — לבחור seedCategoryTaxonomy וללחוץ Run.
 */
function seedCategoryTaxonomy() {
  ensureSubcategorySchema_();
  var createdCategories = 0, createdSubs = 0;
  DEFAULT_SUBCATEGORY_TAXONOMY.forEach(function (group) {
    var before = listRecords_(CONFIG.SHEETS.CATEGORIES, false).length;
    var category = findOrCreateCategory_(group.category);
    if (listRecords_(CONFIG.SHEETS.CATEGORIES, false).length > before) createdCategories++;

    group.subcategories.forEach(function (subName) {
      var existed = listSubcategories_(false).some(function (s) {
        return s.category_id === category.category_id && String(s.name).trim() === subName;
      });
      findOrCreateSubcategory_(category.category_id, subName);
      if (!existed) createdSubs++;
    });
  });
  var summary = 'נוצרו ' + createdCategories + ' קטגוריות ו-' + createdSubs + ' תתי-קטגוריות.';
  Logger.log(summary);
  return { createdCategories: createdCategories, createdSubcategories: createdSubs, message: summary };
}

/* ============================================================
   Internal helpers
   ============================================================ */

/**
 * רשימת הרכיבים שאפשר לסמן ב-"מה כלול במחיר".
 * נבנית מהנתונים האמיתיים בגיליון (לא מהקבוע), כדי שקטגוריה שהמשתמשת הוסיפה תופיע גם היא.
 * מוחרגת: "אמנים" בלבד. ההוצאה עצמה מוחרגת מהרשימה שלה בצד הלקוח, לפי הקטגוריה שנבחרה בפועל.
 */
function buildCoverageOptions_(categories, subcategories) {
  var activeSubs = (subcategories || []).filter(function (s) { return !toBool_(s.is_archived); });
  var byParent = groupSubcategoriesByCategory_(activeSubs);
  var options = [];

  (categories || []).slice()
    .sort(function (a, b) { return toNumber_(a.sort_order) - toNumber_(b.sort_order); })
    .forEach(function (cat) {
      if (isArtistsCategoryName_(cat.name)) return;
      var children = byParent[cat.category_id] || [];

      if (!children.length) {
        // קטגוריה בלי תתי-קטגוריות — הקטגוריה עצמה היא הרכיב
        options.push({
          key: 'cat:' + cat.category_id,
          category_id: cat.category_id, subcategory_id: '', custom_label: '',
          name: cat.name, parent_name: '',
          is_common: COMMON_COVERAGE_NAMES.indexOf(String(cat.name).trim()) !== -1
        });
        return;
      }

      children.forEach(function (sub) {
        options.push({
          key: 'sub:' + sub.subcategory_id,
          category_id: cat.category_id, subcategory_id: sub.subcategory_id, custom_label: '',
          name: sub.name, parent_name: cat.name,
          is_common: COMMON_COVERAGE_NAMES.indexOf(String(sub.name).trim()) !== -1
        });
      });
    });

  // שכיחים ראשונים, ובתוך כל קבוצה לפי סדר הקטגוריות
  return options.filter(function (o) { return o.is_common; })
    .concat(options.filter(function (o) { return !o.is_common; }));
}

function isArtistsCategoryName_(name) {
  return String(name || '').trim() === DEFAULT_CATEGORY_NAME;
}

function findOrCreateCategory_(name) {
  var existing = listRecords_(CONFIG.SHEETS.CATEGORIES, false);
  var duplicate = existing.filter(function (c) { return String(c.name).trim() === name; })[0];
  if (duplicate) return duplicate; // כבר קיימת — מחזירים אותה במקום ליצור כפילות
  var nextOrder = existing.reduce(function (max, c) { return Math.max(max, toNumber_(c.sort_order)); }, 0) + 1;
  return insertRecord_(CONFIG.SHEETS.CATEGORIES, 'category_id', { name: name, sort_order: nextOrder, is_visible: true });
}

function findOrCreateSubcategory_(categoryId, name) {
  ensureSubcategorySchema_();
  var siblings = listSubcategories_(false).filter(function (s) { return s.category_id === categoryId; });
  var duplicate = siblings.filter(function (s) { return String(s.name).trim() === name; })[0];
  if (duplicate) return duplicate;
  var nextOrder = siblings.reduce(function (max, s) { return Math.max(max, toNumber_(s.sort_order)); }, 0) + 1;
  return insertRecord_(CONFIG.SHEETS.SUBCATEGORIES, 'subcategory_id', {
    category_id: categoryId, name: name, sort_order: nextOrder, is_visible: true
  });
}

/** קריאת תתי-קטגוריות; מחזיר [] אם הטבלה עדיין לא קיימת (לפני הרצת initializeSystem אחרי העדכון) */
function listSubcategories_(includeArchived) {
  var ss = getActiveSpreadsheet_();
  if (!ss.getSheetByName(CONFIG.SHEETS.SUBCATEGORIES)) return [];
  return listRecords_(CONFIG.SHEETS.SUBCATEGORIES, !!includeArchived)
    .sort(function (a, b) { return toNumber_(a.sort_order) - toNumber_(b.sort_order); });
}

function groupSubcategoriesByCategory_(subs) {
  var map = {};
  subs.forEach(function (s) { (map[s.category_id] = map[s.category_id] || []).push(s); });
  return map;
}

/**
 * תאימות לאחור: כל הקוד הקיים קורא ל-ensureSubcategorySchema_.
 * מנגנון השדרוג היחיד הוא ensureEnhancementSchema_ ב-SchemaService.gs (בלי מנגנון מקביל).
 */
function ensureSubcategorySchema_() {
  ensureEnhancementSchema_();
}
