# DORON'S RAVE — פרומפט מלא לביצוע השדרוג

## משימה

יש לך גישה מלאה לפרויקט הקיים של **DORON'S RAVE** ואתה כבר מכיר אותו. בצע שדרוג מלא של המערכת הקיימת, **בלי לבנות אותה מחדש**, **בלי להעביר כרגע ל-Supabase**, ובלי להפוך מערכת אישית ופשוטה לפרויקט מורכב.

המטרה: לשפר את המערכת הקיימת כך שתישאר עובדת עכשיו על Google Apps Script + Google Sheets, עם היכולות החדשות שמפורטות כאן, תוך שמירה מלאה על הנתונים, הערכים, העיצוב והלוגיקה הקיימים.

---

# 1. כללי על — מחייבים

1. **עובדים על `src/` בלבד.**
2. קרא לפני שינוי:
   - `CLAUDE.md`
   - `HANDOFF.md`
   - `WORKLOG.md`
   - `doronsrave-package/SPEC-מקורי.md`
3. `HANDOFF.md` הוא מקור החלטות נעול. אין לסתור אותו.
4. **לא לבנות מחדש את המערכת.**
5. **לא לשנות Stack:**
   - Google Apps Script
   - Google Sheets
   - Vanilla JS
   - HTML/CSS
   - `google.script.run`
6. **לא Supabase עכשיו.** בעתיד נעביר את המערכת בהדרגה, אבל זה לא חלק מהמשימה.
7. **לא לשנות מידע קיים או ערכים קיימים.**
8. אין לבצע ניקוי נתונים, migration עסקי, rename לערכים קיימים או “תיקון” תוכן על דעתך.
9. מחיקה נשארת Archive בלבד.
10. כל עמודה חדשה לטבלה קיימת מתווספת **רק בסוף `SHEET_HEADERS`**.
11. אין להעביר `undefined` ל-`updateRecord_()`.
12. שמור על `LockService`, מניעת Double Submit, וכל הגנות הקוד שכבר קיימות.
13. כאשר יש ספק בין עוד פיצ'ר לבין פשטות — **בחר בפשטות**.

---

# 2. עיצוב — לא Redesign

העיצוב הקיים **מאושר ואהוב**. אין להחליף אותו.

שמור באופן מחמיר על:

- Dark Mode בלבד.
- הרקע הכהה הקיים.
- הצבעים הקיימים ב-`Stylesheet.html`.
- Heebo בלבד.
- RTL מלא.
- התחושה היוקרתית / Premium.
- פאנלים כהים וצבעים עמומים ועדינים.
- Bottom Navigation הקיים.
- Floating `+` הקיים.
- מבנה הניווט הקיים.
- צבעי המשמעות הקיימים:
  - הוצאות = חמר.
  - הכנסות = מרווה.
  - תשלומים = גחלת.
  - אירועים = כחול.
- Body 17px, מינימום 14px, line-height הקיים.
- ללא letter-spacing בעברית.
- touch targets לפחות 48px.

מותר לשפר:

- spacing.
- hierarchy.
- alignment.
- consistency.
- iconography.
- grouping.
- visual hierarchy בין כותרת, נתון וטקסט משני.
- מבנה Card פנימי, כל עוד הוא ממשיך את השפה הקיימת.

**לא לעשות:**

- White Mode.
- Stripe redesign.
- Material Design.
- Tailwind look חדש.
- שינוי פלטת צבעים.
- Dashboard זר למערכת.
- ניווט חדש.

כל רכיב חדש חייב להיראות כאילו היה חלק מהמערכת מהיום הראשון.

---

# 3. מה כבר קיים — לא לבנות שוב

כבר קיימים ועובדים:

- Events.
- Categories.
- Subcategories.
- Vendors.
- Artists.
- Expenses.
- Payments.
- Income.
- Payment Methods.
- תשלומים חלקיים / מקדמות.
- תשלומים קרובים.
- שכפול אירוע.
- השוואת אירועים.
- חיפוש.
- סינון.
- Breakdown לפי קטגוריה.
- Breakdown לפי תת-קטגוריה.
- Breakdown לפי ספק.
- Navigation history.
- Archive.
- Mobile First.
- Double Submit protection.
- קטגוריה/תת-קטגוריה בעיצוב היררכי.

