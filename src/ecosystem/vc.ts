// Signed credentials (Skill Passport, audits, contracts), shaped like a W3C Verifiable Credential.
// Pure Web Crypto, so the same code signs on the Node server and checks in the browser.

export type CredentialKind = 'SkillCredential' | 'AuditCredential' | 'ContractCredential';
export type Alg = 'Ed25519' | 'ES256';

export interface Credential {
  '@context': string[];
  id: string;
  type: CredentialKind;
  issuer: string;
  issuedAt: string;
  subject: Record<string, unknown>;
  proof: { alg: Alg; keyId: string; signature: string };
}

export interface IssuerKey {
  keyId: string;
  alg: Alg;
  /** public key as JWK, safe to share */
  publicJwk: JsonWebKey;
  /** human label: where this key lives */
  label: string;
}

export const ISSUER = 'did:web:sangam.example';
const CONTEXT = ['https://www.w3.org/ns/credentials/v2', 'https://sangam.example/credentials/v1'];

const subtle = () => globalThis.crypto.subtle;
const params = (alg: Alg) => (alg === 'Ed25519' ? { name: 'Ed25519' } : { name: 'ECDSA', namedCurve: 'P-256' });
const signParams = (alg: Alg) => (alg === 'Ed25519' ? { name: 'Ed25519' } : { name: 'ECDSA', hash: 'SHA-256' });

/** JSON with sorted keys, so the same credential always signs to the same bytes. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

const b64url = (buf: ArrayBuffer) => {
  let s = '';
  new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const bytes = (s: string) => new TextEncoder().encode(s);

/** Make a new signing key. Ed25519 where supported, ECDSA P-256 otherwise (older browsers). */
export async function generateIssuerKey(label: string): Promise<{ key: IssuerKey; privateJwk: JsonWebKey }> {
  for (const alg of ['Ed25519', 'ES256'] as Alg[]) {
    try {
      const pair = (await subtle().generateKey(params(alg), true, ['sign', 'verify'])) as CryptoKeyPair;
      const publicJwk = await subtle().exportKey('jwk', pair.publicKey);
      const privateJwk = await subtle().exportKey('jwk', pair.privateKey);
      const keyId = `${ISSUER}#${(publicJwk.x ?? '').slice(0, 12)}`;
      return { key: { keyId, alg, publicJwk, label }, privateJwk };
    } catch { /* try the next algorithm */ }
  }
  throw new Error('This browser cannot create signing keys');
}

const payload = (c: Omit<Credential, 'proof'>) => bytes(canonical({ '@context': c['@context'], id: c.id, type: c.type, issuer: c.issuer, issuedAt: c.issuedAt, subject: c.subject }));

export async function signCredential(type: CredentialKind, subject: Record<string, unknown>, key: IssuerKey, privateJwk: JsonWebKey): Promise<Credential> {
  const body = { '@context': CONTEXT, id: `urn:uuid:${globalThis.crypto.randomUUID()}`, type, issuer: ISSUER, issuedAt: new Date().toISOString(), subject };
  const priv = await subtle().importKey('jwk', privateJwk, params(key.alg), false, ['sign']);
  const sig = await subtle().sign(signParams(key.alg), priv, payload(body));
  return { ...body, proof: { alg: key.alg, keyId: key.keyId, signature: b64url(sig) } };
}

export type VerifyResult =
  | { ok: true; key: IssuerKey }
  | { ok: false; reason: 'malformed' | 'unknown-issuer' | 'tampered'; detail: string };

/** Check a credential against the issuer keys this verifier trusts. */
export async function verifyCredential(input: unknown, trusted: IssuerKey[]): Promise<VerifyResult> {
  const c = input as Credential;
  if (!c || typeof c !== 'object' || !c.proof?.signature || !c.subject || !c.type) {
    return { ok: false, reason: 'malformed', detail: 'This is not a Sangam credential: it has no subject, type or signature.' };
  }
  const key = trusted.find((k) => k.keyId === c.proof.keyId && k.alg === c.proof.alg);
  if (!key || c.issuer !== ISSUER) {
    return { ok: false, reason: 'unknown-issuer', detail: 'Signed by a key Sangam does not recognise. Anyone can make a key, so this proves nothing.' };
  }
  try {
    const pub = await subtle().importKey('jwk', key.publicJwk, params(key.alg), false, ['verify']);
    const good = await subtle().verify(signParams(key.alg), pub, unb64url(c.proof.signature), payload(c));
    return good ? { ok: true, key } : { ok: false, reason: 'tampered', detail: 'The signature does not match the contents. Something was changed after Sangam signed it.' };
  } catch {
    return { ok: false, reason: 'tampered', detail: 'The signature could not be read. It was damaged or edited.' };
  }
}

export const KIND_LABEL: Record<CredentialKind, string> = {
  SkillCredential: 'Skill', AuditCredential: 'Fair-work audit', ContractCredential: 'Contract',
};
