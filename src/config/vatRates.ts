/**
 * src/config/vatRates.ts
 *
 * Shared VAT rate constants.
 * Kept here to avoid circular imports between adapters and services.
 */

/**
 * Standard French VAT rate for electrical equipment (20 %).
 * materielelectrique.com publishes prices TTC — we divide by (1 + this) to get HT.
 */
export const MATERIELELECTRIQUE_VAT_RATE = 0.2;

