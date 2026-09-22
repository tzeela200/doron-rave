/**
 * Config.gs
 * קבועים גלובליים של המערכת: שמות Tabs, כותרות עמודות, ברירות מחדל, מפתחות Script Properties.
 * אין לשמור כאן מזהים דינמיים (כמו Spreadsheet ID) — אלה נשמרים ב-Script Properties בלבד.
 */

var CONFIG = {
  LOCALE: 'he_IL',
  TIMEZONE: 'Asia/Jerusalem',
  CURRENCY_SYMBOL: '₪',

  // מפתח לשמירת Spreadsheet ID ב-Script Properties
  PROP_SPREADSHEET_ID: 'DORONS_RAVE_SPREADSHEET_ID',

  // גרסת סכימה — כדי שבדיקת השדרוג תרוץ פעם אחת ולא בכל בקשה (ראו SchemaService.gs)
  PROP_SCHEMA_VERSION: 'DORONS_RAVE_SCHEMA_VERSION',

  SHEETS: {
    EVENTS: 'Events',
    EXPENSES: 'Expenses',
    CATEGORIES: 'Categories',
    SUBCATEGORIES: 'Subcategories',
    VENDORS: 'Vendors',
    ARTISTS: 'Artists',
    PAYMENTS: 'Payments',
    INCOME: 'Income',
    PAYMENT_METHODS: 'PaymentMethods',
    ATTACHMENTS: 'Attachments',
    NOTES: 'Notes',
    EXPENSE_COVERAGE: 'ExpenseCoverage'
  }
};

// כותרות עמודות לכל Tab — הסדר קובע את סדר העמודות ב-Sheet.
// ⚠ כלל קבוע: עמודה חדשה לטבלה קיימת מתווספת תמיד **בסוף** המערך.
//   ensureSheetWithHeaders_ דורס את שורת הכותרות לפי מיקום, ו-objectToRow_ כותב שורה לפי הסדר הזה —
//   הוספה באמצע תזיז נתונים קיימים לעמודות הלא נכונות.
var SHEET_HEADERS = {
  Events: ['event_id', 'name', 'event_date', 'location', 'general_notes', 'is_archived', 'created_at', 'updated_at',
           // נוסף 2026-09 (תחזית כרטיסים, אופציונלי) — בסוף בכוונה
           'average_ticket_price', 'expected_ticket_count',
           // מפתחות הצרכים שסומנו "לא צריך" לאירוע הזה, מופרדים בפסיק. ריק = הכול נדרש.
           // שומרים רק חריגים, ולכן אין צורך ב-Tab נפרד.
           'skipped_requirements',
           // 2026-09-20: מה שהמשתמשת סימנה שהאירוע צריך, כמפתחות sub:<id>/cat:<id>
           // מופרדים בפסיק. ריק = לא הוגדר, ואז לא מוצג אחוז מוכנות.
           // ⚠ בסוף הרשימה בכוונה — ensureSheetWithHeaders_ כותב לפי מיקום.
           'required_items',
           // 2026-09-20: סבבי תמחור לכרטיסים, כ-JSON: [{name, quantity, price}]
           // ריק = מחיר אחד לפי average_ticket_price. ⚠ בסוף הרשימה בכוונה.
           'ticket_tiers'],

  Categories: ['category_id', 'name', 'sort_order', 'is_visible', 'is_archived', 'created_at', 'updated_at'],

  // טבלת מילון: תת-קטגוריה שייכת לקטגוריה-אב דרך category_id. "אמנים" לעולם ללא תתי-קטגוריות.
  Subcategories: ['subcategory_id', 'category_id', 'name', 'sort_order', 'is_visible', 'is_archived', 'created_at', 'updated_at'],

  Vendors: ['vendor_id', 'name', 'phone', 'contact_details', 'notes', 'is_archived', 'created_at', 'updated_at'],

  // name נשאר לתאימות לאחור ולא עובר migration. שם התצוגה: stage_name || name || real_name
  Artists: ['artist_id', 'name', 'phone', 'contact_details', 'notes', 'system_notes', 'is_archived', 'created_at', 'updated_at',
            'real_name', 'stage_name'],

  Expenses: ['expense_id', 'event_id', 'name', 'category_id', 'planned_amount', 'agreed_amount', 'vendor_id',
             'artist_id', 'paid_by', 'manual_status', 'expense_date', 'internal_notes', 'is_archived', 'created_at', 'updated_at',
             'subcategory_id', // נוסף 2026-09 — בסוף בכוונה (ראו הכלל למעלה). ריק = ללא תת-קטגוריה; תמיד ריק באמנים.
             // שעות הופעה (HH:mm) — רק להוצאות בקטגוריית "אמנים"
             'performance_start_time', 'performance_end_time'],

  Payments: ['payment_id', 'expense_id', 'amount', 'due_date', 'paid_date', 'payment_method_id',
             'payment_status', 'note', 'is_archived', 'created_at', 'updated_at'],

  Income: ['income_id', 'event_id', 'name', 'quantity', 'unit_price', 'total_amount', 'notes',
           'is_archived', 'created_at', 'updated_at',
           // רשומה ישנה בלי ערך נחשבת false
           'is_ticket_income'],

  // הערות ותזכורות מתוארכות לאירוע או לאמן
  Notes: ['note_id', 'entity_type', 'entity_id', 'note_type', 'content', 'reminder_date',
          'is_completed', 'is_archived', 'created_at', 'updated_at'],

  // מה כלול במחיר של הוצאה אחת (בעיקר השכרת שטח). מידע תפעולי בלבד — לעולם לא נספר כספית.
  // Tab חדש לגמרי: לא נוספה שום עמודה לטבלה קיימת.
  ExpenseCoverage: ['coverage_id', 'expense_id', 'category_id', 'subcategory_id', 'custom_label',
                    'is_archived', 'created_at', 'updated_at'],

  PaymentMethods: ['payment_method_id', 'name', 'sort_order', 'is_active', 'created_at', 'updated_at'],

  Attachments: ['attachment_id', 'entity_type', 'entity_id', 'drive_file_id', 'drive_url', 'file_name',
                'mime_type', 'is_archived', 'created_at']
};

