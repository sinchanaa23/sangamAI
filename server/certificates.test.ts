import { describe, expect, it } from 'vitest';
import { checkCertificate, readCertificate } from './certificates';
import type { CertificateFields } from './certificates';
import type { Ask } from './llm';

const good: CertificateFields = {
  documentType: 'ISO 9001 certificate', standard: 'ISO 9001:2015', holderName: 'Pune Precision Connectors Pvt Ltd', certificateNumber: 'QMS-2291',
  issuer: 'Bureau Veritas', issueDate: '2024-02-01', expiryDate: '2027-01-31', scope: 'Connectors', confidence: 'high', notes: '',
};
const today = new Date('2026-10-24');

describe('certificate checks', () => {
  it('accepts a complete, in-date certificate for the right holder', () => {
    const c = checkCertificate(good, { holderName: 'Pune Precision Connectors', today });
    expect(c).toMatchObject({ verdict: 'ok', notExpired: true, holderMatches: true, readable: true, problems: [] });
  });

  it('sends an expired certificate to review', () => {
    const c = checkCertificate({ ...good, expiryDate: '2025-12-31' }, { today });
    expect(c.verdict).toBe('needs-review');
    expect(c.notExpired).toBe(false);
    expect(c.problems.join(' ')).toContain('Expired on 2025-12-31');
  });

  it('flags a holder who is not the supplier, a missing number, and a low-confidence reading', () => {
    expect(checkCertificate(good, { holderName: 'Krishnagiri Mahila Harness Collective', today }).holderMatches).toBe(false);
    expect(checkCertificate({ ...good, certificateNumber: ' ' }, { today }).readable).toBe(false);
    expect(checkCertificate({ ...good, confidence: 'low' }, { today }).verdict).toBe('needs-review');
  });

  it('treats a missing expiry date as something a person must look at', () => {
    const c = checkCertificate({ ...good, expiryDate: '' }, { today });
    expect(c.notExpired).toBeNull();
    expect(c.verdict).toBe('needs-review');
  });

  it('sends the file to the vision model and checks what comes back', async () => {
    let seenFiles = 0;
    const ask: Ask = async (o) => { seenFiles = o.files?.length ?? 0; expect(o.role).toBe('vision'); return good as never; };
    const r = await readCertificate(ask, { mediaType: 'image/png', data: 'AAAA', filename: 'iso.png' });
    expect(seenFiles).toBe(1);
    expect(r.fields.certificateNumber).toBe('QMS-2291');
    expect(r.checks.numberPresent).toBe(true);
  });
});
