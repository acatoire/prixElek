/**
 * src/adapters/rexel.ts
 */

import axios from 'axios';
import { SupplierAdapter } from './base';
import { FetchError } from '@/types/error';
import type { SupplierPrice } from '@/types/price';

const API_URL = 'https://eu.dif.rexel.com/web/api/v3/product/priceandavailability';
const BANNER = 'frx';

// ── JWT helpers ───────────────────────────────────────────────────────────────

interface RexelJwtPayload {
  ERPCustomerID?: { accountNumber?: string };
  api_key?: string;
  WebshopID?: { webshopId?: string };
  exp?: number;
}

/** Decode the middle (payload) segment of a JWT without verifying the signature. */
export function decodeRexelToken(jwt: string): RexelJwtPayload {
  try {
    const seg = jwt.split('.')[1] ?? '';
    const pad = (4 - (seg.length % 4)) % 4;
    const b64 = (seg + '='.repeat(pad)).replace(/-/g, '+').replace(/_/g, '/');
    // Works in both browser (atob) and Node (Buffer)
    const json = typeof Buffer !== 'undefined'
      ? Buffer.from(b64, 'base64').toString('utf-8')
      : atob(b64);
    return JSON.parse(json) as RexelJwtPayload;
  } catch {
    return {};
  }
}

/** Extract the account number required by the price API. */
export function extractAccountId(jwt: string): string {
  return decodeRexelToken(jwt).ERPCustomerID?.accountNumber ?? '';
}

/** Extract the webshop ID from the JWT (e.g. "FRW"). */
export function extractWebshopId(jwt: string): string {
  return decodeRexelToken(jwt).WebshopID?.webshopId ?? '';
}

/** Extract the api_key from the JWT. */
export function extractApiKey(jwt: string): string {
  return decodeRexelToken(jwt).api_key ?? '';
}

// ── Credentials ───────────────────────────────────────────────────────────────

/**
 * Everything needed to call the price API.
 * branchId, zipcode and city are the user's local agency info, NOT in the JWT.
 */
export interface RexelCredentials {
  token: string;
  branchId: string;
  zipcode: string;
  city: string;
}

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
  private readonly accountId: string;
  private readonly branchId: string;
  private readonly zipcode: string;
  private readonly city: string;

  constructor(credentials: RexelCredentials) {
    super();
    this.token = credentials.token;
    this.accountId = extractAccountId(credentials.token);
    this.branchId = credentials.branchId;
    this.zipcode = credentials.zipcode;
    this.city = credentials.city;
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
    if (!this.accountId) {
      throw new FetchError({
        code: 'AUTH_ERROR',
        supplierId: this.supplierId,
        message: 'Token Rexel invalide : accountId introuvable dans le JWT.',
        retryable: false,
      });
    }
    if (!this.branchId) {
      throw new FetchError({
        code: 'AUTH_ERROR',
        supplierId: this.supplierId,
        message: 'Code agence Rexel manquant — veuillez le renseigner dans la connexion.',
        retryable: false,
      });
    }

    let data: RexelResponse;
    try {
      const response = await axios.post<RexelResponse>(
        API_URL,
        {
          accountId: this.accountId,
          branchId: this.branchId,
          pickupOptions: { branchCode: this.branchId },
          deliveryOptions: {
            branchCode: this.branchId,
            location: { country: 'FR', zipcode: this.zipcode, city: this.city },
          },
          stockReturnedOptions: {
            includeDCStock: true,
            includeBranchStock: true,
            includeDelay: true,
          },
          includeLeasePrice: true,
          // quantity MUST be an object {number: N} — primitive triggers "Failed to read request"
          lines: [{ sku: reference, quantity: { number: 1 } }],
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'Content-Language': 'fr',
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
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
        if (status === 400) {
          const detail = JSON.stringify(err.response?.data ?? {});
          throw new FetchError({
            code: 'PARSE_ERROR',
            supplierId: this.supplierId,
            message: `Requête invalide (400) — ${detail}`,
            statusCode: 400,
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

    const hasStock = line.availabilities?.some(
      (a) => a.type === 'DELIVERY_BRANCH_AVAILABILITY' && (a.quantity?.available ?? 0) > 0
    ) ?? false;

    return {
      prix_ht: unitPrice.price.amount,
      stock: hasStock ? 1 : 0,
      unite: 'pièce',
      fetchedAt: new Date().toISOString(),
    };
  }
}