אל תיצור מנגנונים כפולים.

---

# 4. סטטוסים — אין לשנות

## הוצאה

ידני:

- `מתוכנן`
- `סוכם`

מחושב:

- `שולם חלקית`
- `שולם`

## תשלום

- `מתוכנן`
- `ממתין לתשלום`
- `שולם`

`באיחור` נשאר Display Status בלבד.

**אין ליצור סטטוס חדש בשם "מקדמה".** מקדמה כבר מיוצגת בתשלום חלקי.

---

# 5. שינויי Schema

## Events — להוסיף בסוף

- `average_ticket_price`
- `expected_ticket_count`

שניהם אופציונליים.

## Artists — להוסיף בסוף

- `real_name`
- `stage_name`

`name` הקיים נשאר ולא מבצעים migration.

## Expenses — להוסיף בסוף

- `performance_start_time`
- `performance_end_time`

שניהם אופציונליים ומשמשים רק להוצאות בקטגוריית "אמנים".

## Income — להוסיף בסוף

- `is_ticket_income`

Boolean. רשומות ישנות חסרות ערך = false לצורכי לוגיקה.

## Notes — Tab חדש

הוסף ל-`CONFIG.SHEETS` ול-`SHEET_HEADERS`:

- `note_id`
- `entity_type`
- `entity_id`
- `note_type`
- `content`
- `reminder_date`
- `is_completed`
- `is_archived`
- `created_at`
- `updated_at`

### ערכים מותרים

`entity_type`:
- `event`
- `artist`

`note_type`:
- `note`
- `reminder`

אין צורך בסוגים נוספים.

---

# 6. שדרוג Schema בטוח

הבעיה הקיימת: `ensureSheetWithHeaders_()` יכול לכתוב מחדש Header Row לפי הסדר.

צור מנגנון שדרוג קטן ובטוח, למשל:

`ensureEnhancementSchema_()`

הוא צריך:

1. ליצור `Notes` אם לא קיים.
2. לבדוק את הטבלאות הקיימות.
3. להוסיף עמודות חסרות **רק בסוף**.
4. לא להזיז עמודה קיימת.
5. לא לשכתב מידע קיים.
6. לא לבצע migration עסקי.
7. אם סדר העמודות הקיים לא תואם prefix צפוי — לעצור עם Error ברור, לא לנסות לתקן לבד.
8. להיות Idempotent.
9. להשתמש ב-Lock אם צריך.

אין לשנות את `initializeSystem()` באופן שמסכן Spreadsheet קיים.

---

# 7. אמנים — שם אמיתי ושם במה

## Backend — `ArtistsService.gs`

### `getArtists()`

החזר גם:

- `real_name`
- `stage_name`

שם תצוגה אפקטיבי:

`stage_name || name || real_name`

המיון צריך להתבסס על אותו שם תצוגה.

שמור על:

- `events_count`
- `total_amount`

### `saveArtist(data)`

קבל ושמור:

- `real_name`
- `stage_name`

בנוסף לכל השדות הקיימים.

`name` נשאר קיים לצורך תאימות לאחור.

כלל תאימות:

- לא למחוק `name`.
- לא לשכתב אמנים קיימים.
- לא להעתיק אוטומטית `name` ל-`stage_name` או `real_name`.

אם משתמש יוצר אמן חדש דרך הממשק החדש, אפשר לשמור `name` כ-fallback פנימי מתוך `stage_name || real_name` כדי לשמור על תאימות לקוד הישן, אבל אין לשנות רשומות קיימות אוטומטית.

### `getArtistExpenseHistory()`

להחזיר גם נתוני שעות הופעה אם קיימים:

- `performance_start_time`
- `performance_end_time`
- duration מחושב.

### `importArtists()`

לא לשבור.

ייבוא ישן של רשימת שמות ממשיך לשמור `name` בלבד.

---

# 8. מסך אמנים

## `personCardHtml(p, kind)`

כאשר `kind === 'artist'`:

שם ראשי:

`stage_name || name || real_name`

אם `real_name` קיים ושונה מהשם הראשי:

הצג בשורה משנית ועדינה.

שמור על:

- טלפון.
- מספר אירועים.
- סכום כולל.
- הערות קיימות.
- העיצוב הקיים.

