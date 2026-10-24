// Offline checks on business numbers and names. These run before any registry is asked, so a mistyped number never costs a lookup,
// and an Aadhaar number is refused outright: Sangam never collects or stores one.

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The check character of a GSTIN, from its first 14 characters (the published mod-36 scheme). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]!);
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36]!;
}

export const clean = (s: string) => s.replace(/\s+/g, '').toUpperCase();

export const isGstin = (n: string) => /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(n) && n[14] === gstinCheckChar(n.slice(0, 14));
export const isUdyam = (n: string) => /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(n);
export const isCin = (n: string) => /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(n);

/** Twelve digits, with or without spaces: shaped like an Aadhaar number. Refused, never looked up or stored. */
export const looksLikeAadhaar = (raw: string) => /^\d{4}[\s-]?\d{4}[\s-]?\d{4}$/.test(raw.trim());

const STOP = new Set(['pvt', 'private', 'ltd', 'limited', 'llp', 'the', 'and', 'of', 'co', 'op', 'coop', 'cooperative', 'operative', 'society', 'company', 'inc']);
const tokens = (s: string) => (s.toLowerCase().replace(/&/g, ' and ').match(/[a-z0-9]+/g) ?? []).filter((t) => !STOP.has(t));

/** Do two business names refer to the same business? Legal suffixes and punctuation are ignored; most of the shorter name must appear in the other. */
export function namesMatch(a: string, b: string): boolean {
  const x = tokens(a), y = new Set(tokens(b));
  if (!x.length || !y.size) return false;
  const [short, long] = x.length <= y.size ? [x, y] : [[...y], new Set(x)];
  return short.filter((t) => long.has(t)).length / short.length >= 0.6;
}

const FREE_MAIL = new Set(['gmail', 'yahoo', 'outlook', 'hotmail', 'rediffmail', 'proton', 'icloud', 'live']);
/** For buyers: does the work email's domain look like the legal name? Informational; free mail providers say nothing. */
export function emailDomainHint(email: string, legalName: string): 'matches' | 'does-not-match' | 'free-mail' {
  const domain = email.split('@')[1]?.split('.')[0] ?? '';
  if (!domain || FREE_MAIL.has(domain.toLowerCase())) return 'free-mail';
  return tokens(legalName).some((t) => domain.toLowerCase().includes(t) || t.includes(domain.toLowerCase())) ? 'matches' : 'does-not-match';
}
