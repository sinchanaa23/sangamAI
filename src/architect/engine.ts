// AI Supply Chain Architect: designs a new business and its supply chain for an upcoming supplier.
// Pure functions over Sangam's existing data and engine; nothing here invents a figure. Every number
// carries a tag: public/verified data, an estimate from Sangam's models, simulated demo data, or an
// assumption the user can edit. AI suggestions are added separately (src/architect/ai.ts) and labelled.
import { bom, buyer, certInfo, demandSignals, districts, opportunities, processInfo, sellers } from '../data';
import { deliveredCost, district, importLineCost, leadDaysFrom, roadKm } from '../engine';
import { livingWageFor, minimumWageFor, scoreFairWork } from '../fairwork';
import type { ScoredWork } from '../fairwork';
import { METRICS, trade } from '../realdata';
import { domesticLanes, exportRoute } from '../routes';
import type { Leg } from '../routes';
import { DEFAULT_SCENARIO } from '../scenario';
import type { BomLine, District, Provenance, Seller } from '../types';
import { COUNTRIES, laneFor } from '../buyer/global/settings';
import clustersFile from '../real/clusters.json';

/** Where a figure comes from. 'assumption' = a default the user can edit; 'ai' = suggested by the language model. */
export type Tag = Provenance | 'assumption' | 'ai';
export interface Fig { value: number; tag: Tag; note?: string }
const fig = (value: number, tag: Tag, note?: string): Fig => ({ value, tag, note });

export type Emphasis = 'balanced' | 'cost' | 'speed' | 'rural';

export interface ArchitectInput {
  lineId: string;
  /** district the user wants; empty = let Sangam recommend */
  districtId: string;
  capacityPerMonth: number;
  budgetLakh: number;
  /** buyer country code from the global buyer table; 'IN' = domestic */
  buyerCountry: string;
  emphasis: Emphasis;
  /** editable assumptions; undefined = use Sangam's default */
  pricePerUnit?: number;
  wagePerDay?: number;
  workersPerThousand?: number;
  materialsPct?: number;
  utilisationPct?: number;
  womenSharePct?: number;
  trainingHoursPerYear?: number;
  safetyPlan?: 'complete' | 'partial' | 'none';
  importDutyPct?: number;
}

const median = (xs: number[]) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const lower = (s: string) => s.toLowerCase();

// ---------- Products and opportunities ----------

export interface ProductOption {
  line: BomLine;
  importUsd: number | null;
  importYear: number | null;
  sangamSuppliers: number;
  demand: { buyers: number; monthlyUnits: number; region: string; from: string } | null;
}

/** Every part in the current sector's catalogue, with real import value (UN Comtrade) and simulated demand. */
export function productOptions(): ProductOption[] {
  return bom.map((line) => {
    const t = trade(line.hs);
    const d = demandSignals.find((x) => x.process === line.process) ?? null;
    return { line, importUsd: t?.totalUsd ?? null, importYear: t?.year ?? null, sangamSuppliers: sellers.filter((s) => s.process === line.process).length, demand: d };
  });
}