## `openArtistEditSheet(artist)`

הוסף שני שדות ברורים:

- שם במה.
- שם אמיתי.

אל תסיר מידע קיים.

הוסף באזור נמוך יותר:

### הערות מתוארכות

- רשימת Notes של האמן.
- כל הערה עם תאריך ושעה.
- כפתור `+ הוסף הערה`.
- Archive להערה.

אין צורך בתזכורת ברמת אמן כרגע.

הערות ישנות ב-`notes` / `system_notes` נשארות ומוצגות כמידע ישן. אין להמציא להן תאריך היסטורי.

---

# 9. שעות הופעה לאמנים

השעות שייכות ל:

**אמן × אירוע × הוצאה**

ולכן נשמרות ב-`Expenses`.

## שדות

- `performance_start_time`
- `performance_end_time`

פורמט: `HH:mm`

דוגמאות:

- `22:00`
- `23:30`
- `01:00`

---

# 10. חישוב משך נגינה

צור helper מרכזי אחד.

למשל:

`calculatePerformanceDuration_()`

או שם עקבי אחר.

כללים:

- `22:00–23:00` = 60 דקות.
- `23:00–01:00` = 120 דקות.
- `22:30–00:00` = 90 דקות.
- אם End קטן מ-Start — מדובר בחציית חצות.
- אין להשתמש בתאריך מלא.
- החישוב נעשה בדקות.

החזר לפחות:

- דקות.
- טקסט תצוגה, למשל `2 שעות`, `1:30 שעות` או פורמט עקבי אחר.

---

# 11. עלות לשעת נגינה

אין שדה חדש למחיר לשעה.

חישוב תצוגה בלבד:

`agreed_amount / duration_hours`

לדוגמה:

- סכום: 6,000 ₪
- משך: 3 שעות
- עלות לשעה: 2,000 ₪

אם אין שעות תקינות — לא מציגים עלות לשעה.

---

# 12. טופס הוצאה — אמנים

עדכן את:

- `renderExpenseSheetBody()`
- `renderWhomFieldHtml()`
- הלוגיקה הקשורה לקטגוריית אמנים.
- `submitExpenseForm()`

כאשר `isCategoryArtists(category_id) === true`:

הוסף Section קטן בשם:

**שעות הופעה**

עם:

- שעת התחלה (`input type="time"`).
- שעת סיום (`input type="time"`).
- משך נגינה מחושב.
- עלות לשעה מחושבת אם יש סכום.

UX:

- שינוי שעה מעדכן מיד duration.
- שינוי `agreed_amount` מעדכן מיד hourly rate.
- אין חובה למלא שעות.
- אם מולאה רק שעה אחת — שגיאה.

כאשר הקטגוריה אינה אמנים:

- לא להציג את שדות השעות.
- לא לשלוח ערכי שעות חדשים.

---

# 13. `ExpensesService.gs`

## `validateExpense_(data)`

הוסף:

- אם Start קיים ו-End חסר → שגיאה.
- אם End קיים ו-Start חסר → שגיאה.
- אם שניהם קיימים → תקין.
- חציית חצות תקינה.

יש לבצע זאת רק כאשר מדובר בקטגוריית אמנים או כאשר נשלחו השדות.

## `createExpense()`

שמור:

- `performance_start_time`
- `performance_end_time`

## `updateExpense()`

כנ"ל.

בעת מעבר מאמנים לקטגוריה אחרת, נקה את השעות של אותה הוצאה בלבד כדי שלא יישאר מידע לא רלוונטי.

## `enrichExpense_()`

הוסף ערכים מחושבים בלבד:

- `performance_duration_minutes`
- `performance_duration_text`
- `hourly_rate`

לא לשמור אותם ב-Sheet.

---

# 14. לוח אמנים בתוך אירוע

המשתמשת **לא רוצה גרף** ולא Gantt.

ב-`renderEventDetails(eventId)` הוסף Section קומפקטי:

## לוח אמנים

פורמט שורה:

`22:00–00:00 | Offer Nissim | 2 שעות`

מתחת לשם הבמה אפשר להציג שם אמיתי אם קיים.

המטרה: לראות במבט אחד את סדר האמנים והזמנים.

### סדר כרונולוגי

