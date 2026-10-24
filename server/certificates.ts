// Certificate reading and checking. A model reads the document; plain code checks what it read, so a certificate is never
// accepted on the model's word alone. Used by supplier onboarding (POST /api/extract-certificate) and the Auditor.
import { z } from 'zod';
import type { Ask } from './llm';

export const Certificate = z.object({
  documentType: z.string().describe('For example: ISO 9001 certificate, BIS licence, FSSAI licence, Udyam registration'),
  standard: z.string().describe('Standard or scheme named on the document, or empty'),
  holderName: z.string(),
  certificateNumber: z.string(),
  issuer: z.string(),
  issueDate: z.string().describe('YYYY-MM-DD if visible, else empty'),
  expiryDate: z.string().describe('YYYY-MM-DD if visible, else empty'),
  scope: z.string().describe('Products or processes covered, or empty'),
  confidence: z.enum(['low', 'medium', 'high']),
  notes: z.string().describe('Anything that looks unclear, altered or inconsistent'),
});
export type CertificateFields = z.infer<typeof Certificate>;

export interface CertificateChecks {
  numberPresent: boolean;
  issuerPresent: boolean;
  /** null when the document shows no expiry date */
  notExpired: boolean | null;
  /** null when no holder name was given to compare with */
  holderMatches: boolean | null;
  readable: boolean;
  /** 'ok' only when everything checkable passed; anything else goes to the Verification desk */
  verdict: 'ok' | 'needs-review';
  problems: string[];
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);

export function checkCertificate(f: CertificateFields, opts: { holderName?: string; today?: Date } = {}): CertificateChecks {
  const startOfToday = new Date(opts.today ?? new Date()).setHours(0, 0, 0, 0);
  const expiry = Date.parse(f.expiryDate);
  const notExpired = Number.isFinite(expiry) ? expiry >= startOfToday : null;
  let holderMatches: boolean | null = null;
  if (opts.holderName && f.holderName) {
    const a = words(opts.holderName), b = words(f.holderName);
    holderMatches = [...a].filter((w) => b.has(w)).length >= Math.min(2, a.size); // two shared words, or all of a one-word name
  }
  const problems = [
    ...(f.certificateNumber.trim() ? [] : ['No certificate number could be read.']),
    ...(f.issuer.trim() ? [] : ['No issuing body could be read.']),
    ...(notExpired === false ? [`Expired on ${f.expiryDate}.`] : []),
    ...(notExpired === null ? ['No expiry date on the document.'] : []),
    ...(holderMatches === false ? [`The holder "${f.holderName}" does not match "${opts.holderName}".`] : []),
    ...(f.confidence === 'low' ? ['The reading is low confidence.'] : []),
    ...(f.notes.trim() ? [`Reader note: ${f.notes.trim()}`] : []),
  ];
  const readable = Boolean(f.certificateNumber.trim() && f.issuer.trim()) && f.confidence !== 'low';
  return {
    numberPresent: Boolean(f.certificateNumber.trim()), issuerPresent: Boolean(f.issuer.trim()), notExpired, holderMatches, readable,
    verdict: problems.length ? 'needs-review' : 'ok', problems,
  };
}

export async function readCertificate(ask: Ask, file: { mediaType: string; data: string; filename: string }, holderName?: string) {
  const fields = await ask({
    role: 'vision', schema: Certificate, files: [file], timeoutMs: 45_000,
    system: 'You read certificates and licences uploaded by Indian suppliers. Reply with ONE JSON object only, in exactly the requested fields.',
    user: `Read this document uploaded to a supplier profile (${file.filename}). Extract the fields exactly as printed; leave a field empty if it is not on the document. Do not guess. Fields: documentType, standard, holderName, certificateNumber, issuer, issueDate (YYYY-MM-DD), expiryDate (YYYY-MM-DD), scope, confidence ("low"|"medium"|"high"), notes (anything unclear, altered or inconsistent).`,
  });
  return { fields, checks: checkCertificate(fields, { holderName }) };
}
