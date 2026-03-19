/**
 * src/adapters/rexel.ts
 *
 * Rexel adapter — calls the internal SAP Commerce Cloud price API:
 *   POST https://eu.dif.rexel.com/web/api/v3/product/priceandavailability
 *
 * Requires a Bearer token obtained after the user logs in to rexel.fr.
 * The token is stored in localStorage by useRexelAuth and injected here.
 *
 * Pricing: we use UNIT_LIST_PRICE (net unit price after discount).
 * Stock:   DELIVERY_BRANCH_AVAILABILITY with quantity.available > 0 → 1, else 0.
 */

import axios from 'axios';
import { SupplierAdapter } from './base';
import { FetchError } from '@/types/error';
import type { SupplierPrice } from '@/types/price';

const API_URL = 'https://eu.dif.rexel.com/web/api/v3/product/priceandavailability';
const BANNER = 'frx';

// ── Response shape (minimal) ──────────────────────────────────────────────────

interface RexelPrice {
  price: { amount: number; currency: string };
  priceLabel: string;
}

interface RexelAvailability {
  type: string;
  quantity: { available: number };
}

interface RexelLine {
  sku: string;
  prices: RexelPrice[];
  availabilities: RexelAvailability[];
}

interface RexelResponse {
  lines: RexelLine[];
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class RexelAdapter extends SupplierAdapter {
  readonly supplierId = 'rexel';
  private readonly token: string;

  constructor(token: string) {
    super();
    this.token = token;
  }

  async getPrice(reference: string): Promise<SupplierPrice> {
    if (!this.token) {
      throw new FetchError({
        code: 'AUTH_ERROR',
        supplierId: this.supplierId,
        message: 'Token Rexel manquant — veuillez vous connecter.',
        retryable: false,
      });
    }

    let data: RexelResponse;
    try {
      const response = await axios.post<RexelResponse>(
        API_URL,
        {
          banner: BANNER,
          lines: [{ sku: reference, qty: 1 }],
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'fr',
            'x-banner': BANNER,
            Origin: 'https://www.rexel.fr',
            Referer: 'https://www.rexel.fr/',
          },
          timeout: 15_000,
        }
      );
      data = response.data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          throw new FetchError({
            code: 'AUTH_ERROR',
            supplierId: this.supplierId,
            message: 'Token Rexel expiré ou invalide — veuillez vous reconnecter.',
            statusCode: status,
            retryable: false,
          });
        }
        if (status === 429) {
          throw new FetchError({
            code: 'RATE_LIMIT',
            supplierId: this.supplierId,
            message: 'Rate limité par Rexel.',
            statusCode: 429,
            retryable: true,
          });
        }
        if (status === 404) {
          throw new FetchError({
            code: 'NOT_FOUND',
            supplierId: this.supplierId,
            message: `Référence ${reference} introuvable chez Rexel.`,
            statusCode: 404,
            retryable: false,
          });
        }
        throw new FetchError({
          code: 'NETWORK_ERROR',
          supplierId: this.supplierId,
          message: err.message,
          statusCode: status,
          retryable: true,
        });
      }
      throw new FetchError({
        code: 'NETWORK_ERROR',
        supplierId: this.supplierId,
        message: String(err),
        retryable: true,
      });
    }

    return this.parseLine(data, reference);
  }

  parseLine(data: RexelResponse, reference: string): SupplierPrice {
    const line = data.lines?.[0];
    if (!line) {
      throw new FetchError({
        code: 'NOT_FOUND',
        supplierId: this.supplierId,
        message: `Aucune ligne de prix dans la réponse pour ${reference}.`,
        retryable: false,
      });
    }

    // Prefer UNIT_LIST_PRICE (net after discount), fallback to LINE_TOTAL_PRICE_NOVAT
    const unitPrice =
      line.prices.find((p) => p.priceLabel === 'UNIT_LIST_PRICE') ??
      line.prices.find((p) => p.priceLabel === 'LINE_TOTAL_PRICE_NOVAT');

    if (!unitPrice || typeof unitPrice.price.amount !== 'number') {
      throw new FetchError({
        code: 'PARSE_ERROR',
        supplierId: this.supplierId,
        message: `Prix introuvable dans la réponse Rexel pour ${reference}.`,
        retryable: false,
      });
    }

    // Stock: in stock if any delivery availability has available > 0
    const hasStock = line.availabilities?.some(
      (a) =>
        a.type === 'DELIVERY_BRANCH_AVAILABILITY' && (a.quantity?.available ?? 0) > 0
    ) ?? false;

    return {
      prix_ht: unitPrice.price.amount,
      stock: hasStock ? 1 : 0,
      unite: 'pièce',
      fetchedAt: new Date().toISOString(),
    };
  }
}

