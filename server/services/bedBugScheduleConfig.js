/**
 * Hard-coded bed bug service calendar rules.
 *
 * Bed bug service always includes a two-week follow-up after the initial visit.
 * Both visits fall within the first contract month, so month 0 is labeled 2x(S)
 * with the initial price — not a separate service month like RIT's one-month follow-up.
 *
 * After that, preventative follow-ups occur every four months (triannual cadence).
 */

/** @type {readonly number[]} */
export const BED_BUG_SERVICE_MONTH_INDEXES = Object.freeze([0, 4, 8]);

export const BED_BUG_SERVICE_INTERVAL_MONTHS = 4;

/** Initial month: two services (initial + 2-week follow-up) billed as one 2x(S) line. */
export const BED_BUG_INITIAL_PAYMENT_TEXT_TEMPLATE = '2x(S){initialTotal}';

export const BED_BUG_RECURRING_PAYMENT_TEXT_TEMPLATE = '{recurringTotalFormatted}';
