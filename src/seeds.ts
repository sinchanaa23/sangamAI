// Sample activity so each sector's workspaces aren't empty on first visit. Every record is flagged `sample`.
import { active, bom, buyer, sellers } from './data';
import { isImported, leadDaysFrom } from './engine';
import { rng } from './sectors/helpers';
import { RURAL_TYPES, type SectorId } from './types';
import type { DevProject, Interest, Quote, Requirement, Review } from './model';
import type { WorkforceProfile, WorkforceSkill } from './fairwork';
import { computeProjections } from './funding';
import type { FundingApplication, FundingItem } from './funding';

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
  // ---------- Development projects ----------
  // Two showcase supplier-development projects per sector so the supplier
  // Development-projects tab is not empty on first visit. Statuses are mixed on
  // purpose so the ecosystem Verification desk has a submitted milestone waiting.
  // The hero of the demo story is the EV sector's Krishnagiri Mahila Harness
  // Collective; other sectors use their first rural/cooperative seller. Every
  // figure here is simulated demo data.
  const hero = sellers.find((s) => s.name === 'Krishnagiri Mahila Harness Collective') ??
    sellers.find((s) => RURAL_TYPES.includes(s.type)) ?? sellers[0];
  const rest = sellers.filter((s) => s.id !== hero.id);
  const partner = rest.find((s) => RURAL_TYPES.includes(s.type)) ?? rest[0];
  const lineFor = (proc: string) => (bom.find((l) => l.process === proc) ?? bom[0]).id;

  // Milestone labels shaped to each sector's parts, tests and certifications.
  const heroLabels: Record<SectorId, { training: string; workspace: string; test: string; audit: string }> = {
    ev: {
      training: 'IPC/WHMA-A-620 operator training for 40 women across 14 SHGs',
      workspace: 'ESD-safe workbenches, wrist straps and ioniser',
      test: 'Calibrated crimp pull-test and continuity test station',
      audit: 'Buyer PPAP audit and first-article approval',
    },
    construction: {
      training: 'Mix design, casting and curing certification for SHG crews',
      workspace: 'Covered curing yard and calibrated batching scales',
      test: 'Compression test fixture and moisture meter',
      audit: 'Buyer quality audit and vendor approval',
    },
    agri: {
      training: 'FSSAI hygiene and quality certification for SHG operators',
      workspace: 'Food-grade handling and packing room upgrade',
      test: 'Moisture analyser and calibrated sample scale',
      audit: 'Buyer quality audit and vendor approval',
    },
  };
  const partnerLabels: Record<SectorId, { cert: string; tooling: string }> = {
    ev: {
      cert: 'ISO 9001 quality system and internal audit',
      tooling: 'Semi-automatic crimp press for one assembly bench',
    },
    construction: {
      cert: 'ISO 9001 quality system and internal audit',
      tooling: 'Hydraulic press refurbishment with a new mould set',
    },
    agri: {
      cert: 'HACCP documentation and internal audit',
      tooling: 'Stainless tray-dryer upgrade and sealing machine',
    },
  };
  const hl = heroLabels[sector];
  const pl = partnerLabels[sector];
  const projects: DevProject[] = [
    {
      // Hero project: skills + workspace upgrade co-funded by the anchor buyer.
      // One milestone verified, one submitted awaiting the Verification desk, one
      // in progress and one not started.
      id: `prj-${sector}-1`, sector, sellerId: hero.id, lineId: lineFor(hero.process),
      buyerSharePct: 60, createdAt: day(-75),
      milestones: [
        { id: `ms-${sector}-1a`, label: hl.training, costLakh: 3.2, months: 2, status: 'verified', evidence: 'ipc-a-620-training-certificates.pdf', updatedAt: day(-40) },
        { id: `ms-${sector}-1b`, label: hl.workspace, costLakh: 4.6, months: 3, status: 'submitted', evidence: 'workspace-audit-photos.pdf', updatedAt: day(-6) },
        { id: `ms-${sector}-1c`, label: hl.test, costLakh: 2.4, months: 2, status: 'doing' },
        { id: `ms-${sector}-1d`, label: hl.audit, costLakh: 1.1, months: 1, status: 'todo' },
      ],
    },
    {
      // Second project: certification and tooling, still early stage.
      id: `prj-${sector}-2`, sector, sellerId: partner.id, lineId: lineFor(partner.process),
      buyerSharePct: 40, createdAt: day(-35),
      milestones: [
        { id: `ms-${sector}-2a`, label: pl.cert, costLakh: 1.8, months: 3, status: 'doing' },
        { id: `ms-${sector}-2b`, label: pl.tooling, costLakh: 6.5, months: 4, status: 'todo' },
        { id: `ms-${sector}-2c`, label: 'Buyer capacity and quality assessment', costLakh: 0.9, months: 1, status: 'todo' },
      ],
    },
  ];

  // Two fully verified flagship reviews for the hero seller so the Reviews page
  // shows a strong record even when the random loop above leaves it thin.
  const heroBuyers: Record<SectorId, { author: string; text: string }> = {
    ev: {
      author: 'EV scooter maker, Tamil Nadu',
      text: 'Sub-assembly kits arrived on time through a six-month ramp-up and passed incoming inspection with zero defects. Daily build-tracker updates from the SHG team made scheduling easy.',
    },
    construction: {
      author: 'Affordable housing developer, Maharashtra',
      text: 'Blocks arrived on schedule across a six-month build programme and passed site quality checks with no rejected lots. Clear daily dispatch updates made our planning easy.',
    },
    agri: {
      author: 'Millet snack brand, Bengaluru',
      text: 'Cleaned and graded lots arrived on time through a six-month contract and passed every incoming quality check. Lot-level quality reports made our planning easy.',
    },
  };
  const hb = heroBuyers[sector];
  reviews.push({
    id: `rv-${hero.id}-flag-b`, sellerId: hero.id, author: hb.author, authorType: 'buyer',
    orderRef: 'PO-2026-4821', orderValueLakh: 38,
    ratings: { quality: 5, delivery: 5, communication: 5, compliance: 5 },
    text: hb.text,
    evidence: 'Purchase order and goods receipt notes', status: 'verified', at: day(-45), sample: true,
  });
  reviews.push({
    id: `rv-${hero.id}-flag-p`, sellerId: hero.id, author: 'Consortium partner (MSME)', authorType: 'partner',
    orderRef: 'PO-2026-2760', orderValueLakh: 22,
    ratings: { quality: 4, delivery: 4, communication: 3, compliance: 4 },
    text: 'Reliable partner through our capacity crunch; work met spec and the agreed dates. Coordination needed more back-and-forth than expected, but the joint quality checklist worked well.',
    evidence: 'Consortium work order and completion report', status: 'verified', at: day(-130), sample: true,
  });

  // ---------- Funding applications ----------
  // Three showcase applications per sector so the buyer's Fund-suppliers marketplace
  // has a ladder: one listed with a demo-buyer commitment, one listed open, one
  // submitted (awaiting the desk pre-check). Projections are computed, never typed.
  const fi = (id: string, kind: FundingItem['kind'], label: string, labelHi: string, costLakh: number, months: number, purpose: string, extra: Partial<FundingItem> = {}): FundingItem => ({
    id, kind, label, labelHi, costLakh, months, purpose, status: 'todo', ...extra,
  });
  const sellerOf = (sid: string) => sellers.find((s) => s.id === sid) ?? hero;
  const fundingApps = ([
    {
      id: `fund-${sector}-1`, sector, sellerId: hero.id, sellerName: hero.name,
      title: 'Solar power and testing R&D for export-grade output',
      purpose: `We want to cut diesel use and prove our quality to big buyers. A rooftop solar array powers the ${hero.process.toLowerCase()} line by day, and a calibrated testing rig lets us certify every batch ourselves instead of paying an outside lab.`,
      items: [
        fi(`fi-${sector}-1a`, 'green-tech', 'Rooftop solar 15 kW with net meter', 'छत पर 15 किलोवाट सौर ऊर्जा', 4.2, 5,
          'Daytime power from solar instead of the diesel generator.', { schemes: ['SIDBI energy-efficiency finance for MSMEs'], sustainabilityItemId: 'energy-renewable' }),
        fi(`fi-${sector}-1b`, 'rnd', 'In-house testing and calibration rig', 'घर के अंदर टेस्टिंग और कैलिब्रेशन रिग', 3.2, 6,
          'Test every batch in-house; the rig pays for itself in outside-lab fees.'),
      ],
      evidence: ['energy-audit-report.pdf', 'shg-managing-committee-resolution.pdf'],
      status: 'listed' as const, commitments: [
        { buyerId: 'buyer', buyerName: buyer.name || 'Veer Electric Mobility', itemIds: [`fi-${sector}-1a`], amountLakh: 3, committedAt: day(-9), status: 'pledged' as const },
      ],
      projections: { totalAskLakh: 7.4, paybackMonths: null, roi5yrPct: null, capacityUpliftPct: null, qualityUpliftPct: null, sustainabilityUplift: null, sangamScoreUplift: null, source: 'estimated' },
      createdAt: day(-14), updatedAt: day(-9),
    },
    {
      id: `fund-${sector}-2`, sector, sellerId: partner.id, sellerName: partner.name,
      title: `Second ${partner.process.toLowerCase()} line: semi-automatic press`,
      purpose: `Orders from the consortium exceed our bench capacity. A semi-automatic press adds a second line, lifts output by roughly a third, and keeps the extra work rural instead of moving it to the city.`,
      items: [
        fi(`fi-${sector}-2a`, 'machine', `Semi-automatic ${partner.process.toLowerCase()} press`, `सेमी-ऑटोमैटिक प्रेस`, 6.5, 4,
          'Adds a second production line at the cooperative shed.', { schemes: ['CGTMSE credit guarantee', 'PMEGP'] }),
      ],
      evidence: ['press-quotation.pdf'],
      status: 'listed' as const, commitments: [],
      projections: { totalAskLakh: 6.5, paybackMonths: null, roi5yrPct: null, capacityUpliftPct: null, qualityUpliftPct: null, sustainabilityUplift: null, sangamScoreUplift: null, source: 'estimated' },
      createdAt: day(-11), updatedAt: day(-11),
    },
    {
      id: `fund-${sector}-3`, sector, sellerId: hero.id, sellerName: hero.name,
      title: 'Environmental certification and working capital',
      purpose: `Our checklist shows ISO 14001 is the missing step to a stronger level. Certification fees plus two months of working capital for the audit visit would let us reach it this quarter.`,
      items: [
        fi(`fi-${sector}-3a`, 'certification', 'ISO 14001 certification and audit fees', 'ISO 14001 प्रमाणपत्र और ऑडिट शुल्क', 1.4, 3,
          'The environmental management certificate buyers ask for.', { schemes: ['MSME ZED Certification (Zero Defect Zero Effect)'], sustainabilityItemId: 'cert-iso14001' }),
        fi(`fi-${sector}-3b`, 'working-capital', 'Working capital for the audit quarter', 'ऑडिट तिमाही के लिए कार्यशील पूंजी', 2, 1,
          'Keeps wages and input orders running while the audit happens.'),
      ],
      evidence: ['checklist-export.pdf'],
      status: 'submitted' as const, commitments: [],
      projections: { totalAskLakh: 3.4, paybackMonths: null, roi5yrPct: null, capacityUpliftPct: null, qualityUpliftPct: null, sustainabilityUplift: null, sangamScoreUplift: null, source: 'estimated' },
      createdAt: day(-5), updatedAt: day(-5),
    },
  ] as FundingApplication[]).map((app) => computeProjections(app, sellerOf(app.sellerId), sector, seedSustainabilityFor(app.sellerName)));

  return { requirements, quotes, interests, reviews, projects, funding: fundingApps };
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

