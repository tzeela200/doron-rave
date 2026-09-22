import { fromAgorot, toAgorot, type Agorot } from './money';

// P&L / break-even / forecast (Book 04 §6, §7; CALCULATIONS.md §4, §4א).
// Inputs are the exact sums from v_event_financial_totals plus the event's planning fields.
// Break-even is a planning metric: it never looks at what was already paid (ADR-030).

export interface TicketTier {
  name: string;
  quantity: number;
  price: number;
}

export interface PnlInput {
  plannedExpenses: number;
  ticketsSold: number;
  ticketIncome: number;
  nonTicketIncome: number;
  /** Events.average_ticket_price — null or 0 means "not set" (legacy toNumber_ > 0 rule). */
  averageTicketPrice: number | null;
  expectedTicketCount: number | null;
  /** In sale order. When present they override the average price and expected count. */
  tiers: readonly TicketTier[];
}

export interface Pnl {
  plannedExpenses: number;
  ticketsSold: number;
  ticketIncome: number;
  nonTicketIncome: number;
  actualAverageTicketPrice: number | null;
  averageTicketPriceUsed: number | null;
  remainingCostToCover: number;
  /** null = cannot be computed (no price, or tiers cannot cover the cost). Never 0 as filler. */
  breakEvenTickets: number | null;
  breakEvenRemaining: number | null;
  /** True only when tiers exist and all of them together do not cover the cost. */
  breakEvenUnreachable: boolean;
  usesTiers: boolean;
  expectedTicketCount: number | null;
  forecastTicketIncome: number | null;
  forecastTotalIncome: number | null;
  /** Negative = expected loss. null = no forecast basis (Book 04 §6.1). */
  forecastProfit: number | null;
}

/** Tickets needed to cover `amount`, selling tiers strictly in order (Book 04 §7). */
export function ticketsToCover(tiers: readonly TicketTier[], amount: Agorot): { tickets: number | null; covered: boolean } {
  if (amount <= 0) return { tickets: 0, covered: true };
  let left = amount;
  let tickets = 0;
  for (const tier of tiers) {
    const price = toAgorot(tier.price);
    if (price <= 0) {
      tickets += tier.quantity;
      continue;
    }
    const needed = Math.ceil(left / price);
    if (needed <= tier.quantity) return { tickets: tickets + needed, covered: true };
    tickets += tier.quantity;
    left -= tier.quantity * price;
  }
  return { tickets: null, covered: false };
}

export function computeEventPnl(input: PnlInput): Pnl {
  const tiers = input.tiers.filter((t) => t.quantity > 0);
  const planned = toAgorot(input.plannedExpenses);
  const ticketIncome = toAgorot(input.ticketIncome);
  const nonTicket = toAgorot(input.nonTicketIncome);
  const sold = input.ticketsSold;

  const actualAverage = sold > 0 ? ticketIncome / sold : null; // agorot, may be fractional
  const plannedAverage = input.averageTicketPrice !== null && input.averageTicketPrice > 0 ? toAgorot(input.averageTicketPrice) : null;
  // The price the user entered wins over the actual average (Book 04 §7.2).
  const priceUsed = plannedAverage ?? (actualAverage !== null && actualAverage > 0 ? actualAverage : null);

  const remainingCost = Math.max(0, planned - nonTicket);

  let breakEvenTickets: number | null;
  let covered = true;
  if (tiers.length > 0) {
    const cover = ticketsToCover(tiers, remainingCost);
    breakEvenTickets = cover.tickets;
    covered = cover.covered;
  } else {
    breakEvenTickets = priceUsed !== null ? Math.ceil(remainingCost / priceUsed) : null;
  }
  const breakEvenRemaining = breakEvenTickets === null ? null : Math.max(0, breakEvenTickets - sold);

  const tierCapacity = tiers.reduce((s, t) => s + t.quantity, 0);
  const expected = tiers.length > 0 ? tierCapacity : input.expectedTicketCount ?? 0;

  let forecastTicketIncome: Agorot | null = null;
  if (tiers.length > 0) {
    forecastTicketIncome = tiers.reduce((s, t) => s + t.quantity * toAgorot(t.price), 0);
  } else if (expected > 0 && priceUsed !== null) {
    forecastTicketIncome = Math.round(expected * priceUsed);
  }
  const forecastTotalIncome = forecastTicketIncome === null ? null : forecastTicketIncome + nonTicket;
  const forecastProfit = forecastTotalIncome === null ? null : forecastTotalIncome - planned;

  return {
    plannedExpenses: fromAgorot(planned),
    ticketsSold: sold,
    ticketIncome: fromAgorot(ticketIncome),
    nonTicketIncome: fromAgorot(nonTicket),
    actualAverageTicketPrice: actualAverage === null ? null : fromAgorot(actualAverage),
    averageTicketPriceUsed: priceUsed === null ? null : fromAgorot(priceUsed),
    remainingCostToCover: fromAgorot(remainingCost),
    breakEvenTickets,
    breakEvenRemaining,
    breakEvenUnreachable: tiers.length > 0 && !covered,
    usesTiers: tiers.length > 0,
    expectedTicketCount: expected > 0 ? expected : null,
    forecastTicketIncome: forecastTicketIncome === null ? null : fromAgorot(forecastTicketIncome),
    forecastTotalIncome: forecastTotalIncome === null ? null : fromAgorot(forecastTotalIncome),
    forecastProfit: forecastProfit === null ? null : fromAgorot(forecastProfit),
  };
}