חייב לעבוד גם באירוע שחוצה חצות.

לדוגמה:

- 22:00
- 23:30
- 00:30
- 02:00

ולא למיין `00:30` לפני `22:00` רק בגלל מיון string.

בחר כלל עקבי המבוסס על רצף לילה. אין צורך לדרוש תאריך נוסף.

---

# 15. חפיפות בין אמנים

בדוק חפיפה בין הופעות באותו Event.

אם קיימת חפיפה:

- הצג Warning בלבד.
- לא לחסום שמירה.
- לא Modal דרמטי.
- השתמש בשפה העיצובית הקיימת ובצבע אזהרה קיים.

נוסח לדוגמה:

`יש חפיפה בין X לבין Y`

אפשר להוסיף את חלון הזמן של החפיפה אם קל לחשב.

בדיקה:

- 22:00–00:00 + 23:00–01:00 = חפיפה.
- 22:00–23:00 + 23:00–01:00 = אין חפיפה.

---

# 16. הערות ותזכורות — `NotesService.gs`

צור Service חדש ופשוט.

## `getEntityNotes(entityType, entityId)`

- מחזיר רשומות פעילות בלבד.
- מסנן לפי entity_type/entity_id.
- החדשות ביותר קודם.

## `saveEntityNote(data)`

חובה:

- `entity_type`
- `entity_id`
- `content`

אופציונלי:

- `note_type`
- `reminder_date`

Default:

- note_type = `note`
- is_completed = false

## `toggleNoteCompleted(noteId, completed)`

מיועד לתזכורות.

## `archiveEntityNote(noteId)`

Archive בלבד.

אין Hard Delete.

---

# 17. הערות ותזכורות במסך אירוע

ב-`renderEventDetails()` הוסף Section:

## הערות ותזכורות

### הערה

הצג:

- תוכן.
- תאריך ושעת `created_at`.

### תזכורת

הצג:

- תוכן.
- reminder_date אם קיים.
- מצב: פתוח / הושלם.
- תאריך יצירה.

פעולות:

- `+ הוסף הערה`
- `+ הוסף תזכורת`
- סימון תזכורת כהושלמה.
- פתיחה מחדש אם צריך.
- Archive.

אין לבנות:

- Push notifications.
- email.
- cron.
- WhatsApp.
- מערכת משימות מלאה.

זו רשימת הערות/תזכורות אישית ופשוטה בתוך האירוע.

`Events.general_notes` הקיים נשאר. אל תמיר אותו ל-Notes ואל תמציא לו תאריך.

---

# 18. P&L — עיקרון

לא לבנות מודול פיננסי חדש.

כבר קיימת פונקציה:

`computeEventTotals_()`

והיא מחזירה:

- `total_income`
- `total_expenses`
- `balance`
- `total_paid`
- `total_remaining`

**אין לשנות את המשמעות של אף אחד מהשדות האלה.**

צור פונקציה נפרדת:

`computeEventPnl_()`

שתרחיב את התמונה הפיננסית.

---

# 19. הוצאות מתוכננות

לכל הוצאה:

אם `planned_amount > 0`:

השתמש בו.

אחרת:

Fallback ל-`agreed_amount`.

הסיבה: אירועים קיימים שבהם לא מולא planned amount לא צריכים להיראות כאילו אין להם עלות מתוכננת.

תוצאה:

`planned_expenses`

---

# 20. הכנסות מכרטיסים

הוסף `Income.is_ticket_income`.

בטופס Income הוסף checkbox:

**הכנסה ממכירת כרטיסים**

כאשר מסומן:

- `quantity` = מספר הכרטיסים שנמכרו.
- `unit_price` = מחיר לכרטיס.
- `total_amount` עדיין מחושב בשרת בלבד.

כאשר לא מסומן:

ההתנהגות הקיימת נשארת בדיוק כפי שהיא.

רשומה ישנה שאין לה `is_ticket_income` נחשבת false.

---

# 21. `IncomeService.gs`

## `saveIncome(data)`

קבל ושמור:

- `is_ticket_income`

שמור את החישוב הקיים:

`total_amount = quantity × unit_price`

בשרת בלבד.

## `enrichIncome_(row)`

החזר `is_ticket_income` כ-Boolean תקין.

