// Helpers for building sector templates. Detail fields of demo companies are generated
// deterministically from their id so they stay the same between visits. They are simulated.
import type { CertInfo, OrgType, Seller, SellerDetails } from '../types';
import { RURAL_TYPES } from '../types';

export function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ISSUERS: Record<string, string> = {
  'ISO 9001': 'Accredited certification body (NABCB)',
  'IATF 16949': 'IATF-recognised certification body',
  'ISO 13485': 'Accredited certification body (NABCB)',
  'FSSAI licence': 'Food Safety and Standards Authority of India',
  HACCP: 'Accredited certification body',
  'FSSAI packaging compliance': 'FSSAI-notified laboratory',
};
const issuerFor = (c: string) => ISSUERS[c] ?? (c.startsWith('BIS') ? 'Bureau of Indian Standards' : c.includes('training') ? 'Industry training partner' : 'Third-party assessor');

const LANG: Record<string, string[]> = {
  'Tamil Nadu': ['Tamil', 'English'], Karnataka: ['Kannada', 'English'], Maharashtra: ['Marathi', 'Hindi', 'English'],
  Gujarat: ['Gujarati', 'Hindi', 'English'], 'Dadra and Nagar Haveli': ['Gujarati', 'Hindi'], Haryana: ['Hindi', 'English'],
  'Uttar Pradesh': ['Hindi', 'English'], Punjab: ['Punjabi', 'Hindi'], 'Madhya Pradesh': ['Hindi'], Jharkhand: ['Hindi'],
  'West Bengal': ['Bengali', 'Hindi'], Odisha: ['Odia', 'Hindi'], 'Andhra Pradesh': ['Telugu', 'English'], Kerala: ['Malayalam', 'English'],
  Assam: ['Assamese', 'Hindi'], Tripura: ['Bengali', 'Kokborok'],
};

export interface SellerSeed {
  id: string;
  name: string;
  type: OrgType;
  districtId: string;
  process: string;
  monthlyCapacity: number;
  certs: string[];
  priceIndex: number;
  quality: number;
  verification: 'verified' | 'declared';
  workers: number;
  machines: string[];
  about: string;
}

export function makeSeller(s: SellerSeed, state: string): Seller {
  const r = rng(s.id + s.name);
  const rural = RURAL_TYPES.includes(s.type);
  const year = 2026;
  const details: SellerDetails = {
    yearsInBusiness: rural ? 3 + Math.floor(r() * 9) : 6 + Math.floor(r() * 28),
    turnoverCr: +(rural ? 0.4 + r() * 5 : 6 + r() * 70).toFixed(1),
    creditBand: rural ? (r() > 0.6 ? 'B' : 'Not rated') : (['A', 'BBB', 'BBB', 'BB'] as const)[Math.floor(r() * 4)],
    utilisationPct: Math.round(52 + r() * 36),
    defectPpm: Math.round((1 - s.quality) * 6000 * (0.8 + r() * 0.4)),
    otifPct: Math.min(99, Math.round(78 + s.quality * 18 + (r() - 0.5) * 6)),
    completedOrders: Math.round((rural ? 4 : 30) + r() * (rural ? 30 : 220)),
    machines: s.machines,
    certDetails: s.certs.map((c) => ({ name: c, issuer: issuerFor(c), expires: `${year + 1 + Math.floor(r() * 3)}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-28` })),
    languages: LANG[state] ?? ['Hindi', 'English'],
    about: s.about,
  };
  const { machines: _m, about: _a, ...rest } = s;
  void _m; void _a;
  return { ...rest, details, origin: 'simulated' };
}

export const CERTS_COMMON: Record<string, CertInfo> = {
  'ISO 9001': { costLakh: 2, months: 3, labelHi: 'ISO 9001 प्रमाणन', schemes: ['MSME ZED certification support'] },
  'ISO 13485': { costLakh: 12, months: 8, labelHi: 'ISO 13485 प्रमाणन', schemes: ['MSME ZED certification support'] },
};
