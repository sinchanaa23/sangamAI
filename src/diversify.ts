// Future diversification for suppliers: adjacent products they could move into, with costs and returns.
// Market sizes, capex and margins are simulated for the prototype.
import { bom } from './data';
import { baseLineCost, district } from './engine';
import type { Seller } from './types';

export interface Opportunity {
  id: string;
  process: string;
  name: string;
  nameHi: string;
  /** Indian market size, rupee crore a year */
  marketCr: number;
  growthPct: number;
  buyers: number;
  /** how much of today's skills and machines carry over, 0-1 */
  overlap: number;
  /** at reference scale, rupee lakh */
  equipmentLakh: number;
  certs: string[];
  certLakh: number;
  trainingLakh: number;
  /** annual revenue at full ramp and reference scale, rupee lakh */
  revenueLakh: number;
  marginPct: number;
  readyMonths: number;
  jobs: number;
  reuses: string[];
  needs: string[];
}

const O = (o: Opportunity) => o;

export const OPPORTUNITIES: Opportunity[] = [
  // Harness assembly
  O({ id: 'ev-battery-harness', process: 'Harness assembly', name: 'EV battery pack and BMS wiring', nameHi: 'ईवी बैटरी पैक और बीएमएस वायरिंग', marketCr: 2400, growthPct: 28, buyers: 9, overlap: 0.85, equipmentLakh: 38, certs: ['IATF 16949'], certLakh: 18, trainingLakh: 6, revenueLakh: 520, marginPct: 14, readyMonths: 9, jobs: 60, reuses: ['Crimping and taping skills', 'Continuity testing', 'Assembly boards'], needs: ['High-voltage crimp tooling', 'Insulation testers', 'IATF quality system'] }),
  O({ id: 'solar-cable-assembly', process: 'Harness assembly', name: 'Solar string cables and junction boxes', nameHi: 'सोलर स्ट्रिंग केबल और जंक्शन बॉक्स', marketCr: 1600, growthPct: 22, buyers: 12, overlap: 0.8, equipmentLakh: 22, certs: ['BIS IS 694'], certLakh: 3, trainingLakh: 4, revenueLakh: 360, marginPct: 13, readyMonths: 6, jobs: 45, reuses: ['Cable cutting and crimping', 'Batch testing'], needs: ['MC4 crimp tools', 'UV-rated material sourcing'] }),
  O({ id: 'appliance-harness', process: 'Harness assembly', name: 'Appliance wiring (fans, ACs, coolers)', nameHi: 'उपकरण वायरिंग (पंखे, एसी, कूलर)', marketCr: 3000, growthPct: 9, buyers: 20, overlap: 0.9, equipmentLakh: 12, certs: ['ISO 9001'], certLakh: 2, trainingLakh: 2, revenueLakh: 300, marginPct: 9, readyMonths: 3, jobs: 40, reuses: ['All current assembly skills'], needs: ['ISO 9001 quality system'] }),
  O({ id: 'medical-cable', process: 'Harness assembly', name: 'Medical device cable assemblies', nameHi: 'चिकित्सा उपकरण केबल असेंबली', marketCr: 800, growthPct: 15, buyers: 5, overlap: 0.6, equipmentLakh: 55, certs: ['ISO 13485'], certLakh: 12, trainingLakh: 10, revenueLakh: 280, marginPct: 20, readyMonths: 14, jobs: 30, reuses: ['Fine assembly skills'], needs: ['Clean assembly room', 'ISO 13485 system', 'Traceability software'] }),
  // Wire drawing
  O({ id: 'solar-dc-cable', process: 'Wire drawing', name: 'Solar DC cable', nameHi: 'सोलर डीसी केबल', marketCr: 4200, growthPct: 25, buyers: 14, overlap: 0.8, equipmentLakh: 160, certs: ['Solar cable type approval'], certLakh: 8, trainingLakh: 3, revenueLakh: 1800, marginPct: 9, readyMonths: 10, jobs: 35, reuses: ['Drawing and annealing lines', 'Copper sourcing'], needs: ['Electron-beam cross-linking access', 'XLPO insulation line'] }),
  O({ id: 'ev-charging-cable', process: 'Wire drawing', name: 'EV charging cable', nameHi: 'ईवी चार्जिंग केबल', marketCr: 1200, growthPct: 30, buyers: 8, overlap: 0.65, equipmentLakh: 210, certs: ['IEC 62893 certification'], certLakh: 12, trainingLakh: 5, revenueLakh: 900, marginPct: 13, readyMonths: 14, jobs: 30, reuses: ['Fine wire drawing', 'Stranding'], needs: ['Multi-core cabling line', 'TPU sheathing'] }),
  O({ id: 'enamelled-wire', process: 'Wire drawing', name: 'Enamelled copper wire for motors', nameHi: 'मोटर के लिए एनामेल्ड तांबे का तार', marketCr: 5000, growthPct: 12, buyers: 18, overlap: 0.7, equipmentLakh: 240, certs: ['BIS IS 13730'], certLakh: 4, trainingLakh: 4, revenueLakh: 2200, marginPct: 7, readyMonths: 12, jobs: 40, reuses: ['Drawing lines', 'Copper sourcing'], needs: ['Enamelling ovens', 'Fume treatment'] }),
  // Connector making
  O({ id: 'ev-charge-connector', process: 'Connector making', name: 'EV charging connectors (Type 2, CCS2)', nameHi: 'ईवी चार्जिंग कनेक्टर', marketCr: 900, growthPct: 32, buyers: 7, overlap: 0.7, equipmentLakh: 120, certs: ['IEC 62196 certification'], certLakh: 15, trainingLakh: 6, revenueLakh: 650, marginPct: 18, readyMonths: 14, jobs: 50, reuses: ['Stamping presses', 'Tool room'], needs: ['High-current contact plating', 'Overmoulding cell'] }),
  O({ id: 'solar-mc4', process: 'Connector making', name: 'Solar MC4 connectors', nameHi: 'सोलर एमसी4 कनेक्टर', marketCr: 700, growthPct: 22, buyers: 10, overlap: 0.8, equipmentLakh: 60, certs: ['IEC 62852 certification'], certLakh: 10, trainingLakh: 4, revenueLakh: 420, marginPct: 15, readyMonths: 9, jobs: 35, reuses: ['Stamping', 'Assembly'], needs: ['UV-stable moulds', 'Sealing test rigs'] }),
  O({ id: 'appliance-terminals', process: 'Connector making', name: 'Appliance terminals and lugs', nameHi: 'उपकरण टर्मिनल और लग', marketCr: 1500, growthPct: 8, buyers: 25, overlap: 0.9, equipmentLakh: 25, certs: ['ISO 9001'], certLakh: 2, trainingLakh: 2, revenueLakh: 380, marginPct: 10, readyMonths: 4, jobs: 25, reuses: ['Stamping presses', 'Plating partners'], needs: ['Progressive dies for new sizes'] }),
  // Polymer extrusion
  O({ id: 'drip-laterals', process: 'Polymer extrusion', name: 'Drip irrigation laterals', nameHi: 'ड्रिप सिंचाई पाइप', marketCr: 3500, growthPct: 14, buyers: 30, overlap: 0.75, equipmentLakh: 70, certs: ['BIS IS 13488'], certLakh: 3, trainingLakh: 3, revenueLakh: 900, marginPct: 11, readyMonths: 6, jobs: 40, reuses: ['Extruders', 'Polymer sourcing'], needs: ['Emitter insertion line', 'Pressure test rig'] }),
  O({ id: 'cable-sheathing', process: 'Polymer extrusion', name: 'Solar cable sheathing compound', nameHi: 'सोलर केबल शीथिंग कंपाउंड', marketCr: 900, growthPct: 20, buyers: 9, overlap: 0.6, equipmentLakh: 110, certs: ['Material type approval'], certLakh: 8, trainingLakh: 4, revenueLakh: 700, marginPct: 12, readyMonths: 10, jobs: 25, reuses: ['Compounding know-how'], needs: ['Twin-screw compounder', 'Lab testing'] }),
  O({ id: 'medical-tubing', process: 'Polymer extrusion', name: 'Medical-grade tubing', nameHi: 'चिकित्सा-ग्रेड ट्यूबिंग', marketCr: 600, growthPct: 16, buyers: 6, overlap: 0.5, equipmentLakh: 150, certs: ['ISO 13485'], certLakh: 20, trainingLakh: 8, revenueLakh: 520, marginPct: 22, readyMonths: 16, jobs: 30, reuses: ['Extrusion know-how'], needs: ['Clean room (class 8)', 'ISO 13485 system'] }),
  // Injection moulding
  O({ id: 'ev-charger-housing', process: 'Injection moulding', name: 'EV charger and battery enclosures', nameHi: 'ईवी चार्जर और बैटरी एनक्लोज़र', marketCr: 1100, growthPct: 30, buyers: 8, overlap: 0.8, equipmentLakh: 80, certs: ['Flame-retardant material approval'], certLakh: 5, trainingLakh: 4, revenueLakh: 600, marginPct: 15, readyMonths: 8, jobs: 40, reuses: ['Moulding machines', 'Tool maintenance'], needs: ['Larger-tonnage press', 'Ultrasonic welding'] }),
  O({ id: 'switch-parts', process: 'Injection moulding', name: 'Electrical switch and socket parts', nameHi: 'बिजली स्विच और सॉकेट पुर्ज़े', marketCr: 2600, growthPct: 10, buyers: 22, overlap: 0.85, equipmentLakh: 45, certs: ['BIS IS 3854'], certLakh: 3, trainingLakh: 2, revenueLakh: 520, marginPct: 11, readyMonths: 5, jobs: 35, reuses: ['Moulding machines'], needs: ['Multi-cavity moulds'] }),
  O({ id: 'medical-disposables', process: 'Injection moulding', name: 'Medical disposables (syringe parts)', nameHi: 'चिकित्सा डिस्पोज़ेबल', marketCr: 1800, growthPct: 18, buyers: 10, overlap: 0.55, equipmentLakh: 140, certs: ['ISO 13485'], certLakh: 20, trainingLakh: 8, revenueLakh: 680, marginPct: 21, readyMonths: 15, jobs: 45, reuses: ['Precision moulding'], needs: ['Clean room (class 8)', 'Sterile packing partner'] }),
  // Packaging
  O({ id: 'moulded-fibre', process: 'Packaging', name: 'Moulded-fibre trays from crop residue', nameHi: 'फसल अवशेष से मोल्डेड-फाइबर ट्रे', marketCr: 1400, growthPct: 24, buyers: 15, overlap: 0.6, equipmentLakh: 55, certs: ['Compostability test'], certLakh: 4, trainingLakh: 3, revenueLakh: 380, marginPct: 16, readyMonths: 7, jobs: 60, reuses: ['Packaging design', 'Buyer relationships'], needs: ['Pulp moulding machine', 'Crop-residue collection'] }),
  O({ id: 'food-grade', process: 'Packaging', name: 'Food-grade compostable packaging', nameHi: 'खाद्य-ग्रेड कम्पोस्टेबल पैकेजिंग', marketCr: 2000, growthPct: 20, buyers: 18, overlap: 0.5, equipmentLakh: 70, certs: ['FSSAI packaging compliance'], certLakh: 3, trainingLakh: 3, revenueLakh: 450, marginPct: 14, readyMonths: 8, jobs: 50, reuses: ['Converting machines'], needs: ['Hygienic converting area', 'Food-contact testing'] }),
  O({ id: 'export-cartons', process: 'Packaging', name: 'Export cartons for ODOP crafts', nameHi: 'ओडीओपी शिल्प के लिए निर्यात कार्टन', marketCr: 800, growthPct: 12, buyers: 25, overlap: 0.9, equipmentLakh: 15, certs: [], certLakh: 0, trainingLakh: 2, revenueLakh: 200, marginPct: 10, readyMonths: 2, jobs: 20, reuses: ['All current machines'], needs: ['Export-grade board sourcing'] }),
];