// ---------- Sustainability seed answers (demo, tagged simulated) ----------
// Demo checklist answers spread across the four levels so the buyer's Find-suppliers
// ranking and the metal badges have a full ladder to show. Keyed by seller NAME (ids
// repeat across sector templates); unmatched sellers are 'Not assessed' (no entry).
import type { SustainabilityAnswers } from './sustainability';

const sa = (
  answers: Record<string, [SustainabilityAnswers[string]['value'], SustainabilityAnswers[string]['evidence']]>,
): SustainabilityAnswers =>
  Object.fromEntries(Object.entries(answers).map(([id, [value, evidence]]) => [id, { value, evidence }]));

const SEED_SUSTAINABILITY: Record<string, SustainabilityAnswers> = {
  // ==========================================
  // EV SECTOR (20 companies)
  // ==========================================
  // Platinum
  'krishnagiri mahila harness collective': sa({
    'energy-renewable': ['yes', 'verified'], 'energy-audit': ['yes', 'document'], 'energy-tracked': ['yes', 'verified'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['yes', 'document'],
    'waste-hazardous-auth': ['yes', 'verified'], 'sector-rohs': ['yes', 'document'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['partly', 'document'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['yes', 'declared'],
    'cert-iso14001': ['yes', 'verified'], 'cert-zed': ['yes', 'verified'], 'disclosure-annual': ['yes', 'document'],
  }),
  'krishnagiri fpo agro-fibre packs': sa({
    'energy-renewable': ['yes', 'verified'], 'energy-audit': ['partly', 'declared'], 'energy-tracked': ['yes', 'verified'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['yes', 'verified'], 'packaging-epr': ['yes', 'document'],
    'waste-hazardous-auth': ['na', 'declared'], 'sector-rohs': ['na', 'declared'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['yes', 'document'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['yes', 'declared'],
    'cert-iso14001': ['yes', 'verified'], 'cert-zed': ['yes', 'verified'], 'disclosure-annual': ['partly', 'declared'],
  }),
  'pune precision connectors': sa({
    'energy-renewable': ['yes', 'verified'], 'energy-audit': ['yes', 'verified'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['yes', 'verified'], 'sector-rohs': ['yes', 'verified'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['yes', 'verified'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['yes', 'verified'], 'cert-zed': ['yes', 'verified'], 'disclosure-annual': ['yes', 'document'],
  }),

  // Gold
  'satara gramin assembly co-op': sa({
    'energy-renewable': ['partly', 'document'], 'energy-audit': ['yes', 'verified'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['partly', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['yes', 'verified'], 'sector-rohs': ['partly', 'declared'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['yes', 'document'], 'water-reuse': ['partly', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['yes', 'verified'], 'disclosure-annual': ['partly', 'declared'],
  }),
  "dharwad women's moulding co-op": sa({
    'energy-renewable': ['yes', 'verified'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['yes', 'verified'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'sector-rohs': ['yes', 'document'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['yes', 'verified'], 'disclosure-annual': ['no', 'declared'],
  }),
  'hosur corrugated boxes': sa({
    'energy-renewable': ['partly', 'verified'], 'energy-audit': ['partly', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['yes', 'verified'], 'packaging-epr': ['yes', 'document'],
    'waste-hazardous-auth': ['na', 'declared'], 'sector-rohs': ['na', 'declared'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['partly', 'declared'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['yes', 'verified'], 'disclosure-annual': ['no', 'declared'],
  }),
  'sriperumbudur moulders': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['yes', 'verified'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'sector-rohs': ['yes', 'document'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'rajkot copper industries': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['partly', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['yes', 'declared'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['yes', 'verified'], 'sector-rohs': ['yes', 'document'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['partly', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'vapi polymer extrusions': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['partly', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['yes', 'verified'], 'sector-rohs': ['yes', 'document'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['partly', 'declared'], 'water-reuse': ['partly', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),

  // Silver
  'silvassa conductors': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['partly', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['yes', 'document'], 'sector-rohs': ['yes', 'document'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['partly', 'declared'], 'water-reuse': ['partly', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['partly', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'hosur tool and die cluster': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['no', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['yes', 'document'], 'sector-rohs': ['yes', 'document'],
    'water-consent': ['yes', 'document'], 'water-effluent': ['partly', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['partly', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'madurai shg kitting network': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['partly', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['partly', 'declared'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['yes', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'sector-rohs': ['na', 'declared'],
    'water-consent': ['yes', 'document'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'sanand wiring solutions': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['partly', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['no', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['yes', 'document'], 'sector-rohs': ['yes', 'document'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['partly', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'hosur plastic components': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'sector-rohs': ['yes', 'document'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['partly', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'coimbatore cable works': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['partly', 'declared'],
    'materials-recycled-input': ['no', 'declared'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['yes', 'declared'], 'sector-rohs': ['partly', 'declared'],
    'water-consent': ['yes', 'document'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'pithampur polymers': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['partly', 'declared'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['yes', 'declared'], 'sector-rohs': ['yes', 'declared'],
    'water-consent': ['yes', 'document'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),

  // Bronze
  'chakan harness systems': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['partly', 'declared'],
    'energy-generator-backup': ['no', 'declared'], 'waste-segregation': ['partly', 'declared'],
    'materials-recycled-input': ['no', 'declared'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'sector-rohs': ['partly', 'declared'],
    'water-consent': ['yes', 'declared'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['partly', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'manesar terminal tech': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['partly', 'declared'],
    'energy-generator-backup': ['partly', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['no', 'declared'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['yes', 'document'], 'sector-rohs': ['yes', 'document'],
    'water-consent': ['yes', 'document'], 'water-effluent': ['partly', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['partly', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'rajkot brass terminals': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['no', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['partly', 'declared'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['yes', 'declared'], 'sector-rohs': ['partly', 'declared'],
    'water-consent': ['yes', 'declared'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'chennai flexitubes': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['partly', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['partly', 'declared'],
    'materials-recycled-input': ['no', 'declared'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['yes', 'declared'], 'sector-rohs': ['partly', 'declared'],
    'water-consent': ['yes', 'declared'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['partly', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),

  // ==========================================
  // CONSTRUCTION SECTOR (17 companies)
  // ==========================================
  // Platinum
  'pune fly-ash brick shg federation': sa({
    'energy-renewable': ['yes', 'verified'], 'energy-audit': ['partly', 'document'], 'energy-tracked': ['yes', 'verified'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['yes', 'verified'], 'packaging-epr': ['yes', 'document'],
    'waste-hazardous-auth': ['na', 'declared'], 'sector-flyash': ['yes', 'verified'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['yes', 'verified'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['yes', 'declared'],
    'cert-iso14001': ['yes', 'verified'], 'cert-zed': ['yes', 'verified'], 'disclosure-annual': ['partly', 'declared'],
  }),
  'agartala bamboo producer company': sa({
    'energy-renewable': ['yes', 'verified'], 'energy-audit': ['yes', 'verified'], 'energy-tracked': ['yes', 'verified'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['yes', 'verified'], 'packaging-epr': ['yes', 'document'],
    'waste-hazardous-auth': ['na', 'declared'], 'sector-flyash': ['na', 'declared'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['yes', 'declared'],
    'cert-iso14001': ['yes', 'verified'], 'cert-zed': ['yes', 'verified'], 'disclosure-annual': ['yes', 'document'],
  }),
  'satara gramin aac cooperative': sa({
    'energy-renewable': ['partly', 'verified'], 'energy-audit': ['yes', 'verified'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['yes', 'verified'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'sector-flyash': ['yes', 'verified'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['yes', 'document'], 'water-reuse': ['yes', 'verified'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['yes', 'verified'], 'cert-zed': ['yes', 'verified'], 'disclosure-annual': ['no', 'declared'],
  }),
  'guwahati bamboo board works': sa({
    'energy-renewable': ['yes', 'verified'], 'energy-audit': ['partly', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['yes', 'verified'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'sector-flyash': ['na', 'declared'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['yes', 'document'], 'water-reuse': ['partly', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['yes', 'declared'],
    'cert-iso14001': ['yes', 'verified'], 'cert-zed': ['yes', 'verified'], 'disclosure-annual': ['no', 'declared'],
  }),

  // Gold
  'sambhajinagar rebar mills': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['yes', 'verified'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['yes', 'verified'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['yes', 'verified'], 'sector-flyash': ['na', 'declared'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['yes', 'document'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'satara cement grinding unit': sa({
    'energy-renewable': ['partly', 'verified'], 'energy-audit': ['yes', 'verified'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['yes', 'verified'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['yes', 'verified'], 'sector-flyash': ['yes', 'verified'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['partly', 'declared'], 'water-reuse': ['partly', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['partly', 'declared'],
  }),
  'rajkot ceramic works': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['yes', 'verified'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['yes', 'document'], 'sector-flyash': ['na', 'declared'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['yes', 'verified'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'rajkot brass fittings cluster': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['yes', 'verified'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['yes', 'document'], 'sector-flyash': ['na', 'declared'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['yes', 'document'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),

  // Silver
  'nashik blocks': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['yes', 'document'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'sector-flyash': ['yes', 'document'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'dharwad bamboo cooperative': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['partly', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'sector-flyash': ['na', 'declared'],
    'water-consent': ['yes', 'document'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'pune aluminium systems': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['partly', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['yes', 'document'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['yes', 'document'], 'sector-flyash': ['na', 'declared'],
    'water-consent': ['yes', 'verified'], 'water-effluent': ['partly', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'nagpur steel re-rollers': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['partly', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['partly', 'declared'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['yes', 'declared'], 'sector-flyash': ['na', 'declared'],
    'water-consent': ['yes', 'declared'], 'water-effluent': ['partly', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'nashik slag cement co': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['partly', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['partly', 'declared'],
    'materials-recycled-input': ['yes', 'declared'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['yes', 'declared'], 'sector-flyash': ['partly', 'declared'],
    'water-consent': ['yes', 'declared'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'rajkot extrusion fabricators': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['partly', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['partly', 'declared'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['yes', 'declared'], 'sector-flyash': ['na', 'declared'],
    'water-consent': ['yes', 'declared'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'sanand tile co': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['partly', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['partly', 'declared'],
    'materials-recycled-input': ['no', 'declared'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['yes', 'declared'], 'sector-flyash': ['na', 'declared'],
    'water-consent': ['yes', 'declared'], 'water-effluent': ['partly', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),

  // Bronze
  'ludhiana sanitary works': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['no', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['partly', 'declared'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['yes', 'declared'], 'sector-flyash': ['na', 'declared'],
    'water-consent': ['yes', 'declared'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),
  'howrah foundry co-op': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['no', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['partly', 'declared'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['yes', 'declared'], 'sector-flyash': ['na', 'declared'],
    'water-consent': ['yes', 'declared'], 'water-effluent': ['na', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
  }),

  // ==========================================
  // AGRI SECTOR (14 companies)
  // ==========================================
  // Platinum
  'anantapur millet fpo': sa({
    'energy-renewable': ['yes', 'verified'], 'energy-audit': ['partly', 'document'], 'energy-tracked': ['yes', 'verified'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['yes', 'document'],
    'waste-hazardous-auth': ['na', 'declared'], 'water-consent': ['yes', 'verified'],
    'water-effluent': ['na', 'declared'], 'water-reuse': ['yes', 'verified'],
    'local-inputs': ['yes', 'verified'], 'local-transport': ['yes', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['yes', 'verified'], 'disclosure-annual': ['yes', 'document'],
    'sector-organic': ['yes', 'verified'],
  }),
  'krishnagiri solar dryer shg network': sa({
    'energy-renewable': ['yes', 'verified'], 'energy-audit': ['yes', 'verified'], 'energy-tracked': ['yes', 'verified'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['yes', 'document'], 'packaging-epr': ['yes', 'document'],
    'waste-hazardous-auth': ['na', 'declared'], 'water-consent': ['yes', 'verified'],
    'water-effluent': ['na', 'declared'], 'water-reuse': ['yes', 'verified'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['yes', 'declared'],
    'cert-iso14001': ['yes', 'verified'], 'cert-zed': ['yes', 'verified'], 'disclosure-annual': ['partly', 'declared'],
    'sector-organic': ['yes', 'verified'],
  }),
  'dharwad siridhanya producer co': sa({
    'energy-renewable': ['yes', 'verified'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['yes', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'water-consent': ['yes', 'verified'],
    'water-effluent': ['na', 'declared'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['yes', 'declared'],
    'cert-iso14001': ['yes', 'verified'], 'cert-zed': ['yes', 'verified'], 'disclosure-annual': ['no', 'declared'],
    'sector-organic': ['yes', 'verified'],
  }),
  'kochi spice processors': sa({
    'energy-renewable': ['partly', 'verified'], 'energy-audit': ['yes', 'verified'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'water-consent': ['yes', 'verified'],
    'water-effluent': ['yes', 'verified'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['yes', 'verified'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['yes', 'document'],
    'sector-organic': ['yes', 'verified'],
  }),
  'tiruppur corrugators': sa({
    'energy-renewable': ['yes', 'verified'], 'energy-audit': ['partly', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['yes', 'verified'], 'packaging-epr': ['yes', 'document'],
    'waste-hazardous-auth': ['na', 'declared'], 'water-consent': ['yes', 'verified'],
    'water-effluent': ['partly', 'declared'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['yes', 'verified'], 'cert-zed': ['yes', 'verified'], 'disclosure-annual': ['no', 'declared'],
    'sector-organic': ['na', 'declared'],
  }),

  // Gold
  'anantapur women dryers cooperative': sa({
    'energy-renewable': ['yes', 'verified'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['yes', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'water-consent': ['yes', 'verified'],
    'water-effluent': ['na', 'declared'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['yes', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
    'sector-organic': ['yes', 'verified'],
  }),
  'tumakuru puffed rice shg': sa({
    'energy-renewable': ['yes', 'verified'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'verified'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'water-consent': ['yes', 'verified'],
    'water-effluent': ['na', 'declared'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['yes', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
    'sector-organic': ['partly', 'declared'],
  }),
  'madurai grain processors': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['yes', 'verified'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'water-consent': ['yes', 'verified'],
    'water-effluent': ['na', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
    'sector-organic': ['partly', 'declared'],
  }),
  'nashik dehydration works': sa({
    'energy-renewable': ['partly', 'verified'], 'energy-audit': ['partly', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'water-consent': ['yes', 'verified'],
    'water-effluent': ['yes', 'document'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
    'sector-organic': ['no', 'declared'],
  }),
  'pithampur flexipack': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['partly', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['yes', 'verified'],
    'waste-hazardous-auth': ['yes', 'document'], 'water-consent': ['yes', 'verified'],
    'water-effluent': ['partly', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
    'sector-organic': ['na', 'declared'],
  }),

  // Silver
  'coimbatore agro dryers': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['no', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'water-consent': ['yes', 'verified'],
    'water-effluent': ['partly', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
    'sector-organic': ['partly', 'declared'],
  }),
  'vijayawada chilli and spice fpo': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['partly', 'declared'],
    'materials-recycled-input': ['no', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'water-consent': ['yes', 'verified'],
    'water-effluent': ['na', 'declared'], 'water-reuse': ['yes', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
    'sector-organic': ['partly', 'declared'],
  }),
  'mysuru flakes and puffs': sa({
    'energy-renewable': ['partly', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['yes', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['yes', 'document'],
    'materials-recycled-input': ['no', 'declared'], 'packaging-epr': ['partly', 'declared'],
    'waste-hazardous-auth': ['na', 'declared'], 'water-consent': ['yes', 'verified'],
    'water-effluent': ['na', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['partly', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
    'sector-organic': ['no', 'declared'],
  }),

  // Bronze
  'vapi laminates': sa({
    'energy-renewable': ['no', 'declared'], 'energy-audit': ['no', 'declared'], 'energy-tracked': ['partly', 'declared'],
    'energy-generator-backup': ['yes', 'declared'], 'waste-segregation': ['partly', 'declared'],
    'materials-recycled-input': ['partly', 'declared'], 'packaging-epr': ['no', 'declared'],
    'waste-hazardous-auth': ['yes', 'declared'], 'water-consent': ['yes', 'declared'],
    'water-effluent': ['na', 'declared'], 'water-reuse': ['no', 'declared'],
    'local-inputs': ['yes', 'declared'], 'local-transport': ['no', 'declared'],
    'cert-iso14001': ['no', 'declared'], 'cert-zed': ['no', 'declared'], 'disclosure-annual': ['no', 'declared'],
    'sector-organic': ['na', 'declared'],
  }),
};

/** Seed sustainability answers for a demo seller (matched by name), or null = Not assessed. */
export function seedSustainabilityFor(sellerName: string): SustainabilityAnswers | null {
  return SEED_SUSTAINABILITY[normName(sellerName)] ?? null;
}
