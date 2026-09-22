/**
 * IncomeService.gs
 * הכנסות (סעיפים 25, 57–58): הזנה ידנית, בלי Ticketing/סליקה.
 * total_amount = quantity × unit_price — מחושב בשרת, לא נסמכים על ערך מהדפדפן.
 */

function saveIncome(data) {
  try {
    if (!data) return fail_('חסרים נתוני הכנסה.');
    if (!data.name || !String(data.name).trim()) return fail_('שם / סוג ההכנסה הוא שדה חובה.');
    var quantity = toNumber_(data.quantity);
    var unitPrice = toNumber_(data.unit_price);
    if (!(quantity > 0)) return fail_('הכמות חייבת להיות גדולה מ-0.');
    if (unitPrice < 0) return fail_('המחיר ליחידה לא יכול להיות שלילי.');

    ensureEnhancementSchema_();
    var fields = {
      name: String(data.name).trim(),
      quantity: quantity,
      unit_price: unitPrice,
      // סה"כ מחושב בשרת בלבד, גם בהכנסה ממכירת כרטיסים
      total_amount: Math.round(quantity * unitPrice * 100) / 100,
      notes: data.notes || '',
      is_ticket_income: !!data.is_ticket_income
    };

    if (data.income_id) {
      return ok_(updateRecord_(CONFIG.SHEETS.INCOME, 'income_id', data.income_id, fields));
    }
    if (!data.event_id) return fail_('חסר מזהה אירוע.');
    return ok_(insertRecord_(CONFIG.SHEETS.INCOME, 'income_id', Object.assign({ event_id: data.event_id }, fields)));
  } catch (e) {
    return fail_('לא הצלחנו לשמור את ההכנסה.', e);
  }
}

function archiveIncome(incomeId) {
  try {
    if (!incomeId) return fail_('חסר מזהה הכנסה.');
    return ok_(archiveRecord_(CONFIG.SHEETS.INCOME, 'income_id', incomeId));
  } catch (e) {
    return fail_('לא הצלחנו למחוק את ההכנסה.', e);
  }
}

function enrichIncome_(row) {
  return Object.assign({}, row, {
    quantity: toNumber_(row.quantity),
    unit_price: toNumber_(row.unit_price),
    total_amount: toNumber_(row.total_amount),
    // רשומה ישנה בלי הערך הזה נחשבת "לא כרטיסים"
    is_ticket_income: toBool_(row.is_ticket_income)
  });
}
