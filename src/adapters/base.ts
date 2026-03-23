/**
 * src/adapters/base.ts
 *
 * Abstract base class for all supplier adapters.
 * Every adapter must implement getPrice().
 * authenticate() is optional for suppliers with public prices (e.g. materielelectrique.com).
 */

import type { SupplierPrice } from '@/types';

export abstract class SupplierAdapter {
  abstract readonly supplierId: string;

  /**
   * Fetch price and stock for a single product reference.
   * @param reference - The supplier-specific product reference (e.g. 'LEG067128')
   * @throws {FetchError} on network failure, rate-limit, or parse error
   */
  abstract getPrice(reference: string): Promise<SupplierPrice>;

  /**
   * Authenticate against the supplier API and persist the session token.
   * Not required for suppliers with public prices.
   */
  async authenticate(
    _login: string,
    _password: string
  ): Promise<{ success: boolean; token: string }> {
    return { success: true, token: '' };
  }
}