---

# 22. טופס הכנסה

עדכן:

- `openIncomeSheet(eventId, incomeId)`
- `submitIncomeForm(...)`

הוסף checkbox:

**הכנסה ממכירת כרטיסים**

כאשר מסומן:

- label של quantity = `כמות כרטיסים`.
- label של unit_price = `מחיר לכרטיס`.

כאשר לא:

- שמור labels וההתנהגות הקיימת.

---

# 23. נתוני תחזית ברמת Event

ביצירה/עריכה של Event הוסף Section קטן ולא חובה:

## תחזית כרטיסים

שדות:

- `מחיר כרטיס ממוצע` → `average_ticket_price`
- `כמות כרטיסים צפויה` → `expected_ticket_count`

שניהם אופציונליים.

אין לדרוש אותם מאירועים ישנים.

---

# 24. נוסחאות P&L

## בפועל

`actual_income = total Income`

`agreed_expenses = total agreed_amount`

`actual_balance = actual_income - agreed_expenses`

אלו נשענים על totals הקיימים.

## מתוכנן

`planned_expenses = sum(planned_amount > 0 ? planned_amount : agreed_amount)`

## כרטיסים שנמכרו

סכום `quantity` של Income שבהם:

`is_ticket_income === true`

תוצאה:

`tickets_sold`

## הכנסה מכרטיסים

סכום `total_amount` מאותן רשומות.

תוצאה:

`ticket_income`

## מחיר כרטיס ממוצע בפועל

אם `tickets_sold > 0`:

`actual_average_ticket_price = ticket_income / tickets_sold`

לצורך חישוב נקודת איזון, מחיר הכרטיס שבו משתמשים הוא:

1. `Events.average_ticket_price` אם מולא ובערך > 0.
2. אחרת, `actual_average_ticket_price` אם ניתן לחשב.
3. אחרת null.

העדיפות למחיר התחזית שהמשתמש הזין מאפשרת לחשב איזון גם לפני שהחלו מכירות.

---

# 25. הכנסות שאינן כרטיסים

`non_ticket_income = sum(total_amount where is_ticket_income !== true)`

רשומות ישנות נחשבות non-ticket.

---

# 26. נקודת איזון

`remaining_cost_to_cover = max(0, planned_expenses - non_ticket_income)`

אם `average_ticket_price_used > 0`:

`break_even_tickets = ceil(remaining_cost_to_cover / average_ticket_price_used)`

אחרת:

`break_even_tickets = null`

UI:

`יש להזין מחיר כרטיס ממוצע כדי לחשב נקודת איזון`

---

# 27. כמה עוד חסר לאיזון

אם break_even קיים:

`break_even_remaining = max(0, break_even_tickets - tickets_sold)`

דוגמה:

- נקודת איזון = 500.
- נמכרו = 320.
- חסרים = 180.

---

# 28. תחזית רווח

רק אם קיימים:

- `expected_ticket_count > 0`
- מחיר כרטיס ממוצע תקין.

חשב:

`forecast_ticket_income = expected_ticket_count × average_ticket_price_used`

`forecast_total_income = forecast_ticket_income + non_ticket_income`

`forecast_profit = forecast_total_income - planned_expenses`

אם אין `expected_ticket_count`:

- אל תמציא תחזית.
- הצג מצב ריק/טקסט עדין אם צריך.

---

# 29. מבנה `computeEventPnl_()`

החזר אובייקט ברור, למשל:

- `planned_expenses`
- `tickets_sold`
- `ticket_income`
- `non_ticket_income`
- `actual_average_ticket_price`
- `average_ticket_price_used`
- `break_even_tickets`
- `break_even_remaining`
- `expected_ticket_count`
- `forecast_ticket_income`
- `forecast_total_income`
- `forecast_profit`

אפשר להוסיף שדות עזר אם הם נחוצים ל-UI, אבל לא ליצור שכבת Domain גדולה.

---

# 30. `EventsService.gs`

## `createEvent(data)`

שמור גם:

- `average_ticket_price`
- `expected_ticket_count`

כאופציונליים.

## `updateEvent(data)`

כנ"ל.

## `getEvents()`

שמור את totals הקיימים.

אפשר לצרף `pnl` או שדות P&L נדרשים, אבל אל תכביד אם אין צורך למסך הבית.

