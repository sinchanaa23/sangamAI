// Sustainability Scorecard: a supplier ticks Yes / Partly / No / N/A per checklist item and
// earns points towards a 0-100 score and a Bronze-Silver-Gold-Platinum level. Points, weights
// and thresholds are Sangam's model choices, not a published standard - everything here is
// tagged 'estimated' for that reason (same as FAIR_WORK_RULES).
//
// Structure mirrors src/fairwork.ts: one rules table, a human-readable reasons list, and a
// legal floor that takes precedence. The checklist covers 5 pillars (SDGs 6, 7, 12, 13) with
// item weights summing to exactly 100 for every sector; sector-specific items (RoHS for EV,
// fly ash for construction, organic certification for agri) carry the points their sector
// needs, so each sector's applicable items always total 100.

import type { SectorId } from './types';

export type PillarId = 'energy' | 'materials' | 'water' | 'local' | 'certificates';

export type AnswerValue = 'yes' | 'partly' | 'no' | 'na';

export type EvidenceState = 'declared' | 'document' | 'verified';

export interface ChecklistItem {
  id: string;
  pillar: PillarId;
  label: string;
  /** Hindi label shown beside the English one on the phone-first checklist page */
  labelHi: string;
  /** points within its pillar; a pillar's item weights add up to its PILLARS weight */
  weight: number;
  /** undefined = applies to every sector; sector items (RoHS, fly ash, organic) list their sector */
  sectors?: SectorId[];
  /** Consent to Operate / hazardous-waste authorisation: missing here caps the level at Bronze */
  legalGate?: boolean;
  /** counts as a certificate for the Platinum gate (ISO 14001, ZED) */
  certificate?: boolean;
  /** help-scheme hint shown on the checklist and next-steps list */
  schemes?: string;
}

/** The 5 pillars with their nominal point weights and the SDGs they map to. */
export const PILLARS: { id: PillarId; label: string; labelHi: string; weight: number; sdg: string }[] = [
  { id: 'energy', label: 'Energy and climate', labelHi: 'ऊर्जा और जलवायु', weight: 30, sdg: '7, 13' },
  { id: 'materials', label: 'Materials and waste', labelHi: 'सामग्री और अपशिष्ट', weight: 25, sdg: '12' },
  { id: 'water', label: 'Water and pollution', labelHi: 'जल और प्रदूषण', weight: 20, sdg: '6, 12' },
  { id: 'local', label: 'Local sourcing and logistics', labelHi: 'स्थानीय खरीद और ढुलाई', weight: 15, sdg: '12, 9' },
  { id: 'certificates', label: 'Certificates and disclosure', labelHi: 'प्रमाणपत्र और पारदर्शिता', weight: 10, sdg: '12.6' },
];