// סוגי עמודות לצורך פורמט ב-Sheet. כל עמודה שלא מופיעה כאן נשמרת כטקסט רגיל ('@') —
// כדי ש-Sheets לא ימיר בעצמו ערכים (למשל טלפון 050... שמאבד את ה-0, או מחרוזת שהופכת לתאריך).
var DATE_COLUMNS = ['event_date', 'expense_date', 'due_date', 'paid_date', 'reminder_date'];
var NUMBER_COLUMNS = ['planned_amount', 'agreed_amount', 'amount', 'quantity', 'unit_price', 'total_amount', 'sort_order',
                      'average_ticket_price', 'expected_ticket_count'];
var BOOLEAN_COLUMNS = ['is_archived', 'is_visible', 'is_active', 'is_completed', 'is_ticket_income'];
var DATE_NUMBER_FORMAT = 'dd.MM.yyyy';
var AMOUNT_NUMBER_FORMAT = '#,##0.##';

// ערכי ברירת מחדל שנוצרים פעם אחת בהתקנה הראשונית (initializeSystem) בלבד — לא Demo Data עסקי.
var DEFAULT_CATEGORY_NAME = 'אמנים';

var DEFAULT_PAYMENT_METHODS = ['מזומן', 'Bit', 'העברה בנקאית', 'PayBox', 'אשראי', 'אחר'];

/**
 * מבנה קטגוריות ותתי-קטגוריות שהמשתמשת הגדירה (2026-09-14).
 * נזרע רק דרך seedCategoryTaxonomy() שמורצת ידנית פעם אחת — לא ב-initializeSystem (סעיף 11: התקנה נקייה = "אמנים" בלבד).
 * "אמנים" לא מופיעה כאן בכוונה — היא נשארת ללא תתי-קטגוריות.
 */
var DEFAULT_SUBCATEGORY_TAXONOMY = [
  { category: 'מזון ומשקה', subcategories: ['אלכוהול', 'שתיה קלה', 'כיבודי אוכל', 'פירות', 'שונות'] },
  { category: 'בטיחות ורגולציה', subcategories: ['עורך דין', 'קנסות משטרה', 'קנסות פיקוח', 'הוצאות משפטיות', 'אמבולנס/פרמדיק', 'אבטחה', 'אגרות', 'שונות'] },
  { category: 'כרטוס ושיווק', subcategories: ['חברת הפקות כרטיסים', "צ'קריות", 'עמלות ביט כרטיסים', 'צלם', 'פרסום', 'צוות הקמה/פירוק', 'שונות'] },
  { category: 'ציוד טכני', subcategories: ['ציליה', 'הגברה', 'תאורה', 'קישוטי רחבה', 'גנרטור', 'שונות'] },
  { category: 'תשתית ומיקום', subcategories: ['השכרת שטח', 'גדרות', 'אוהלים', 'שילוט', 'הסעות', 'שירותים כימיים', 'פחי אשפה', 'ניקיון', 'אחר'] },
  { category: 'בלתי צפוי', subcategories: ['רזרבה כללית לתקלות'] }
];

var NO_SUBCATEGORY_LABEL = 'ללא תת-קטגוריה';

/** הוצאה בלי ספק — כדי שהחלוקה לפי ספק תסתכם לסה"כ ולא תסתיר שקלים */
var NO_VENDOR_LABEL = 'ללא ספק';

