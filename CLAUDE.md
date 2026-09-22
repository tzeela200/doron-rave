# DORON'S RAVE — הוראות לסשן

סדר קריאה בכל סשן חדש:
1. `HANDOFF.md` (שורש הפרויקט): מצב נוכחי + כל ההחלטות הנעולות (לא לסטות בלי לשאול)
2. `WORKLOG.md`: מה השתנה בכל מנה, איך אומת, ומה ממתין
3. `doronsrave-package/SPEC-מקורי.md`: האפיון הקנוני (100 סעיפים)

שכבות אמת (לא לערבב):
- **קנוני:** `SPEC-מקורי.md` + ההחלטות ב-`HANDOFF.md` (בשורש).
- **Snapshot היסטורי (לא לערוך):** `doronsrave-package/`, כפי שהתקבל לפני העבודה כאן. ה-HANDOFF שבו מתאר רק את שלב 1.
- **אמת עבודה:** `src/`, הקוד שנדחף ל-Apps Script דרך clasp (`rootDir: src`).
- **טיוטה היסטורית:** `DORON'S RAVE — Google Sheets Edition.md`, גרסה מוקדמת (95 סעיפים) של האפיון. רפרנס בלבד.

clasp: ה-Spreadsheet ID נשמר ב-Script Properties בלבד. ה-Script ID נמצא ב-`.clasp.json`. אלה שני מזהים שונים.
⚠ עמודה חדשה לטבלה קיימת: רק בסוף `SHEET_HEADERS` (הפירוט ב-HANDOFF, סעיף 3).