// Common items total 95 points; each sector's specific item carries the last 5, so the
// applicable total is 100 for ev (RoHS), construction (fly ash) and agri (organic).
export const CHECKLIST: ChecklistItem[] = [
  // Energy and climate (30)
  { id: 'energy-renewable', pillar: 'energy', weight: 10,
    label: 'Electricity from renewable sources (solar, wind, biogas)',
    labelHi: 'बिजली नवीकरणीय स्रोतों (सौर, पवन, बायोगैस) से आती है' },
  { id: 'energy-audit', pillar: 'energy', weight: 8,
    label: 'Energy audit done, or BEE star-rated motors in use',
    labelHi: 'ऊर्जा ऑडिट हुआ, या BEE स्टार-रेटेड मोटर लगे हैं',
    schemes: 'SIDBI offers concessional finance for MSME energy-efficiency projects.' },
  { id: 'energy-tracked', pillar: 'energy', weight: 6,
    label: 'Energy use written down every month',
    labelHi: 'बिजली की खपत हर महीने दर्ज होती है' },
  { id: 'energy-generator-backup', pillar: 'energy', weight: 6,
    label: 'Diesel generator runs only when the grid fails',
    labelHi: 'डीजल जनरेटर सिर्फ़ बिजली कटौती में चलता है' },

  // Materials and waste (20 common + 5 sector for ev / construction)
  { id: 'waste-segregation', pillar: 'materials', weight: 6,
    label: 'Scrap separated and sold to authorised recyclers',
    labelHi: 'स्क्रैप अलग करके अधिकृत रीसाइक्लरों को बेचा जाता है' },
  { id: 'materials-recycled-input', pillar: 'materials', weight: 5,
    label: 'Recycled material used as a share of inputs',
    labelHi: 'कच्चे माल में रीसाइकल सामग्री का इस्तेमाल होता है' },
  { id: 'packaging-epr', pillar: 'materials', weight: 5,
    label: 'Reusable packaging, or EPR registration for plastic packaging',
    labelHi: 'दोबारा इस्तेमाल योग्य पैकेजिंग, या प्लास्टिक पैकेजिंग हेतु EPR पंजीकरण' },
  { id: 'waste-hazardous-auth', pillar: 'materials', weight: 4, legalGate: true,
    label: 'Hazardous-waste authorisation from the State Pollution Control Board (where required)',
    labelHi: 'राज्य प्रदूषण बोर्ड की ओर से हानिकारक अपशिष्ट की अनुमति (जहाँ लागू हो)' },
  { id: 'sector-rohs', pillar: 'materials', weight: 5, sectors: ['ev'],
    label: 'RoHS-compliant materials (restricted substances kept out)',
    labelHi: 'RoHS-अनुरूप सामग्री (प्रतिबंधित पदार्थ शामिल नहीं)' },
  { id: 'sector-flyash', pillar: 'materials', weight: 5, sectors: ['construction'],
    label: 'Fly ash or construction-and-demolition waste used in the product',
    labelHi: 'उत्पाद में फ्लाई ऐश या निर्माण-ध्वस्तीकरण अपशिष्ट का उपयोग' },

  // Water and pollution (20)
  { id: 'water-consent', pillar: 'water', weight: 10, legalGate: true,
    label: 'Consent to Operate from the State Pollution Control Board',
    labelHi: 'राज्य प्रदूषण बोर्ड की ऑपरेट करने की सहमति (Consent to Operate)' },
  { id: 'water-effluent', pillar: 'water', weight: 6,
    label: 'Effluent treated on site, or a CETP connection',
    labelHi: 'अपशिष्ट जल की साइट पर शुद्धि, या CETP से कनेक्शन' },
  { id: 'water-reuse', pillar: 'water', weight: 4,
    label: 'Water reused on site, or rainwater harvested',
    labelHi: 'पानी का फिर इस्तेमाल, या वर्षा जल संचयन' },

  // Local sourcing and logistics (15) - ties to Atmanirbhar Bharat
  { id: 'local-inputs', pillar: 'local', weight: 9,
    label: 'Inputs bought from Indian suppliers, or within 300 km',
    labelHi: 'सामान भारतीय सप्लायरों से, या 300 किमी के भीतर खरीदा जाता है' },
  { id: 'local-transport', pillar: 'local', weight: 6,
    label: 'Transport shared or consolidated with other shipments',
    labelHi: 'ढुलाई अन्य शिपमेंट के साथ साझा या संगठित होती है' },

  // Certificates and disclosure (10 common + 5 sector for agri)
  { id: 'cert-iso14001', pillar: 'certificates', weight: 4, certificate: true,
    label: 'ISO 14001 environmental management certificate',
    labelHi: 'ISO 14001 पर्यावरण प्रबंधन प्रमाणपत्र' },
  { id: 'cert-zed', pillar: 'certificates', weight: 3, certificate: true,
    label: 'MSME ZED certificate (Bronze, Silver or Gold)',
    labelHi: 'MSME ZED प्रमाणपत्र (कांस्य, रजत या स्वर्ण)',
    schemes: 'ZED certification is subsidised for MSMEs.' },
  { id: 'disclosure-annual', pillar: 'certificates', weight: 3,
    label: 'Yearly energy and waste figures published',
    labelHi: 'हर साल ऊर्जा और अपशिष्ट के आँकड़े प्रकाशित होते हैं' },
  { id: 'sector-organic', pillar: 'certificates', weight: 5, sectors: ['agri'], certificate: true,
    label: 'Organic or natural-farming certification (NPOP / PGS-India)',
    labelHi: 'जैविक या प्राकृतिक खेती का प्रमाणपत्र (NPOP / PGS-India)' },
];

/** The one table of level rules. Tune here, nowhere else. */
export const SUSTAINABILITY_RULES = {
  /** score from which Silver starts */
  silverScore: 40,
  /** score from which Gold starts */
  goldScore: 60,
  /** score from which Platinum starts */
  platinumScore: 80,
  /** verified-evidence items Gold needs (stops greenwashing) */
  goldVerified: 2,
  /** verified items Platinum needs, including platinumCertificates certificate items */
  platinumVerified: 4,
  platinumCertificates: 1,
} as const;