## `getEventDetails(eventId)`

החזר בנוסף:

`pnl`

עם כל חישובי סעיף 29.

## `computeEventTotals_()`

לא לשנות משמעות קיימת.

---

# 31. מסך Event Details — מבנה

לא לבצע redesign.

שמור את המבנה הקיים, אבל סדר את המידע כך שהאירוע יהיה ברור יותר.

בחלק העליון של Event Details:

1. שם האירוע.
2. תאריך/מיקום הקיימים.
3. אזור פיננסי קומפקטי.
4. לאחריו התוכן הקיים.

## אזור פיננסי

השתמש בסגנון הכרטיסים הקיים במערכת.

הצג:

- הכנסות בפועל.
- הוצאות שסוכמו.
- יתרה נוכחית.
- נותר לשלם.
- הוצאות מתוכננות.
- כרטיסים שנמכרו.
- נקודת איזון.
- כמה כרטיסים חסרים לאיזון.
- תחזית רווח, רק אם ניתן לחשב.

אל תעמיס 10 כרטיסים שווים בגודל.

בנה hierarchy:

- נתוני ליבה גדולים/ברורים.
- נתוני תחזית משניים.
- נקודת איזון באזור אחד ברור.

---

# 32. Progress לנקודת איזון

אפשר להוסיף Progress Bar קטן בתוך אזור נקודת האיזון.

לא Chart library.

דוגמה:

`320 / 500 כרטיסים לנקודת איזון`

אחוז:

`min(100, tickets_sold / break_even_tickets × 100)`

אם אין break_even תקין — לא מציגים Progress.

---

# 33. מסך הבית

`homeHeroHtml(ev)`

אין redesign.

אפשר להוסיף לכל היותר מידע קצר ושימושי, לדוגמה:

`עוד 180 כרטיסים לנקודת איזון`

רק אם הנתון קיים.

אל להפוך את הבית לדשבורד פיננסי עמוס.

---

# 34. קטגוריות ותתי-קטגוריות

המשתמשת ביקשה שיהיה הבדל עיצובי ברור.

זה כבר קיים לפי `HANDOFF.md` ולכן:

- אמת שהוא נשמר בכל המסכים.
- אל תבנה מחדש.

השפה המאושרת:

### קטגוריית אב

- Card ברור.
- icon בתוך תיבה.
- שם מודגש.
- count.
- chevron.

### תת-קטגוריה

- אזור שקוע כהה.
- הזחה.
- branch line.
- טקסט משני.

בטופס הוצאה:

- `תת-קטגוריה של X` בהיררכיה ויזואלית.

בשורת הוצאה:

- `קטגוריה ← תת-קטגוריה`.

ב-Breakdown:

- פירוט פנימי שקוע.

אמנים:

- נשארים ללא תתי-קטגוריות.

---

# 35. אייקונים

שפר עקביות בלבד.

כללים:

- סט אחד אחיד.
- stroke/weight אחיד.
- גודל עקבי.
- יישור אנכי עקבי.
- אין Emoji חדשים במקום אייקונים קיימים.
- אל תשנה את האופי היוקרתי.

אם הפרויקט כבר משתמש בסט מסוים, המשך איתו.

---

# 36. שכפול אירוע — `CloneService.gs`

שמור את הכללים הקיימים:

- מקור לא משתנה.
- Event חדש מקבל UUID חדש.
- Expense חדש מקבל UUID חדש.
- Payment חדש מקבל UUID חדש.
- אמן/ספק אינם משוכפלים כישות.
- תשלום ששוכפל לעולם לא נשמר כ-`שולם`.
- `paid_date` לא מועתק.
- due date זז לפי הפרש תאריכים.

## Events

האירוע החדש יכול לקבל:

- `average_ticket_price`
- `expected_ticket_count`

מתוך טופס השכפול/יצירה.

## Expenses — mode ALL

העתק גם:

- `performance_start_time`
- `performance_end_time`

## STRUCTURE

המטרה היא מבנה נקי לאירוע חדש.

העדפה: בהעתקת Structure, שמור Artist relation אבל **אל תעתיק שעות הופעה** כברירת מחדל, כי שעות בדרך כלל תלויות בלו"ז של האירוע החדש.