const REF_CAPACITY: Record<string, number> = {
  'Harness assembly': 15000, 'Wire drawing': 20000, 'Connector making': 20000,
  'Polymer extrusion': 30000, 'Injection moulding': 20000, Packaging: 30000,
};

export interface OppResult {
  opp: Opportunity;
  fit: number;
  scale: number;
  investment: { equipment: number; certification: number; training: number; workingCapital: number; total: number };
  revenueLakh: number;
  profitLakh: number;
  paybackYears: number | null;
  roi5: number;
  roi10: number;
  /** cumulative cash, rupee lakh, years 0-10 */
  cash: { year: number; asIs: number; expand: number }[];
  certsHeld: string[];
  certsMissing: string[];
}

/** Today's business, for the "stay as is" comparison: revenue and profit per year in rupee lakh. */
export function currentBusiness(s: Seller) {
  const line = bom.find((l) => l.process === s.process)!;
  const revenue = (s.monthlyCapacity * 12 * baseLineCost(line) * s.priceIndex * 0.7) / 1e5;
  return { revenue, profit: revenue * 0.08 };
}

export function evaluateOpportunity(s: Seller, opp: Opportunity): OppResult {
  const scale = Math.min(2, Math.max(0.4, s.monthlyCapacity / REF_CAPACITY[opp.process]));
  const certsHeld = opp.certs.filter((c) => s.certs.includes(c));
  const certsMissing = opp.certs.filter((c) => !s.certs.includes(c));
  const certShare = opp.certs.length ? certsHeld.length / opp.certs.length : 1;
  const fit = Math.round((0.55 * opp.overlap + 0.25 * certShare + 0.2 * district(s.districtId).power) * 100);

  const revenueLakh = opp.revenueLakh * scale;
  const profitLakh = (revenueLakh * opp.marginPct) / 100;
  const equipment = opp.equipmentLakh * Math.pow(scale, 0.7);
  const certification = certsMissing.length ? opp.certLakh : 0;
  const training = opp.trainingLakh * Math.pow(scale, 0.5);
  const workingCapital = revenueLakh * 0.15;
  const total = equipment + certification + training + workingCapital;

  const base = currentBusiness(s);
  const cash: OppResult['cash'] = [{ year: 0, asIs: 0, expand: -total }];
  let asIs = 0, expand = -total, paybackYears: number | null = null;
  let profit5 = 0, profit10 = 0;
  for (let y = 1; y <= 10; y++) {
    const operating = Math.min(1, Math.max(0, (12 * y - opp.readyMonths) / 12));
    const yearsRunning = Math.max(0, y - opp.readyMonths / 12);
    const ramp = Math.min(1, 0.5 + 0.25 * Math.floor(yearsRunning));
    const growth = Math.min(2, Math.pow(1 + opp.growthPct / 200, y - 1));
    const p = profitLakh * operating * ramp * growth;
    const b = base.profit * Math.pow(1.05, y - 1);
    asIs += b;
    const before = expand - asIs + b; // opportunity cash before this year
    expand += b + p;
    if (y <= 5) profit5 += p;
    profit10 += p;
    if (paybackYears === null && expand - asIs >= 0) paybackYears = y - 1 + Math.min(1, -before / Math.max(p, 1e-9));
    cash.push({ year: y, asIs: Math.round(asIs), expand: Math.round(expand) });
  }
  return {
    opp, fit, scale,
    investment: { equipment, certification, training, workingCapital, total },
    revenueLakh, profitLakh, paybackYears,
    roi5: (profit5 - total) / total, roi10: (profit10 - total) / total,
    cash, certsHeld, certsMissing,
  };
}

export const opportunitiesFor = (s: Seller) =>
  OPPORTUNITIES.filter((o) => o.process === s.process).map((o) => evaluateOpportunity(s, o)).sort((a, b) => b.fit * (1 + b.roi10) - a.fit * (1 + a.roi10));