export type SustainabilityLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Not assessed';

export interface ChecklistAnswer {
  value: AnswerValue;
  evidence: EvidenceState;
}

/** Answers keyed by checklist item id. A missing answer counts as 'no'. */
export type SustainabilityAnswers = Record<string, ChecklistAnswer>;

export interface SustainabilityResult {
  /** 0-100, always out of the sector's applicable items */
  score: number;
  level: SustainabilityLevel;
  /** 0-100 per pillar, for the drawer card breakdown */
  pillarScores: Record<PillarId, number>;
  /** human-readable, same voice as the Fair Work reasons */
  reasons: string[];
  verifiedCount: number;
  /** true when the legal gate capped the level at Bronze */
  legalCap: boolean;
  /** the rules are Sangam's model choices */
  tag: 'estimated';
}

export const LEVEL_META: Record<SustainabilityLevel, { label: string; color: string; soft: string; icon: string }> = {
  Bronze: { label: 'Bronze', color: '#b45309', soft: 'rgba(180, 83, 9, 0.16)', icon: '🥉' },
  Silver: { label: 'Silver', color: '#64748b', soft: 'rgba(100, 116, 139, 0.16)', icon: '🥈' },
  Gold: { label: 'Gold', color: '#ca8a04', soft: 'rgba(202, 138, 4, 0.18)', icon: '🥇' },
  Platinum: { label: 'Platinum', color: '#7c3aed', soft: 'rgba(124, 58, 237, 0.16)', icon: '💎' },
  'Not assessed': { label: 'Not assessed', color: '#6b7280', soft: 'rgba(107, 114, 128, 0.12)', icon: '?' },
};

const LADDER: SustainabilityLevel[] = ['Platinum', 'Gold', 'Silver', 'Bronze'];

const appliesTo = (item: ChecklistItem, sector: SectorId) => !item.sectors || item.sectors.includes(sector);

const levelForScore = (score: number): Exclude<SustainabilityLevel, 'Not assessed'> =>
  score >= SUSTAINABILITY_RULES.platinumScore ? 'Platinum'
  : score >= SUSTAINABILITY_RULES.goldScore ? 'Gold'
  : score >= SUSTAINABILITY_RULES.silverScore ? 'Silver'
  : 'Bronze';

const emptyPillarScores = (): Record<PillarId, number> =>
  Object.fromEntries(PILLARS.map((p) => [p.id, 0])) as Record<PillarId, number>;

/**
 * Score a checklist. 'yes' earns the full weight, 'partly' half, 'no' nothing; an unanswered
 * item counts as 'no'. 'na' removes the item and the remaining weights rescale, so the score
 * always reads out of 100 for the sector's applicable items. Evidence gates can drop the
 * level, and a missing legal gate caps it at Bronze - the legal floor outranks the ladder and
 * the gates, exactly as Fair Work's minimum-wage floor outranks the living-wage ladder.
 */
