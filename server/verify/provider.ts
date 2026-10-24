// How Sangam asks "is this a real business?". One interface, so the demo (mock registry, works offline) and a real
// verification aggregator (GSTIN, Udyam and CIN endpoints) are interchangeable. Never scrape the GST or Udyam portals.
import type { Provenance } from '../../src/types';
import { mockProvider } from './mock';

export interface RegistryRecord {
  legalName: string;
  status: 'active' | 'cancelled' | 'inactive';
  /** state code or name as the registry gives it, when it does */
  state?: string;
}

export interface VerifyProvider {
  /** shown in the verification record */
  name: string;
  /** what a positive result is worth: 'simulated' for the mock, 'verified' for a real registry */
  provenance: Provenance;
  checkGstin(gstin: string): Promise<RegistryRecord | null>;
  checkUdyam(udyam: string): Promise<RegistryRecord | null>;
  checkCin(cin: string): Promise<RegistryRecord | null>;
}

/**
 * The mock registry unless a real provider is configured. VERIFY_PROVIDER, VERIFY_BASE_URL and VERIFY_API_KEY select a real one;
 * no aggregator adapter exists yet (which one to use is still an open decision), so asking for one fails loudly instead of silently mocking.
 * DigiLocker needs NeGD approval through API Setu and is out of scope; an adapter for it would implement this same interface.
 */
export function selectProvider(env: Record<string, string | undefined> = process.env): VerifyProvider {
  if (env.VERIFY_API_KEY) {
    throw new Error(`VERIFY_API_KEY is set but there is no adapter for VERIFY_PROVIDER=${env.VERIFY_PROVIDER ?? '(unset)'} yet. Remove the key to use the mock registry.`);
  }
  return mockProvider;
}
