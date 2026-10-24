// Sample activity so each sector's workspaces aren't empty on first visit. Every record is flagged `sample`.
import { active, bom, buyer, sellers } from './data';
import { isImported, leadDaysFrom } from './engine';
import { rng } from './sectors/helpers';
import type { Interest, Quote, Requirement, Review } from './model';
import type { WorkforceProfile, WorkforceSkill } from './fairwork';

const day = (offset: number) => new Date(Date.now() + offset * 864e5).toISOString();
const month = (m: number) => {
  const d = new Date(); d.setMonth(d.getMonth() + m, 1);
  return d.toISOString().slice(0, 10);
};

const REVIEW_TEXT = {
  good: ['Consistent quality across batches; first-pass yield improved after their process audit.', 'Delivered on time through the monsoon season. Responsive team.', 'Documentation was complete and audits went smoothly.'],
  mixed: ['Quality is good but they needed two rounds of samples before approval.', 'Prices are competitive; delivery slipped twice during festival season.', 'Good partner for smaller volumes; capacity was tight on a large order.'],
};

export function seedSector() {
  const sector = active.sector;
  const r = rng(`seed-${sector}`);
  const firmness: Requirement['firmness'][] = ['rfq', 'exploring', 'committed'];
  const requirements: Requirement[] = bom.filter(isImported).map((l, i) => ({
    id: `req-${sector}-${l.id}`, sector, lineId: l.id, title: l.name, process: l.process, spec: l.spec,
    monthlyVolume: buyer.monthlyUnits, startBy: month(5 + i * 3), firmness: firmness[i % 3], targetPrice: Math.round(l.cost * 0.95),
    visibility: i === 2 ? 'named' : 'anonymous', invited: [], showTarget: i === 2, exactVolume: i !== 1,
    status: 'open', createdAt: day(-20 + i * 3), sample: true,
  }));

  const quotes: Quote[] = [];
  const interests: Interest[] = [];
  requirements.forEach((req, i) => {
    const line = bom.find((l) => l.id === req.lineId)!;
    const bidders = sellers.filter((s) => s.process === req.process).slice(0, req.firmness === 'rfq' ? 3 : 2);
    bidders.forEach((s, j) => {
      if (req.firmness === 'rfq' || (req.firmness === 'committed' && j === 0)) {
        quotes.push({
          id: `q-${req.id}-${s.id}`, reqId: req.id, bidder: { kind: 'seller', id: s.id },
          unitPrice: Math.round(line.cost * s.priceIndex * (0.97 + r() * 0.08)), moq: Math.round(buyer.monthlyUnits * (0.1 + r() * 0.2)),
          leadDays: leadDaysFrom(s.districtId) + Math.round(r() * 6), paymentDays: [30, 45, 60][Math.floor(r() * 3)], validityDays: 90,
          toolingLakh: Math.round(r() * 12 * 10) / 10, capacity: s.monthlyCapacity, notes: j === 0 ? 'Includes PPAP documents and first-article inspection.' : '',
          at: day(-10 + j), status: 'submitted', sample: true,
        });
      } else {
        interests.push({ id: `i-${req.id}-${s.id}`, reqId: req.id, bidder: { kind: 'seller', id: s.id }, note: 'We can supply this; please share the drawing.', at: day(-5 + i), sample: true });
      }
    });
  });

  const reviews: Review[] = [];
  sellers.filter((s) => s.origin === 'simulated').forEach((s) => {
    const n = Math.floor(r() * 3) + (s.details.completedOrders > 40 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const good = r() < s.quality;
      const base = good ? 4 + (r() > 0.5 ? 1 : 0) : 3 + (r() > 0.6 ? 1 : 0);
      const jitter = () => Math.max(1, Math.min(5, base + (r() > 0.7 ? -1 : 0)));
      const partner = r() < 0.3;
      reviews.push({
        id: `rv-${s.id}-${k}`, sellerId: s.id,
        author: partner ? 'Consortium partner (MSME)' : ['Two-wheeler maker, Tamil Nadu', 'Appliance maker, Maharashtra', 'Developer, Pune', 'Food brand, Karnataka', 'Tier-1 supplier, Gujarat'][Math.floor(r() * 5)],
        authorType: partner ? 'partner' : 'buyer',
        orderRef: `PO-${2024 + Math.floor(r() * 2)}-${1000 + Math.floor(r() * 9000)}`, orderValueLakh: Math.round(5 + r() * 120),
        ratings: { quality: jitter(), delivery: jitter(), communication: jitter(), compliance: jitter() },
        text: (good ? REVIEW_TEXT.good : REVIEW_TEXT.mixed)[Math.floor(r() * 3)],
        evidence: 'Purchase order and goods receipt notes', status: r() < 0.75 ? 'verified' : 'pending',
        verifierNote: undefined, at: day(-200 + Math.floor(r() * 180)), sample: true,
      });
    }
  });
  return { requirements, quotes, interests, reviews };
}

