// Money arithmetic in whole agorot so that JS floating point never becomes the source of a
// business number (Book 08 §16, ADR-053). Sums arrive already exact from Postgres numeric;
// these helpers are for the few formulas computed on top of them.

export type Agorot = number;

export function toAgorot(shekels: number): Agorot {
  return Math.round(shekels * 100);
}

export function fromAgorot(agorot: Agorot): number {
  return Math.round(agorot) / 100;
}

/** quantity × unit price, rounded to the agora (Book 04 §3, §8). Same rule as save_income(). */
export function lineTotal(quantity: number, unitPrice: number): number {
  return fromAgorot(Math.round(quantity * toAgorot(unitPrice)));
}

/** Parses a user-entered amount. Empty stays null — never coerced to 0 (Book 06 §17). */
export function parseAmount(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const cleaned = raw.replace(/[\s,₪]/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
