// A deterministic stand-in for a business registry, so signup and verification work offline in the demo.
// Every result it gives is tagged `simulated`. The numbers below are made up for the prototype; the GSTINs carry valid check characters.
import type { RegistryRecord, VerifyProvider } from './provider';
import { gstinCheckChar } from './formats';

const gstin = (first14: string) => first14 + gstinCheckChar(first14);

/** Test numbers a demo (and the tests) can type in. */
export const FIXTURES = {
  gstin: { active: gstin('27AAAAS1234A1Z'), cancelled: gstin('33AAAAK5678B1Z'), unknown: gstin('29AAAAU9999Z1Z') },
  udyam: { active: 'UDYAM-TN-20-0001234', unknown: 'UDYAM-TN-20-0009999' },
  cin: { active: 'U31300TN2015PTC100001', unknown: 'U31300TN2015PTC999999' },
};

const GSTIN: Record<string, RegistryRecord> = {
  [FIXTURES.gstin.active]: { legalName: 'Satara Gramin Assembly Co-operative Society', status: 'active', state: 'Maharashtra' },
  [FIXTURES.gstin.cancelled]: { legalName: 'Krishnagiri Mahila Harness Collective', status: 'cancelled', state: 'Tamil Nadu' },
};
const UDYAM: Record<string, RegistryRecord> = {
  [FIXTURES.udyam.active]: { legalName: 'Krishnagiri Mahila Harness Collective', status: 'active', state: 'Tamil Nadu' },
};
const CIN: Record<string, RegistryRecord> = {
  [FIXTURES.cin.active]: { legalName: 'Chakan Harness Systems Private Limited', status: 'active', state: 'Tamil Nadu' },
};

export const mockProvider: VerifyProvider = {
  name: 'mock',
  provenance: 'simulated',
  checkGstin: async (n) => GSTIN[n] ?? null,
  checkUdyam: async (n) => UDYAM[n] ?? null,
  checkCin: async (n) => CIN[n] ?? null,
};
