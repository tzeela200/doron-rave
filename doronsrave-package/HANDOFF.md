# DORON'S RAVE — מסמך מסירה (Handoff)

מסמך זה מיועד לכל מי שממשיך את הפרויקט (כולל Claude Code בסשן חדש) כדי לא להתחיל מאפס
ולא לסתור החלטות שכבר התקבלו.

## סטטוס נוכחי: שלב 1 הושלם (טרם אושר QA סופי ע"י המשתמשת)

**קיים ועובד:**
- Data Layer גנרי מול Google Sheets (`Utils.gs`, `DataService.gs`) עם `LockService`
- `initializeSystem()` אידמפוטנטית ב-`SetupService.gs` — יוצרת Spreadsheet, 9 Tabs, Headers,
  קטגוריית "אמנים" יחידה, אמצעי תשלום התחלתיים
- CRUD + Archive מלאים: Events, Categories, Vendors, Artists, Expenses
  (`EventsService.gs`, `CategoriesService.gs`, `VendorsService.gs`, `ArtistsService.gs`, `ExpensesService.gs`)
- Frontend מלא (Index.html + Stylesheet.html + JavaScript.html): בית, רשימת אירועים+חיפוש,
  יצירת/עריכת אירוע, פרטי אירוע עם Breakdown לפי קטגוריה, הוספת/עריכת הוצאה ב-Bottom Sheet
  עם Autocomplete ויצירת קטגוריה/ספק/אמן inline, לוגיקת "אמן" מול "למי משלמים?",
  Dark Premium + RTL, מניעת Double Submit, Empty States, לוגו אמיתי מוטמע (Base64) בכותרת

**עדיין לא קיים (בכוונה — לא נשכח, פשוט עוד לא הגענו):**
- Payments (מקדמות/תשלומים), ולכן "שולם"/"נותר לתשלום" בקוד הנוכחי מחושבים כ-0/agreed_amount
  זמנית (ראה `computeEventTotals_` ב-`EventsService.gs` ו-`enrichExpense_` ב-`ExpensesService.gs`)
- Income UI (ה-Tab קיים וה-Backend כבר סופר אותו ב-totals, אבל אין מסך הוספת הכנסה)
- Event Cloning (שכפול אירוע — מבנה בלבד / הכל כבסיס)
- תשלומים קרובים / באיחור
- השוואת אירועים (Comparison)
- חיפוש וסינון מתקדם (Search & Filters) — יש רק חיפוש שם אירוע פשוט במסך האירועים
- Attachments (קבלות ל-Drive)
- PWA / Add to Home Screen
- ליטוש נגישות סופי (WCAG AA)

## החלטות ארכיטקטורה שכבר התקבלו — אל תסטו מהן בלי לשאול

1. **Google Apps Script + Google Sheets בלבד.** בלי Supabase/Firebase/DB חיצוני, בלי API נפרד.
   כל תקשורת Frontend↔Backend דרך `google.script.run`.
2. **Vanilla JS, בלי React/Vue/בנייה (build step).** Apps Script HTML Service לא תומך ב-bundlers
   בקלות; כל ה-Frontend הוא Index.html + Stylesheet.html + JavaScript.html שכוללים זה את זה
   דרך `include()`.
3. **Spreadsheet ID נשמר ב-Script Properties בלבד** (`CONFIG.PROP_SPREADSHEET_ID`), אף פעם לא
   בקוד. אם ה-Spreadsheet כבר נוצר, אל תריצו שוב יצירה — `initializeSystem()` כבר אידמפוטנטית
   ובודקת את זה בעצמה.
4. **מחיקה = Archive תמיד**, אף פעם לא Hard Delete, חוץ מאם המשתמשת מבקשת זאת במפורש.
5. **אמן הוא סוג הוצאה, לא ישות כספית מקבילה** — לא ליצור Double Counting. ה-`agreed_amount`
   של הוצאת אמן נכלל פעם אחת בסה"כ הוצאות, בדיוק כמו כל הוצאה אחרת.
6. **שינוי הוצאה בעקבות שכפול (כשייבנה) לעולם לא ישנה את האירוע המקורי** — כל ID (Event/
   Expense/Payment) חדש שנוצר בשכפול הוא UUID חדש לגמרי.
7. **עברית מלאה ב-UI, RTL בכל מקום.** מונחים טכניים (`vendor_id` וכו') לא מוצגים למשתמשת אף פעם.
8. **Design Language:** Dark Premium / Elegant Rave — טונים כהים, Navy/כחול לילה, Off-White/
   Cream, נגיעות זהב וירוק טבעי במינון נמוך. בלי Neon, בלי מראה Excel/Dashboard תאגידי.
   טוקנים מוגדרים כ-CSS Variables בראש `Stylesheet.html` — להשתמש בהם, לא להמציא צבעים חדשים.
9. **מניעת Double Submit:** גם UI (disable button בזמן שמירה) וגם Server (`LockService` סביב
   insert/update ב-`DataService.gs`).
10. **הלוגו** מוטמע כ-Base64 בתוך `Index.html` (בתוך `brand-mark`) — כי ל-Apps Script אין
    Static Assets משלו. קובץ המקור באיכות מלאה מצורף כ-`logo-original.jpeg` לשימוש עתידי
    (למשל במסך כניסה/Splash שעוד לא נבנה).

## באג שתוקן — שימו לב לדפוס הזה בהמשך

ב-`updateRecord_` (הפונקציה הגנרית ב-`DataService.gs`), אם מעבירים אובייקט `updates` עם מפתח
שקיים אך ערכו `undefined`, ה-`for...in` עדיין מריץ עליו ודורס את הערך הקיים בשורה ל-''.
**אל תעבירו מפתחות עם ערך `undefined`** — רק כללו במפורש שדות שבאמת רוצים לעדכן (ראו התיקון
ב-`CategoriesService.saveCategory` וב-`ExpensesService.updateExpense` כדוגמה נכונה).

## סדר עבודה מוסכם עם המשתמשת

עבדנו לפי סדר הבנייה בסעיף 97 באפיון (`SPEC-מקורי.md`), במנות. המשתמשת ביקשה "מנה גדולה
יותר" לשלב 1 (עד Expenses כולל) והסכימה ל-QA בסוף כל מנה לפני שממשיכים.
**השלב הבא המוסכם: Payments + Income** (ואז Dashboard/תשלומים קרובים שתלויים בהם).
אחריו: Cloning + Comparison + Search/Filters + Attachments + ליטוש RTL סופי + QA מלא (סעיף 98).

## איך המשתמשת מפעילה/בודקת

אין לה `clasp` (בזמן כתיבת מסמך זה) — היא מעתיקה קבצים ידנית ל-script.google.com.
אם ממשיכים דרך Claude Code עם `clasp`: ודאו `clasp login` בוצע, `.clasp.json` מצביע על
ה-Script ID הנכון (לא Spreadsheet ID — אלה שני מזהים שונים), ושה-Apps Script API מופעל
בהגדרות המשתמש שלה (script.google.com/home/usersettings).

## קבצים בחבילה זו

כל 13 קבצי הקוד (`.gs` + `.html`), `README-התקנה.md` (הוראות התקנה + QA checklist לשלב 1),
`logo-original.jpeg` (לוגו באיכות מלאה), ומסמך זה.