// ---------- Fair-work seed workforces (features F4 and F5) ----------
// Demo workforces for the EV story (wiring harnesses from rural clusters), one
// for each grade the scorecard can give so the demo shows the whole ladder.
// Keyed by seller name because seller ids repeat across sector templates.
// Every figure here is simulated demo data; the workforce page tags it as such.

const wf = (supplierId: string, district: string, skills: [string, number, number][], over: Partial<WorkforceProfile>): WorkforceProfile => ({
  supplierId,
  district,
  skills: skills.map(([skill, headcount, wagePerWorkerDay]) => ({ skill, headcount, wagePerWorkerDay } as WorkforceSkill)),
  hoursPerDay: 8,
  overtimeHoursPerWeek: 4,
  safetyRecord: 'complete',
  trainingHoursPerYear: 24,
  womenEmployed: Math.round(skills.reduce((n, [, h]) => n + h, 0) * 0.4),
  childOrForcedLabourFlag: false,
  openGrievances: 0,
  updatedAt: '2026-10-24T09:00:00Z',
  ...over,
});

const SEED_WORKFORCES: Record<string, WorkforceProfile> = {
  // A - the hero: rural women's collective paying above the rural living wage (Nilgiris benchmark ₹574/day)
  'krishnagiri mahila harness collective': wf('s13', 'Krishnagiri',
    [['Harness assembly', 160, 590], ['Testing', 20, 620]], { womenEmployed: 166, trainingHoursPerYear: 30 }),
  // B - rural cooperative near the living wage (Ratlam benchmark ₹585/day)
  'satara gramin assembly co-op': wf('s14', 'Satara',
    [['Harness assembly', 180, 560], ['Kitting', 30, 580]], { womenEmployed: 96, trainingHoursPerYear: 18, hoursPerDay: 8.5, overtimeHoursPerWeek: 6 }),
  // B - urban cluster at 92% of the Tiruppur urban benchmark (₹761/day)
  'hosur tool and die cluster': wf('s6', 'Hosur',
    [['Connector making', 90, 700]], { womenEmployed: 18, trainingHoursPerYear: 40, hoursPerDay: 9, overtimeHoursPerWeek: 8 }),
  // C - SHG network above the minimum but under 90% of the living wage
  'madurai shg kitting network': wf('s15', 'Madurai',
    [['Kitting', 120, 480]], { womenEmployed: 108, trainingHoursPerYear: 12, overtimeHoursPerWeek: 2 }),
  // C - urban harness maker at 81% of the benchmark
  'chakan harness systems': wf('s12', 'Chakan, Pune',
    [['Harness assembly', 240, 610], ['Testing', 60, 650]], { womenEmployed: 90, trainingHoursPerYear: 36, hoursPerDay: 9.5, overtimeHoursPerWeek: 10 }),
  // C - established MSME
  'silvassa conductors': wf('s1', 'Silvassa',
    [['Wire drawing', 100, 700], ['Maintenance', 40, 760]], { womenEmployed: 28, trainingHoursPerYear: 24, hoursPerDay: 9 }),
  // D - partial safety record lowers an otherwise C wage one step
  'coimbatore cable works': wf('s2', 'Coimbatore',
    [['Wire drawing', 70, 430]], { womenEmployed: 21, safetyRecord: 'partial', trainingHoursPerYear: 8, overtimeHoursPerWeek: 4 }),
  // D - above the living wage but below the Karnataka minimum: the legal floor wins
  'dharwad women\u2019s moulding co-op': wf('s11', 'Dharwad',
    [['Injection moulding', 65, 700]], { womenEmployed: 58, trainingHoursPerYear: 20, hoursPerDay: 8.5, overtimeHoursPerWeek: 3 }),
  // E - flag set: the auditor blocks every deal
  'rajkot brass terminals': wf('s18', 'Rajkot',
    [['Connector making', 85, 500]], { womenEmployed: 12, safetyRecord: 'partial', trainingHoursPerYear: 4, hoursPerDay: 10, overtimeHoursPerWeek: 12, childOrForcedLabourFlag: true, openGrievances: 1 }),
};

const normName = (s: string) => s.replace(/[\u2018\u2019]/g, "'").trim().toLowerCase();

/** The seed workforce for a demo seller (matched by name), or null. supplierId is filled for the caller. */
export function seedWorkforceFor(sellerName: string, supplierId = ''): WorkforceProfile | null {
  const p = SEED_WORKFORCES[normName(sellerName)];
  return p ? { ...p, supplierId: supplierId || p.supplierId } : null;
}
