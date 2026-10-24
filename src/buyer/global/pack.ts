// The labour due-diligence pack a global buyer downloads for a quote: supplier verification,
// Fair Work Scorecard, credentials and the export route, as JSON and as a printable page.
import { district } from '../../engine';
import type { Quote, Requirement, StoreState } from '../../model';
import type { ExportRoute } from '../../routes';
import { bidderName, bidderSellers } from '../../tco';
import { checksFor, trustScore } from '../../trust';
import { countryOf, fmt, RATES_AS_OF } from './settings';
import type { GlobalBuyer } from './settings';

export interface DueDiligencePack {
  generatedAt: string;
  note: string;
  buyer: { country: string; currency: string; ratesAsOf: string; rates: Record<string, number>; ratesSource: 'public' };
  requirement: { id: string; part: string; monthlyVolume: number; spec: string };
  quote: { bidder: string; unitPriceInr: number; unitPrice: string; landedPerUnit: string | null; leadDays: number; moq: number };
  suppliers: {
    id: string; name: string; type: string; district: string; state: string; workers: number; share: number;
    verification: { identity: string; capacity: string; certificates: Record<string, string> };
    trustScore: number; trustBand: string; dataSource: string;
    fairWork: unknown;
  }[];
  credentials: unknown[];
  route: null | { from: string; to: string; days: number; distanceKm: number; legs: { title: string; place: string; days: number; costPerUnit: string; documents: string[]; risks: string[]; source: string }[] };
}