// סטטוסים אפשריים (לשימוש עקבי בין Frontend ל-Backend)
var EXPENSE_MANUAL_STATUS = { PLANNED: 'מתוכנן', AGREED: 'סוכם' };
var EXPENSE_COMPUTED_STATUS = { PARTIALLY_PAID: 'שולם חלקית', PAID: 'שולם' };
var PAYMENT_STATUS = { PLANNED: 'מתוכנן', PENDING: 'ממתין לתשלום', PAID: 'שולם' };
var PAYMENT_DISPLAY_OVERDUE = 'באיחור'; // סטטוס תצוגה בלבד — לא נשמר ב-Sheet

// ===== הערות ותזכורות =====
var NOTE_ENTITY_TYPE = { EVENT: 'event', ARTIST: 'artist' };
var NOTE_TYPE = { NOTE: 'note', REMINDER: 'reminder' };

// ===== "מה כלול במחיר" =====
// המתג "האם המחיר כולל שירותים או ציוד נוספים?" מוצג ב**כל** הוצאה, ברירת מחדל "לא".
// (עד 2026-09-16 הוא היה מותנה בשם תת-הקטגוריה "השכרת שטח" — ולכן לא הופיע למי
//  שקראה למקום "שכירות מקום". התניית התנהגות על טקסט חופשי היא באג במתכונת.)

// רכיבים שכיחים שמוצגים ראשונים ברשימת הבחירה. שאר הרכיבים מאחורי "הצג הכל".
// אלה רק שמות לסימון is_common — הרשימה עצמה נבנית מהנתונים האמיתיים בגיליון.
var COMMON_COVERAGE_NAMES = ['הגברה', 'תאורה', 'אלכוהול', 'ציליה', 'גנרטור', 'שירותים כימיים', 'אבטחה', 'ניקיון'];

// טווח הימים שבו תזכורת או תשלום נחשבים "דורש טיפול"
var ATTENTION_HORIZON_DAYS = 7;

/**
 * שלבי ההפקה שכל אירוע נבדק מולם.
 * קבוע בקוד בכוונה — זו רשימה יציבה שלא משתנה בין אירועים, ולא הצדיקה ישות חדשה.
 * `match` הם השמות בטקסונומיה שסוגרים את הרכיב; רכיב בלי התאמה נסגר לפי `key` בלבד.
 *
 * שלושת המצבים נגזרים: מכוסה (יש הוצאה שסוכמה או כיסוי) / בתהליך (יש הוצאה מתוכננת) / חסר.
 * "לא צריך" הוא היחיד שנשמר, ב-Events.skipped_requirements.
 */
/**
 * ⛔ לא בשימוש מאז 2026-09-20. נשמר לתיעוד בלבד.
 *
 * זו הייתה רשימה של 11 שלבי הפקה ש-Claude המציא, והמשתמשת מעולם לא בחרה.
 * "36% מוכן" חושב ממנה. היא הוחלפה בבחירה של המשתמשת מתוך הקטגוריות שלה
 * (`Events.required_items`). אין להחזיר אותה לשימוש.
 */
var EVENT_REQUIREMENTS_LEGACY_ = [
  { key: 'venue',     label: 'מקום',    match: ['השכרת שטח', 'שכירות מקום', 'השכרת מקום', 'מקום'] },
  { key: 'artists',   label: 'אמנים',   match: ['אמנים'] },
  { key: 'sound',     label: 'הגברה',   match: ['הגברה'] },
  { key: 'lighting',  label: 'תאורה',   match: ['תאורה'] },
  { key: 'security',  label: 'אבטחה',   match: ['אבטחה'] },
  { key: 'medic',     label: 'פרמדיק',  match: ['אמבולנס/פרמדיק', 'אמבולנס', 'פרמדיק'] },
  { key: 'bar',       label: 'בר',      match: ['אלכוהול', 'בר', 'שתיה קלה'] },
  { key: 'power',     label: 'חשמל',    match: ['גנרטור', 'חשמל'] },
  { key: 'toilets',   label: 'שירותים', match: ['שירותים כימיים', 'שירותים'] },
  { key: 'cleaning',  label: 'ניקיון',  match: ['ניקיון'] },
  { key: 'ticketing', label: 'כרטוס',   match: ['חברת הפקות כרטיסים', 'כרטוס ושיווק'] }
];

// טווח שבו אירוע נחשב "מתקרב", ולכן חוסרים בהיערכות שלו הופכים לפריט טיפול.
// ארוך יותר מהטווח של התשלומים: על עסקה שלא נסגרה צריך לדעת הרבה לפני מועד התשלום.
var EVENT_READINESS_HORIZON_DAYS = 30;
