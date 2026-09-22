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

  SHEETS: {
    EVENTS: 'Events',
    EXPENSES: 'Expenses',
    CATEGORIES: 'Categories',
    VENDORS: 'Vendors',
    ARTISTS: 'Artists',
    PAYMENTS: 'Payments',
    INCOME: 'Income',
    PAYMENT_METHODS: 'PaymentMethods',
    ATTACHMENTS: 'Attachments'
  }
};

// כותרות עמודות לכל Tab — הסדר קובע את סדר העמודות ב-Sheet בעת היצירה הראשונית.
var SHEET_HEADERS = {
  Events: ['event_id', 'name', 'event_date', 'location', 'general_notes', 'is_archived', 'created_at', 'updated_at'],

  Categories: ['category_id', 'name', 'sort_order', 'is_visible', 'is_archived', 'created_at', 'updated_at'],

  Vendors: ['vendor_id', 'name', 'phone', 'contact_details', 'notes', 'is_archived', 'created_at', 'updated_at'],

  Artists: ['artist_id', 'name', 'phone', 'contact_details', 'notes', 'system_notes', 'is_archived', 'created_at', 'updated_at'],

  Expenses: ['expense_id', 'event_id', 'name', 'category_id', 'planned_amount', 'agreed_amount', 'vendor_id',
             'artist_id', 'paid_by', 'manual_status', 'expense_date', 'internal_notes', 'is_archived', 'created_at', 'updated_at'],

  Payments: ['payment_id', 'expense_id', 'amount', 'due_date', 'paid_date', 'payment_method_id',
             'payment_status', 'note', 'is_archived', 'created_at', 'updated_at'],

  Income: ['income_id', 'event_id', 'name', 'quantity', 'unit_price', 'total_amount', 'notes',
           'is_archived', 'created_at', 'updated_at'],

  PaymentMethods: ['payment_method_id', 'name', 'sort_order', 'is_active', 'created_at', 'updated_at'],

  Attachments: ['attachment_id', 'entity_type', 'entity_id', 'drive_file_id', 'drive_url', 'file_name',
                'mime_type', 'is_archived', 'created_at']
};

// ערכי ברירת מחדל שנוצרים פעם אחת בהתקנה הראשונית (initializeSystem) בלבד — לא Demo Data עסקי.
var DEFAULT_CATEGORY_NAME = 'אמנים';

var DEFAULT_PAYMENT_METHODS = ['מזומן', 'Bit', 'העברה בנקאית', 'PayBox', 'אשראי', 'אחר'];

// סטטוסים אפשריים (לשימוש עקבי בין Frontend ל-Backend)
var EXPENSE_MANUAL_STATUS = { PLANNED: 'מתוכנן', AGREED: 'סוכם' };
var EXPENSE_COMPUTED_STATUS = { PARTIALLY_PAID: 'שולם חלקית', PAID: 'שולם' };
var PAYMENT_STATUS = { PLANNED: 'מתוכנן', PENDING: 'ממתין לתשלום', PAID: 'שולם' };
