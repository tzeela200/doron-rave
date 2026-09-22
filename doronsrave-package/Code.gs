/**
 * Code.gs
 * נקודת הכניסה של ה-Web App.
 */

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle("DORON'S RAVE")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** מאפשר לכלול קבצי HTML/CSS/JS נוספים בתוך Index.html באמצעות <?!= include('Filename'); ?> */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * טוען בבת אחת את כל המידע הדרוש למסך הראשי (בית), כדי לצמצם קריאות google.script.run.
 */
function getInitialData() {
  try {
    var events = listRecords_(CONFIG.SHEETS.EVENTS, false);
    var expenses = listRecords_(CONFIG.SHEETS.EXPENSES, false);
    var income = listRecords_(CONFIG.SHEETS.INCOME, false);
    var categories = listRecords_(CONFIG.SHEETS.CATEGORIES, false);
    var vendors = listRecords_(CONFIG.SHEETS.VENDORS, false);
    var artists = listRecords_(CONFIG.SHEETS.ARTISTS, false);

    events.sort(function (a, b) { return new Date(b.event_date) - new Date(a.event_date); });
    var eventsWithTotals = events.map(function (ev) {
      return Object.assign({}, ev, computeEventTotals_(ev.event_id, expenses, income));
    });

    var recentEvent = eventsWithTotals.length > 0 ? eventsWithTotals[0] : null;

    return ok_({
      recentEvent: recentEvent,
      recentEvents: eventsWithTotals.slice(0, 5),
      categories: categories,
      vendors: vendors,
      artists: artists,
      eventsCount: events.length
    });
  } catch (e) {
    return fail_('לא הצלחנו לטעון את נתוני הבית. ודאי ש-initializeSystem() הופעלה.', e);
  }
}