אם יש סיבה חזקה בקוד הקיים להעתיקן, עצור וציין זאת בדוח; אל תמציא UX נוסף.

## Notes

אל תשכפל Notes/Reminders מאירוע המקור.

---

# 37. Performance

אין לטעון Notes של כל המערכת ב-`getInitialData()`.

טען Notes רק כאשר פותחים:

- Event details.
- Artist details/edit.

עדיף Call אחד לכל ישות.

אין N+1 calls.

אין cache בין בקשות שרת שכתיבות נשענות עליו.

שמור על מנגנון `REQUEST_MEMO_` הקיים בלבד.

---

# 38. UX כללי

כל פעולה חדשה צריכה להתנהג כמו המערכת הקיימת:

- כפתור Submit מושבת בזמן שמירה.
- Toast בהצלחה.
- Toast בשגיאה.
- שמירה לא מקפיצה למסך אחר ללא צורך.
- Sticky save ב-Bottom Sheet לפי השפה הקיימת.
- RTL.
- Mobile First.
- touch target >= 48px.
- סכומים בפורמט הקיים.
- ₪ בתוך שדות כסף לפי המימוש הקיים.
- tabular numbers.

---

# 39. מה לא להוסיף

לא להוסיף:

- Tags.
- לוח זמנים להקמות ופירוקים.
- CRM.
- הרשאות חדשות.
- Roles.
- Supabase.
- PostgreSQL.
- Firebase.
- API חיצוני.
- Authentication חדש.
- Notifications.
- Push.
- WhatsApp.
- Calendar integration.
- Ticketing integration.
- סליקה.
- Drag & Drop.
- Gantt.
- גרפים מורכבים.
- מערכת משימות מלאה.
- Audit system כבד.

זו מערכת אישית ופשוטה.

---

# 40. בדיקות חובה — תאימות לאחור

לפני סיום, ודא:

1. Event ישן שאין לו אף שדה חדש נפתח בלי שגיאה.
2. Artist ישן שיש לו רק `name` מוצג רגיל.
3. Expense ישן ללא שעות מוצג רגיל.
4. Income ישן ללא `is_ticket_income` מוצג רגיל ונחשב non-ticket.
5. Notes Tab לא קיים → נוצר בבטחה.
6. אף עמודה קיימת לא זזה.
7. אף ערך קיים לא השתנה.

---

# 41. בדיקות אמנים

בדוק:

- יצירת אמן עם שם במה + שם אמיתי.
- עריכת אמן קיים.
- אמן עם `name` בלבד.
- אמן עם stage_name בלבד + fallback תקין.
- `getArtists()` sort.
- Import ישן עדיין עובד.
- היסטוריית אמן עדיין עובדת.

---

# 42. בדיקות שעות

- `22:00–23:00` = 60 דקות.
- `23:00–01:00` = 120 דקות.
- `22:30–00:00` = 90 דקות.
- רק Start = Error.
- רק End = Error.
- שניהם ריקים = תקין.
- שינוי סכום מעדכן hourly rate.
- מעבר מהוצאת אמן לקטגוריה אחרת מנקה שעות של אותה הוצאה בלבד.

---

# 43. בדיקות סדר לוח אמנים

בדוק סדר:

- 21:00
- 23:30
- 00:30
- 02:00

צריך להציג כרצף לילה הגיוני ולא לפי מיון string.

---

# 44. בדיקות חפיפה

- 22:00–00:00 + 23:00–01:00 → Warning.
- 22:00–23:00 + 23:00–01:00 → אין Warning.
- Warning לא חוסם שמירה.

---

# 45. בדיקות Notes

- הוסף Event note.
- created_at נשמר.
- Refresh → נשאר.
- הוסף Reminder.
- reminder_date נשמר.
- סמן completed.
- Refresh → נשמר.
- Archive → נעלם מרשימת פעילים.
- Artist note עובד בנפרד.
- Event note לא מופיע אצל Artist ולהפך.

---

# 46. בדיקות P&L בסיסיות

## מקרה 1

- planned expenses: 100,000 ₪.
- non-ticket income: 0.
- average ticket price: 200 ₪.

צפוי:

- break-even = 500 כרטיסים.

אם sold = 300:

- remaining = 200.