export function scoreSustainability(answers: SustainabilityAnswers, sector: SectorId): SustainabilityResult {
  const applicable = CHECKLIST.filter((it) => appliesTo(it, sector) && answers[it.id]?.value !== 'na');

  // 'Not assessed' is kept distinct from a Bronze 0: it means the checklist was never filled in.
  if (applicable.length === 0 || applicable.every((it) => answers[it.id] === undefined)) {
    return {
      score: 0,
      level: 'Not assessed',
      pillarScores: emptyPillarScores(),
      reasons: ['Sustainability checklist not filled in yet.'],
      verifiedCount: 0,
      legalCap: false,
      tag: 'estimated',
    };
  }

  const pointsOf = (it: ChecklistItem): number => {
    const v = answers[it.id]?.value ?? 'no';
    return v === 'yes' ? it.weight : v === 'partly' ? it.weight / 2 : 0;
  };

  const totalWeight = applicable.reduce((n, it) => n + it.weight, 0);
  const earned = applicable.reduce((n, it) => n + pointsOf(it), 0);
  const score = totalWeight > 0 ? Math.round((100 * earned) / totalWeight) : 0;

  const pillarScores = emptyPillarScores();
  for (const p of PILLARS) {
    const items = applicable.filter((it) => it.pillar === p.id);
    const w = items.reduce((n, it) => n + it.weight, 0);
    const e = items.reduce((n, it) => n + pointsOf(it), 0);
    pillarScores[p.id] = w > 0 ? Math.round((100 * e) / w) : 0;
  }

  // Verified evidence only counts on an item that is actually held: a verified 'no' is meaningless.
  const isVerified = (it: ChecklistItem) => {
    const a = answers[it.id];
    return a !== undefined && a.evidence === 'verified' && (a.value === 'yes' || a.value === 'partly');
  };
  const verifiedCount = applicable.filter(isVerified).length;
  const certificateVerified = applicable.filter((it) => it.certificate && isVerified(it)).length;

  const gateMet = (level: SustainabilityLevel): boolean => {
    if (level === 'Platinum') return verifiedCount >= SUSTAINABILITY_RULES.platinumVerified && certificateVerified >= SUSTAINABILITY_RULES.platinumCertificates;
    if (level === 'Gold') return verifiedCount >= SUSTAINABILITY_RULES.goldVerified;
    return true; // Bronze and Silver carry no evidence gate
  };

  const startLevel = levelForScore(score);
  let level: SustainabilityLevel = startLevel;
  while (!gateMet(level)) level = LADDER[LADDER.indexOf(level) + 1]; // Bronze is the floor, its gate is always met

  const naCount = CHECKLIST.filter((it) => appliesTo(it, sector) && answers[it.id]?.value === 'na').length;

  // The legal floor comes first: a legally required consent or authorisation that the supplier
  // cannot show (anything short of a clear yes; blank counts as no) caps the level at Bronze
  // whatever the score - same precedence idea as Fair Work's minimum-wage floor.
  const missingLegal = applicable.filter((it) => it.legalGate && (answers[it.id]?.value ?? 'no') !== 'yes');
  if (missingLegal.length > 0) level = 'Bronze';

  const reasons: string[] = [];
  reasons.push(`Score ${score}/100 on this sector's checklist (weights and thresholds are Sangam's model choices, tagged estimated).`);
  if (naCount > 0) {
    reasons.push(`${naCount} item${naCount > 1 ? 's' : ''} marked not applicable; the remaining weights are rescaled so the score stays out of 100.`);
  }
  if (missingLegal.length > 0) {
    reasons.push(`Legal requirement missing (${missingLegal.map((it) => it.label).join('; ')}): the level is capped at Bronze whatever the score - the legal floor outranks the ladder.`);
  } else {
    const dropped = LADDER.indexOf(level) > LADDER.indexOf(startLevel);
    if (dropped) {
      reasons.push(level === 'Silver'
        ? `Gold needs at least ${SUSTAINABILITY_RULES.goldVerified} items verified by the Sangam team; ${verifiedCount} verified so far, so the level is held at Silver.`
        : `Platinum needs ${SUSTAINABILITY_RULES.platinumVerified} verified items including a certificate; ${verifiedCount} verified (${certificateVerified} certificate) so far, so the level is held at ${level}.`);
    } else if (level === 'Platinum') {
      reasons.push(`Platinum gate met: ${verifiedCount} items verified by the Sangam team, including ${certificateVerified} certificate.`);
    } else if (level === 'Gold') {
      reasons.push(`Gold gate met: ${verifiedCount} items verified by the Sangam team.`);
    }
  }

  return { score, level, pillarScores, reasons, verifiedCount, legalCap: missingLegal.length > 0, tag: 'estimated' };
}

/**
 * Unticked items sorted by the points a full 'yes' would add to the score, for the
 * "next steps to reach Gold" list. Each item's own schemes hint travels with it.
 */
export function nextSteps(answers: SustainabilityAnswers, sector: SectorId): { item: ChecklistItem; pointsGained: number }[] {
  const applicable = CHECKLIST.filter((it) => appliesTo(it, sector) && answers[it.id]?.value !== 'na');
  const totalWeight = applicable.reduce((n, it) => n + it.weight, 0);
  const scale = totalWeight > 0 ? 100 / totalWeight : 0; // same rescale as the score, so gains read in score points
  return applicable
    .filter((it) => {
      const v = answers[it.id]?.value;
      return v !== 'yes' && v !== 'na'; // missing answers count as 'no' and are listed
    })
    .map((it) => {
      const v = answers[it.id]?.value ?? 'no';
      const raw = v === 'partly' ? it.weight / 2 : it.weight; // 'partly' has exactly its other half left to gain
      return { item: it, pointsGained: +(raw * scale).toFixed(1) };
    })
    .sort((a, b) => b.pointsGained - a.pointsGained);
}