/** Latest scorecard from the server (P1's route, P3's scoring); null until those land or if it fails. */
async function scorecard(supplierId: string): Promise<unknown> {
  try {
    const r = await fetch(`/api/scorecard/${encodeURIComponent(supplierId)}`);
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

export async function buildPack(q: Quote, req: Requirement, state: StoreState, g: GlobalBuyer, route: ExportRoute | null): Promise<DueDiligencePack> {
  const members = bidderSellers(q.bidder, state);
  const suppliers = await Promise.all(members.map(async ({ seller, share }) => {
    const d = district(seller.districtId);
    const c = checksFor(seller, state);
    const t = trustScore(seller, state);
    return {
      id: seller.id, name: seller.name, type: seller.type, district: d.name, state: d.state, workers: seller.workers, share,
      verification: { identity: c.identity, capacity: c.capacity, certificates: c.certs },
      trustScore: t.score, trustBand: t.band, dataSource: seller.origin === 'simulated' ? 'simulated' : 'declared',
      fairWork: (await scorecard(seller.id)) ?? { status: 'not scored yet' },
    };
  }));
  return {
    generatedAt: new Date().toISOString(),
    note: 'Prepared by Sangam. Figures carry their source; exchange rates are a fixed table, not live.',
    buyer: { country: countryOf(g.country).name, currency: g.currency, ratesAsOf: RATES_AS_OF, rates: g.rates, ratesSource: 'public' },
    requirement: { id: req.id, part: req.title, monthlyVolume: req.monthlyVolume, spec: req.spec },
    quote: { bidder: bidderName(q.bidder, state), unitPriceInr: q.unitPrice, unitPrice: fmt(q.unitPrice, g), landedPerUnit: route ? fmt(q.unitPrice + route.costPerUnit, g) : null, leadDays: q.leadDays, moq: q.moq },
    suppliers,
    credentials: [],
    route: route && {
      from: suppliers.map((s) => s.district).join(' + '), to: route.lane.port, days: route.days, distanceKm: Math.round(route.distanceKm),
      legs: route.legs.map((l) => ({ title: l.title, place: l.place, days: l.days, costPerUnit: fmt(l.cost, g), documents: l.documents, risks: l.risks, source: l.src })),
    },
  };
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

function grade(f: unknown): string {
  const s = f as { grade?: string; status?: string; benchmarkSource?: string };
  return s?.grade ? `Grade ${esc(s.grade)}${s.benchmarkSource ? ` <small>(benchmark: ${esc(s.benchmarkSource)})</small>` : ''}` : esc(s?.status ?? 'not scored yet');
}

export function packHtml(p: DueDiligencePack): string {
  const rows = (pairs: [string, unknown][]) => pairs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v as string}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Due-diligence pack: ${esc(p.quote.bidder)}</title>
<style>
body{font-family:Inter,system-ui,sans-serif;color:#111111;margin:32px auto;max-width:820px;padding:0 16px;line-height:1.5;font-size:14px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid #eaeaea;padding-bottom:4px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px 8px;border-top:1px solid #eaeaea;vertical-align:top}th{width:34%;color:#6b6a66;font-weight:500}
.muted{color:#6b6a66}.tag{font-size:11px;font-weight:600;padding:1px 6px;border-radius:4px;background:#f1f0ec;color:#5f5e5a}
button{font:inherit;padding:8px 16px;border-radius:8px;border:1px solid #3d5a45;background:#3d5a45;color:#fff;cursor:pointer}
@media print{button{display:none}body{margin:0}}
</style></head><body>
<button onclick="print()">Print or save as PDF</button>
<h1>Labour due-diligence pack</h1>
<p class="muted">${esc(p.quote.bidder)} for ${esc(p.requirement.part)} · prepared ${esc(p.generatedAt.slice(0, 10))} for a buyer in ${esc(p.buyer.country)}</p>
<h2>Quote</h2><table>${rows([
    ['Unit price', `${esc(p.quote.unitPrice)} (₹${p.quote.unitPriceInr.toLocaleString('en-IN')})`],
    ['Landed at destination port, per unit', p.quote.landedPerUnit ? `${esc(p.quote.landedPerUnit)} <span class="tag">Estimate</span>` : 'Domestic buyer'],
    ['Lead time', `${p.quote.leadDays} days`], ['Minimum order', p.quote.moq.toLocaleString('en-IN')], ['Monthly volume', p.requirement.monthlyVolume.toLocaleString('en-IN')],
  ])}</table>
${p.suppliers.map((s) => `<h2>Supplier: ${esc(s.name)}</h2><table>${rows([
    ['Organisation', `${esc(s.type)}, ${esc(s.district)}, ${esc(s.state)}`], ['Workers', `${s.workers} <span class="tag">${esc(s.dataSource)}</span>`],
    ['Share of this order', `${Math.round(s.share * 100)}%`], ['Identity check', esc(s.verification.identity)], ['Capacity check', esc(s.verification.capacity)],
    ['Certificates', Object.entries(s.verification.certificates).map(([c, v]) => `${esc(c)}: ${esc(v)}`).join('<br>') || 'None declared'],
    ['Sangam trust score', `${s.trustScore} / 100 (${esc(s.trustBand)})`], ['Fair Work Scorecard', grade(s.fairWork)],
  ])}</table>`).join('')}
<h2>Signed credentials</h2><p>${p.credentials.length ? `${p.credentials.length} credential(s) attached in the JSON file.` : 'None issued yet. Credentials are signed when the Auditor passes a deal.'}</p>
${p.route ? `<h2>Export route: ${esc(p.route.from)} to ${esc(p.route.to)}</h2><p class="muted">About ${p.route.days} days, ${p.route.distanceKm.toLocaleString('en-IN')} km. Costs are indicative <span class="tag">Estimate</span></p>
<table><tr><th>Leg</th><td><b>Days · cost per unit · documents</b></td></tr>${p.route.legs.map((l) => `<tr><th>${esc(l.title)}<br><small>${esc(l.place)}</small></th><td>${l.days} · ${esc(l.costPerUnit)}${l.documents.length ? ` · ${esc(l.documents.join(', '))}` : ''}${l.risks.length ? `<br><small>Risks: ${esc(l.risks.join('; '))}</small>` : ''}</td></tr>`).join('')}</table>` : ''}
<h2>Exchange rates</h2><p>${Object.entries(p.buyer.rates).filter(([c]) => c !== 'INR').map(([c, r]) => `1 ${esc(c)} = ₹${r}`).join(' · ')}, ECB reference rates as of ${esc(p.buyer.ratesAsOf)} <span class="tag">Public data</span></p>
<p class="muted"><small>${esc(p.note)}</small></p>
</body></html>`;
}

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadPack(p: DueDiligencePack, kind: 'html' | 'json') {
  const base = `sangam-due-diligence-${p.requirement.id}-${p.quote.bidder.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  if (kind === 'json') download(`${base}.json`, JSON.stringify(p, null, 2), 'application/json');
  else download(`${base}.html`, packHtml(p), 'text/html');
}