/** Plain keyword match of a free-text idea against the catalogue and the ODOP clusters (no AI). */
export function matchIdea(idea: string): { lineIds: string[]; clusterIds: string[] } {
  const words = lower(idea).split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  if (!words.length) return { lineIds: [], clusterIds: [] };
  const hits = (text: string) => words.filter((w) => lower(text).includes(w)).length;
  const lineIds = bom.map((l) => ({ id: l.id, n: hits(`${l.name} ${l.process} ${l.spec}`) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).map((x) => x.id);
  const clusterIds = clusters().map((c) => ({ id: c.id, n: hits(`${c.name} ${c.skills.join(' ')}`) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).map((x) => x.id);
  return { lineIds, clusterIds };
}

interface ClusterRow { id: string; name: string; district: string; state: string; districtId?: string; moreDistrictIds?: string[]; skills: string[] }
const clusters = () => clustersFile.clusters as ClusterRow[];

// ---------- Region recommendation ----------

export interface RegionFactor { key: string; label: string; score: number; tag: Tag; detail: string }
export interface Region { district: District; score: number; factors: RegionFactor[]; cluster: ClusterRow | null; nearbySuppliers: Seller[] }

const WEIGHTS: Record<Emphasis, Record<string, number>> = {
  balanced: { inputs: 2, connectivity: 2, industry: 1, climate: 1, power: 1, labour: 1, ecosystem: 1, market: 2, rural: 1 },
  cost: { inputs: 2, connectivity: 1, industry: 1, climate: 1, power: 1, labour: 3, ecosystem: 1, market: 3, rural: 0 },
  speed: { inputs: 2, connectivity: 3, industry: 2, climate: 1, power: 2, labour: 0, ecosystem: 2, market: 2, rural: 0 },
  rural: { inputs: 2, connectivity: 1, industry: 0, climate: 1, power: 1, labour: 1, ecosystem: 1, market: 1, rural: 4 },
};

/** Districts ranked for making this part, from public district data, the part's input regions and the wage benchmarks. */
export function rankRegions(line: BomLine, input: Pick<ArchitectInput, 'buyerCountry' | 'emphasis'>): Region[] {
  const tiers = line.tiers;
  const proc = lower(line.process);
  const plant = district(buyer.plantDistrictId);
  const domestic = input.buyerCountry === 'IN';
  const wages = districts.map((d) => livingWageFor(d.name)?.perDayInr ?? null);
  const loW = Math.min(...wages.filter((w): w is number => w != null)), hiW = Math.max(...wages.filter((w): w is number => w != null));
  const w = WEIGHTS[input.emphasis];

  return districts.map((d, i) => {
    const m = METRICS[d.id];
    const inState = tiers.filter((t) => lower(t.indianRegions).includes(lower(d.state)) || lower(t.indianRegions).includes(lower(d.name.split(',')[0]))).length;
    const nearby = sellers.filter((s) => s.process === line.process && roadKm(district(s.districtId), d) < 250);
    const cluster = clusters().find((c) => [c.districtId, ...(c.moreDistrictIds ?? [])].includes(d.id) && c.skills.some((k) => proc.split(' ').some((p) => p.length > 3 && lower(k).includes(p)) || /engineering|auto|machine|esdm/i.test(k))) ?? null;
    const wage = wages[i];
    const marketKm = domestic ? roadKm(d, plant) : m.nearestPort.km;
    const factors: RegionFactor[] = [
      { key: 'inputs', label: 'Raw materials nearby', score: tiers.length ? inState / tiers.length : 0, tag: 'estimated', detail: tiers.length ? `${inState} of ${tiers.length} inputs are made in ${d.state} (Sangam's input map)` : 'No input map for this part' },
      { key: 'connectivity', label: 'Connectivity', score: m.connectivityScore, tag: m.provenance.connectivity, detail: `Rail, roads, airport; nearest major port ${m.nearestPort.name}, about ${m.nearestPort.km} km` },
      { key: 'industry', label: 'Industrial base', score: m.industrialScore, tag: m.provenance.industrial, detail: 'Industrial land use within 20 km (OpenStreetMap)' },
      { key: 'climate', label: 'Low climate exposure', score: 1 - m.climateScore, tag: m.provenance.climate, detail: 'Heavy-rain and 40 °C days, 2015-2024 (Open-Meteo)' },
      { key: 'power', label: 'Grid reliability', score: m.power, tag: 'estimated', detail: 'State-level estimate' },
      { key: 'labour', label: 'Labour cost at a living wage', score: wage == null || hiW === loW ? 0.5 : 1 - (wage - loW) / (hiW - loW), tag: wage == null ? 'estimated' : 'public', detail: wage == null ? 'No living-wage benchmark found' : `Living wage about ₹${wage} a worker-day (Global Living Wage Coalition)` },
      { key: 'ecosystem', label: 'Skilled workers and suppliers', score: Math.min(1, nearby.length / 3 + (cluster ? 0.4 : 0)), tag: cluster ? 'public' : 'simulated', detail: `${nearby.length} Sangam supplier(s) in this process within 250 km${cluster ? `; ODOP cluster: ${cluster.name}` : ''}` },
      { key: 'market', label: domestic ? 'Close to the buyer' : 'Close to a port', score: Math.max(0, 1 - marketKm / 1500), tag: 'estimated', detail: domestic ? `About ${Math.round(marketKm)} km by road to ${plant.name}` : `About ${marketKm} km to ${m.nearestPort.name}` },
      { key: 'rural', label: 'Rural development priority', score: 1 - m.industrialScore, tag: 'estimated', detail: 'Proxy used by the Location planner: less existing industry means more uplift from new jobs' },
    ];
    const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    const score = Math.round((100 * factors.reduce((s, f) => s + (w[f.key] ?? 0) * f.score, 0)) / total);
    return { district: d, score, factors, cluster, nearbySuppliers: nearby };
  }).sort((a, b) => b.score - a.score);
}

// ---------- The plan ----------

export type StageKind = 'raw' | 'processing' | 'manufacturing' | 'logistics' | 'buyer';
export interface Stage {
  id: string;
  kind: StageKind;
  name: string;
  place: string;
  /** where this stage's supply comes from in the chosen scenario */
  origin: 'india' | 'import' | 'mixed';
  tag: Tag;
  facts: { label: string; value: string; tag: Tag }[];
  suppliers: Seller[];
  next: string[];
}

export type ScenarioId = 'import' | 'hybrid' | 'india';
export interface ScenarioResult {
  id: ScenarioId;
  name: string;
  idea: string;
  costPerUnit: Fig | null;
  leadDays: Fig;
  indiaInputs: Fig;
  jobs: Fig;
  supplyRisk: string;
  notes: string[];
}

export interface Phase { name: string; months: string; tasks: string[]; utilisationPct: number; revenuePerMonth: Fig }
export interface Risk { level: 'high' | 'medium' | 'low'; text: string; tag: Tag }

export interface Plan {
  input: ArchitectInput;
  line: BomLine;
  region: Region;
  regions: Region[];
  stages: Stage[];
  scenarios: ScenarioResult[];
  setup: { label: string; lakh: Fig; months: number; schemes: string[] }[];
  setupTotalLakh: number;
  budgetGapLakh: number;
  economics: {
    price: Fig; materials: Fig; labour: Fig; freight: Fig; contribution: Fig;
    monthlyRevenue: Fig; monthlyContribution: Fig; paybackMonths: number | null;
  };
  workforce: { workers: Fig; wage: Fig; living: { perDay: number; source: string; tag: Tag } | null; minimum: { perDay: number; source: string } | null; score: ScoredWork; womenShare: number };
  skills: { name: string; costLakh: number; months: number; schemes: string[] }[];
  phases: Phase[];
  risks: Risk[];
  diversify: { name: string; marketCr: number; growthPct: number }[];
}

const PROCESS_LABOUR_SHARE = (process: string) => (/assembl/i.test(process) ? 0.6 : 0.3);

/** Sangam's default assumptions for this part, before the user edits anything. */
export function defaults(line: BomLine, districtId: string) {
  const peers = sellers.filter((s) => s.process === line.process);
  const priceIndex = median(peers.map((s) => s.priceIndex)) ?? 1;
  const perK = median(peers.map((s) => s.workers / Math.max(1, s.monthlyCapacity / 1000)));
  const living = livingWageFor(district(districtId).name);
  return {
    pricePerUnit: Math.round(line.cost * priceIndex),
    priceTag: (peers.length ? 'simulated' : 'estimated') as Tag,
    wagePerDay: living?.perDayInr ?? 0,
    workersPerThousand: perK == null ? 0 : +perK.toFixed(1),
    materialsPct: Math.round((1 - PROCESS_LABOUR_SHARE(line.process)) * 100),
    utilisationPct: 70,
    womenSharePct: 30,
    trainingHoursPerYear: 40,
    safetyPlan: 'complete' as const,
    importDutyPct: 0,
  };
}

export function buildPlan(input: ArchitectInput): Plan | null {
  const line = bom.find((l) => l.id === input.lineId);
  if (!line) return null;
  const regions = rankRegions(line, input);
  const region = regions.find((r) => r.district.id === input.districtId) ?? regions[0];
  const d = region.district;
  const def = defaults(line, d.id);
  const a = {
    price: input.pricePerUnit ?? def.pricePerUnit,
    wage: input.wagePerDay ?? def.wagePerDay,
    perK: input.workersPerThousand ?? def.workersPerThousand,
    materialsPct: input.materialsPct ?? def.materialsPct,
    util: input.utilisationPct ?? def.utilisationPct,
    women: input.womenSharePct ?? def.womenSharePct,
    training: input.trainingHoursPerYear ?? def.trainingHoursPerYear,
    safety: input.safetyPlan ?? def.safetyPlan,
    duty: input.importDutyPct ?? def.importDutyPct,
  };
  const t = (k: keyof ArchitectInput, base: Tag): Tag => (input[k] === undefined ? base : 'assumption');
  const cap = Math.max(1, input.capacityPerMonth);
  const proc = processInfo(line.process);
  const domestic = input.buyerCountry === 'IN';
  const lane = domestic ? undefined : laneFor(input.buyerCountry);
  const country = COUNTRIES.find((c) => c.code === input.buyerCountry);

  // Workforce and SDG 8
  const workers = Math.max(1, Math.round((cap / 1000) * a.perK));
  const living = livingWageFor(d.name);
  const minimum = minimumWageFor(d.name);
  const score = scoreFairWork(
    { workers, workerDays: workers * 26, wagePerWorkerDay: a.wage, hoursPerDay: 8, womenShare: a.women / 100, district: d.name },
    { supplierId: 'architect', district: d.name, skills: [{ skill: line.process, headcount: workers, wagePerWorkerDay: a.wage }], hoursPerDay: 8, overtimeHoursPerWeek: 0, safetyRecord: a.safety, trainingHoursPerYear: a.training, womenEmployed: Math.round(workers * a.women / 100), childOrForcedLabourFlag: false, openGrievances: 0, updatedAt: new Date().toISOString() },
  );

  // Unit economics at steady state
  const units = cap * (a.util / 100);
  const labourPerUnit = (workers * a.wage * 26) / Math.max(1, units);
  const materialsPerUnit = a.price * (a.materialsPct / 100);
  const route = lane ? exportRoute(lane, d, a.price, line.weightKg, a.duty) : null;
  const freightPerUnit = route ? route.costPerUnit : Math.max(0, deliveredCost(line, 1, d.id) - line.cost);
  const contribution = a.price - materialsPerUnit - labourPerUnit - freightPerUnit;

  // Setup: plant, certificates, working capital
  const certs = line.requiredCerts.map((c) => ({ name: c, ...certInfo(c) }));
  const setup = [
    { label: `${line.process} plant for ${cap.toLocaleString('en-IN')} ${buyer.unitLabel} sets a month`, lakh: fig(+((cap / 1000) * proc.lakhPerThousand).toFixed(1), 'estimated', `₹${proc.lakhPerThousand} lakh per 1,000 a month (Sangam process model)`), months: proc.months, schemes: ['PMEGP', 'CGTMSE credit guarantee'] },
    ...certs.map((c) => ({ label: `Certificate: ${c.name}`, lakh: fig(c.costLakh, 'estimated'), months: c.months, schemes: c.schemes })),
    { label: 'Working capital (2 months of materials and wages)', lakh: fig(+((2 * units * (materialsPerUnit + labourPerUnit)) / 1e5).toFixed(1), 'assumption', 'Two months of running costs at the planned utilisation'), months: 0, schemes: ['CGTMSE credit guarantee'] },
  ];
  const setupTotalLakh = +setup.reduce((s, x) => s + x.lakh.value, 0).toFixed(1);
  const monthlyContribution = contribution * units;
  const paybackMonths = monthlyContribution > 0 ? Math.ceil((setupTotalLakh * 1e5) / monthlyContribution) : null;

  // Stages of the chain
  const india = (s: string) => s === 'strong';
  const stages: Stage[] = [];
  line.tiers.forEach((tier, i) => {
    const tr = trade(tier.hs);
    const top = tr?.partners[0];
    stages.push({
      id: `t${i}`, kind: tier.stage === 'raw material' ? 'raw' : 'processing', name: tier.name,
      place: tier.indianRegions || 'India', origin: india(tier.indianSupply) ? 'india' : tier.indianSupply === 'partial' ? 'mixed' : 'import', tag: 'estimated',
      facts: [
        { label: 'Indian supply today', value: tier.indianSupply, tag: 'estimated' },
        ...(tr ? [{ label: `India's imports (${tr.year})`, value: `$${(tr.totalUsd / 1e6).toFixed(1)} million${top ? `, ${Math.round(top.share * 100)}% from ${top.name}` : ''}`, tag: 'public' as Tag }] : []),
        ...(tier.note ? [{ label: 'Note', value: tier.note, tag: 'estimated' as Tag }] : []),
      ],
      suppliers: sellers.filter((s) => lower(s.process).split(' ').some((w) => w.length > 3 && lower(tier.name).includes(w))),
      next: ['make'],
    });
  });
  const raws = stages.filter((s) => s.kind === 'raw'), mids = stages.filter((s) => s.kind === 'processing');
  if (mids.length) raws.forEach((r) => { r.next = mids.map((m) => m.id); });
  stages.push({
    id: 'make', kind: 'manufacturing', name: `Your unit: ${line.process}`, place: `${d.name}, ${d.state}`, origin: 'india', tag: 'assumption',
    facts: [
      { label: 'Capacity', value: `${cap.toLocaleString('en-IN')} ${buyer.unitLabel} sets a month`, tag: 'assumption' },
      { label: 'Workers', value: `${workers}`, tag: t('workersPerThousand', 'estimated') },
      { label: 'Spec', value: line.spec, tag: 'simulated' },
      { label: 'Certificates needed', value: line.requiredCerts.join(', ') || 'None listed', tag: 'estimated' },
    ],
    suppliers: sellers.filter((s) => s.process === line.process),
    next: [],
  });
  const legs: Leg[] = route ? route.legs.filter((l) => l.days > 0) : (domesticLanes(d)[0]?.legs ?? []);
  const legStages: Stage[] = (legs.length ? legs : [{ id: 'local', title: 'Local delivery', place: d.name, days: 1, documents: [], risks: [], src: 'estimated' } as unknown as Leg]).map((l, i) => ({
    id: `l${i}`, kind: 'logistics' as const, name: l.title, place: l.place, origin: 'india' as const, tag: l.src,
    facts: [{ label: 'Days', value: String(l.days), tag: l.src }, ...(l.documents.length ? [{ label: 'Documents', value: l.documents.join(', '), tag: 'estimated' as Tag }] : []), ...(l.risks.length ? [{ label: 'Risks', value: l.risks.join('; '), tag: 'estimated' as Tag }] : [])],
    suppliers: [], next: [],
  }));
  stages.find((s) => s.id === 'make')!.next = [legStages[0].id];
  legStages.forEach((s, i) => { s.next = i < legStages.length - 1 ? [legStages[i + 1].id] : ['buyer']; });
  stages.push(...legStages);
  const demand = demandSignals.find((x) => x.process === line.process);
  stages.push({
    id: 'buyer', kind: 'buyer', name: domestic ? `${buyer.name} and similar buyers` : `Buyers in ${country?.name ?? input.buyerCountry}`,
    place: domestic ? `${district(buyer.plantDistrictId).name}` : (lane?.port ?? ''), origin: 'india', tag: domestic ? 'simulated' : 'assumption',
    facts: [
      ...(domestic ? [{ label: 'Example buyer', value: `${buyer.name} uses about ${buyer.monthlyUnits.toLocaleString('en-IN')} a month`, tag: 'simulated' as Tag }] : [{ label: 'Market', value: 'No buyer commitment: a target market you chose', tag: 'assumption' as Tag }]),
      ...(demand ? [{ label: 'Demand on Sangam', value: `${demand.buyers} buyers, about ${demand.monthlyUnits.toLocaleString('en-IN')} a month, ${demand.region}, from ${demand.from}`, tag: 'simulated' as Tag }] : []),
    ],
    suppliers: [], next: [],
  });

  // Import-dependent, hybrid and India-first
  const weak = line.tiers.filter((x) => x.indianSupply === 'weak'), partial = line.tiers.filter((x) => x.indianSupply === 'partial');
  const indiaShare = (n: number) => fig(line.tiers.length ? Math.round((n / line.tiers.length) * 100) : 0, 'estimated');
  const hhi = trade(line.hs)?.hhi;
  const ourCost = a.price + freightPerUnit;
  const scenarios: ScenarioResult[] = [
    {
      id: 'import', name: 'Import-dependent', idea: line.importedFrom === 'India' ? 'Already made in India today' : `The buyer keeps importing the finished part from ${line.importedFrom}`,
      costPerUnit: fig(Math.round(importLineCost(line, DEFAULT_SCENARIO)), 'simulated', 'Today\'s landed price in Sangam\'s demo data'),
      leadDays: fig(buyer.importLeadDays, 'simulated'), indiaInputs: fig(0, 'estimated'), jobs: fig(0, 'estimated', 'No new Indian jobs for this part'),
      supplyRisk: hhi != null ? `${hhi >= 2500 ? 'Highly' : hhi >= 1500 ? 'Moderately' : 'Not'} concentrated imports (HHI ${Math.round(hhi)}, UN Comtrade)` : 'No trade data for this part',
      notes: ['Exposed to duty, exchange-rate and shipping shocks (see Simulator)'],
    },
    {
      id: 'hybrid', name: 'Hybrid', idea: 'You make it in India; inputs with weak or partial Indian supply are imported',
      costPerUnit: fig(Math.round(ourCost), t('pricePerUnit', def.priceTag), 'Your price plus delivery'),
      leadDays: fig(leadDaysFrom(d.id), 'estimated'), indiaInputs: indiaShare(line.tiers.length - weak.length - partial.length), jobs: fig(workers, t('workersPerThousand', 'estimated')),
      supplyRisk: [...weak, ...partial].length ? `Imports still needed: ${[...weak, ...partial].map((x) => x.name).join(', ')}` : 'All inputs available in India',
      notes: [],
    },
    {
      id: 'india', name: 'India-first', idea: 'You make it in India and source every input in India',
      costPerUnit: weak.length ? null : fig(Math.round(ourCost), t('pricePerUnit', def.priceTag)),
      leadDays: fig(leadDaysFrom(d.id), 'estimated'), indiaInputs: indiaShare(line.tiers.length), jobs: fig(workers, t('workersPerThousand', 'estimated')),
      supplyRisk: weak.length ? `No proven Indian supply yet: ${weak.map((x) => x.name).join(', ')}` : partial.length ? `Indian supply is partial: ${partial.map((x) => x.name).join(', ')}` : 'Indian supply is strong for every input',
      notes: weak.length ? ['Cost not estimated: Sangam has no Indian price for these inputs. Needs supplier development.'] : [],
    },
  ];

  // Skills and phases
  const skills = certs.filter((c) => c.schemes.some((s) => /skill|nrlm|nsdc/i.test(s)) || /training/i.test(c.name)).map((c) => ({ name: c.name, costLakh: c.costLakh, months: c.months, schemes: c.schemes }));
  const certMonths = Math.max(0, ...certs.map((c) => c.months));
  const revenue = (util: number) => fig(Math.round(cap * (util / 100) * a.price), t('pricePerUnit', def.priceTag));
  const phases: Phase[] = [
    { name: 'Register and prepare', months: `0-${Math.max(2, certMonths)}`, utilisationPct: 0, revenuePerMonth: fig(0, 'estimated'), tasks: ['Register on Udyam and open a Sangam supplier profile', `Start certificates: ${line.requiredCerts.join(', ') || 'none required'}`, `Hire and train ${workers} workers at ₹${a.wage} a day or more`, 'Line up input suppliers (see the chain)'] },
    { name: 'Set up the plant', months: `${Math.max(2, certMonths)}-${Math.max(2, certMonths) + proc.months}`, utilisationPct: 0, revenuePerMonth: fig(0, 'estimated'), tasks: [`Install the ${line.process.toLowerCase()} line (about ${proc.months} months)`, 'Safety audit and ESD or PPE set-up before production', 'Sample parts to buyers; first-article inspection'] },
    { name: 'Ramp up', months: 'next 6', utilisationPct: Math.round(a.util * 0.6), revenuePerMonth: revenue(a.util * 0.6), tasks: ['Win a first order through Sangam opportunities', 'Fill the Workforce and fair work profile so buyers see your grade'] },
    { name: 'Steady state', months: 'after', utilisationPct: a.util, revenuePerMonth: revenue(a.util), tasks: ['Second buyer to reduce dependence', 'Explore diversification (below)'] },
  ];

  // Risks from the data
  const risks: Risk[] = [];
  weak.forEach((x) => risks.push({ level: 'high', text: `${x.name}: Indian supply is weak, so this input is likely imported`, tag: 'estimated' }));
  partial.forEach((x) => risks.push({ level: 'medium', text: `${x.name}: Indian supply covers only part of demand`, tag: 'estimated' }));
  if (METRICS[d.id].climateScore > 0.6) risks.push({ level: 'medium', text: `${d.name} has high heavy-rain or heat exposure`, tag: METRICS[d.id].provenance.climate });
  if (living && a.wage < living.perDayInr) risks.push({ level: 'high', text: `The planned wage ₹${a.wage} is below the living wage ₹${living.perDayInr}: the Fair Work grade drops and agents may block deals`, tag: 'public' });
  if (minimum && a.wage < minimum.perDayInr) risks.push({ level: 'high', text: `The planned wage is below ${d.state}'s minimum wage (₹${minimum.perDayInr} a day): not legal`, tag: 'public' });
  if (!minimum) risks.push({ level: 'low', text: `${d.state}'s minimum wage is not in Sangam's data yet: check the state labour department notification`, tag: 'estimated' });
  if (contribution <= 0) risks.push({ level: 'high', text: 'At these assumptions each unit loses money: raise the price, lower materials or raise utilisation', tag: 'assumption' });
  if (setupTotalLakh > input.budgetLakh) risks.push({ level: 'medium', text: `Set-up needs about ₹${setupTotalLakh} lakh against a budget of ₹${input.budgetLakh} lakh`, tag: 'estimated' });
  if (certMonths >= 6) risks.push({ level: 'medium', text: `Certificates take up to ${certMonths} months before buyers can order`, tag: 'estimated' });
  if (!demand) risks.push({ level: 'medium', text: 'No demand signal for this process on Sangam yet', tag: 'simulated' });
  const competitors = sellers.filter((s) => s.process === line.process);
  if (competitors.length >= 4) risks.push({ level: 'low', text: `${competitors.length} suppliers already offer this process on Sangam`, tag: 'simulated' });

  return {
    input, line, region, regions, stages, scenarios, setup, setupTotalLakh,
    budgetGapLakh: +(setupTotalLakh - input.budgetLakh).toFixed(1),
    economics: {
      price: fig(a.price, t('pricePerUnit', def.priceTag)), materials: fig(Math.round(materialsPerUnit), t('materialsPct', 'estimated'), `${a.materialsPct}% of price`),
      labour: fig(Math.round(labourPerUnit), 'estimated', `${workers} workers × ₹${a.wage} × 26 days ÷ ${Math.round(units).toLocaleString('en-IN')} units`),
      freight: fig(Math.round(freightPerUnit), 'estimated'), contribution: fig(Math.round(contribution), 'estimated'),
      monthlyRevenue: revenue(a.util), monthlyContribution: fig(Math.round(monthlyContribution), 'estimated'), paybackMonths,
    },
    workforce: {
      workers: fig(workers, t('workersPerThousand', 'estimated'), `${a.perK} per 1,000 units a month (median of Sangam suppliers in this process)`),
      wage: fig(a.wage, t('wagePerDay', living?.match === 'district' ? 'public' : 'estimated')),
      living: living ? { perDay: living.perDayInr, source: living.source, tag: living.match === 'district' ? 'public' : 'estimated' } : null,
      minimum: minimum ? { perDay: minimum.perDayInr, source: minimum.asNotified } : null,
      score, womenShare: a.women,
    },
    skills, phases, risks: risks.sort((x, y) => ['high', 'medium', 'low'].indexOf(x.level) - ['high', 'medium', 'low'].indexOf(y.level)),
    diversify: opportunities.filter((o) => o.process === line.process).map((o) => ({ name: o.name, marketCr: o.marketCr, growthPct: o.growthPct })),
  };
}