## מקרה 2

- planned expenses: 100,000.
- non-ticket income: 20,000.
- average ticket price: 200.

צפוי:

- remaining cost = 80,000.
- break-even = 400.

## מקרה 3 — Forecast

- expected tickets = 600.
- average ticket price = 200.
- non-ticket income = 0.
- planned expenses = 100,000.

צפוי:

- forecast ticket income = 120,000.
- forecast profit = 20,000.

## מקרה 4 — planned fallback

Expense:

- planned_amount = 0.
- agreed_amount = 15,000.

לצורכי planned expenses:

- יש לספור 15,000.

---

# 47. Regression מלא

בדוק שכל אלה ממשיכים לעבוד:

- Home.
- Events list.
- Event details.
- Event create.
- Event edit.
- Clone Event.
- Expenses.
- Expense create/edit.
- Simple payment inside expense.
- Split payments.
- Upcoming payments.
- Partial payment.
- Income.
- Categories.
- Subcategories.
- Vendors.
- Artists.
- Import artists/vendors.
- Search.
- Filters.
- Comparison.
- Settings.
- Payment methods.
- Archive.
- Back navigation.
- Bottom navigation.
- Floating +.

---

# 48. סדר ביצוע

בצע את כל המשימה ברצף, אבל בסדר הבא כדי להקטין Regression:

1. קרא את הקוד וה-HANDOFF.
2. Schema בטוח.
3. Backend/helpers.
4. Artists.
5. Performance times.
6. Notes.
7. Income ticket marker.
8. P&L.
9. Event UI.
10. Artist UI.
11. Expense/Income forms.
12. Clone.
13. UI refinement.
14. QA + Regression.

אין צורך לעצור ולשאול בין שלבים אלא אם קיימת סתירה אמיתית עם הקוד או החלטה נעולה.

---

# 49. כלל החלטה בזמן ביצוע

אם גילית שהקוד בפועל שונה מעט משמות הפונקציות או המבנה שמפורטים כאן:

- אל תבנה שכבה מקבילה.
- אתר את הפונקציה האמיתית שמבצעת את אותה אחריות.
- יישם שם את השינוי.
- שמור על הארכיטקטורה הקיימת.

אם קיים פתרון קיים שמכסה דרישה — הרחב אותו, אל תיצור חדש.

---

# 50. מה אני רוצה בסיום

בצע את הקוד בפועל.

לאחר מכן החזר לי דוח קצר ומדויק עם:

1. קבצים ששונו.
2. קבצים חדשים.
3. עמודות חדשות.
4. פונקציות חדשות.
5. פונקציות קיימות ששונו.
6. תחשיבים שנוספו.
7. בדיקות שבוצעו.
8. תוצאות Regression.
9. מה לא ניתן היה לבדוק מקומית.
10. האם נדרשת הרצה ידנית של פונקציית Schema/Upgrade.
11. פקודות `clasp` הנדרשות לפריסה, אבל **אל תפרוס ל-Production בלי אישור אם זה משנה את המערכת החיה**.
12. אישור מפורש ש:
    - לא שינית מידע קיים.
    - לא שינית ערכים קיימים.
    - לא שינית סטטוסים קיימים.
    - לא ביצעת redesign.
    - לא העברת ל-Supabase.

---

# 51. המטרה הסופית

המערכת צריכה להרגיש כמו אותה DORON'S RAVE שכבר קיימת — רק יותר חכמה, מסודרת ונוחה.

המשתמש צריך לקבל:

- P&L בזמן אמת.
- נקודת איזון בכרטיסים.
- תחזית רווח.
- שם אמיתי + שם במה לאמן.
- שעות נגינה.
- משך נגינה.
- עלות לשעת נגינה.
- סדר אמנים כרונולוגי וברור.
- Warning לחפיפות.
- הערות מתוארכות.
- תזכורות בתוך אירוע.
- היררכיה עיצובית ברורה.
- אייקונים אחידים יותר.

והכול תוך שמירה על:

- הנתונים.
- הערכים.
- הסטטוסים.
- הצבעים.
- הסגנון הכהה והיוקרתי.
- הפשטות.
- היציבות.

**אל תהפוך את המערכת למוצר אחר. שפר את מה שכבר עובד.**
