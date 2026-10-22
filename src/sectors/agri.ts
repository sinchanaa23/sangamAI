// Agri and food processing. Companies, capacities, prices and scores are simulated; places and HS codes are real.
// Capacities are in tonnes of finished product supported per month.
import type { SectorTemplate } from './types';

export const agri: SectorTemplate = {
  id: 'agri',
  name: 'Agri and food processing',
  blurb: 'A packaged-food maker sourcing millet mixes from farmer collectives',
  buyer: {
    name: 'Annapoorna Foods', product: 'Ready-to-cook millet and vegetable mix', unitLabel: 'tonne',
    plantDistrictId: 'coimbatore', monthlyUnits: 300, importLeadDays: 40, safetyStockDays: 20,
    unitsPerContainer: 25, lostContribution: 25000,
  },
  bom: [
    {
      id: 'millets', name: 'Millets (ragi, jowar, bajra), cleaned', cost: 42000, hs: '100829', spec: 'Cleaned, destoned, moisture under 12%, 600 kg per tonne of mix',
      importedFrom: 'India', process: 'Millet processing', requiredCerts: ['FSSAI licence'], weightKg: 600,
      tiers: [{ name: 'Raw millet from farmers', stage: 'raw material', indianSupply: 'strong', indianRegions: 'Karnataka, Andhra Pradesh, Rajasthan, Maharashtra', note: 'India is the largest millet producer' }],
    },
    {
      id: 'vegetables', name: 'Dehydrated vegetables (onion, carrot, peas)', cost: 55000, hs: '071290', spec: 'Air-dried flakes, moisture under 6%, 250 kg per tonne of mix',
      importedFrom: 'China', process: 'Vegetable dehydration', requiredCerts: ['FSSAI licence', 'HACCP'], weightKg: 250,
      tiers: [
        { name: 'Fresh vegetables', stage: 'raw material', indianSupply: 'strong', indianRegions: 'Maharashtra (onion), Karnataka, Tamil Nadu', note: 'Plenty of produce; drying capacity is the gap' },
        { name: 'Industrial dryers', hs: '841931', stage: 'intermediate', indianSupply: 'partial', indianRegions: 'Gujarat, Tamil Nadu', note: 'Small solar dryers are made in India; large belt dryers are often imported' },
      ],
    },
    {
      id: 'flakes', name: 'Cereal flakes (puffed and flaked grains)', cost: 20000, hs: '190410', spec: 'Flaked millet and puffed grains, 200 kg per tonne of mix',
      importedFrom: 'China', process: 'Grain flaking', requiredCerts: ['FSSAI licence'], weightKg: 200,
      tiers: [{ name: 'Grains', stage: 'raw material', indianSupply: 'strong', indianRegions: 'All India', note: '' }],
    },
    {
      id: 'spices', name: 'Seasoning and spice blend', cost: 18000, spec: 'Dry spice blend to recipe, 60 kg per tonne of mix',
      importedFrom: 'India', process: 'Spice processing', requiredCerts: ['FSSAI licence'], weightKg: 60,
      tiers: [{ name: 'Whole spices', stage: 'raw material', indianSupply: 'strong', indianRegions: 'Kerala, Andhra Pradesh, Rajasthan', note: 'India is the largest spice producer' }],
    },
    {
      id: 'film', name: 'Multilayer packaging film and pouches', cost: 22000, hs: '392321', spec: 'Food-grade laminate pouches, 200 g and 1 kg',
      importedFrom: 'China', process: 'Flexible packaging', requiredCerts: ['FSSAI packaging compliance'], weightKg: 40,
      tiers: [
        { name: 'Polyethylene and BOPP film', stage: 'intermediate', indianSupply: 'strong', indianRegions: 'Gujarat, Maharashtra, Madhya Pradesh', note: '' },
        { name: 'Food-grade inks and adhesives', stage: 'raw material', indianSupply: 'partial', indianRegions: 'Gujarat', note: '' },
      ],
    },
    {
      id: 'cartons', name: 'Corrugated cartons', cost: 8000, hs: '481910', spec: '5-ply shipper cartons',
      importedFrom: 'India', process: 'Packaging', requiredCerts: [], weightKg: 70,
      tiers: [{ name: 'Kraft paper', stage: 'raw material', indianSupply: 'strong', indianRegions: 'Gujarat, Tamil Nadu', note: '' }],
    },
  ],
  sellers: [
    { id: 'a1', name: 'Anantapur Millet FPO', type: 'FPO', districtId: 'anantapur', process: 'Millet processing', monthlyCapacity: 120, certs: ['FSSAI licence'], priceIndex: 0.9, quality: 0.84, verification: 'verified', workers: 1200, machines: ['Destoner', 'Grader', 'Dehuller'], about: 'Farmer producer company of about 1,100 millet growers.' },
    { id: 'a2', name: 'Dharwad Siridhanya Producer Co', type: 'FPO', districtId: 'dharwad', process: 'Millet processing', monthlyCapacity: 80, certs: [], priceIndex: 0.88, quality: 0.8, verification: 'declared', workers: 800, machines: ['Cleaner', 'Grader'], about: 'Millet FPO in north Karnataka.' },
    { id: 'a3', name: 'Madurai Grain Processors', type: 'MSME', districtId: 'madurai', process: 'Millet processing', monthlyCapacity: 200, certs: ['FSSAI licence'], priceIndex: 1.0, quality: 0.87, verification: 'verified', workers: 60, machines: ['Cleaning line', 'Colour sorter'], about: 'Grain processing unit.' },
    { id: 'a4', name: 'Krishnagiri Solar Dryer SHG Network', type: 'SHG federation', districtId: 'krishnagiri', process: 'Vegetable dehydration', monthlyCapacity: 40, certs: ['FSSAI licence'], priceIndex: 0.85, quality: 0.8, verification: 'verified', workers: 220, machines: ['Solar tunnel dryers', 'Slicers'], about: 'Women SHGs running village solar dryers.' },
    { id: 'a5', name: 'Nashik Dehydration Works', type: 'MSME', districtId: 'nashik', process: 'Vegetable dehydration', monthlyCapacity: 150, certs: ['FSSAI licence', 'HACCP'], priceIndex: 1.04, quality: 0.88, verification: 'verified', workers: 90, machines: ['Belt dryer', 'Flaking line'], about: 'Onion and vegetable dehydration plant.' },
    { id: 'a6', name: 'Coimbatore Agro Dryers', type: 'MSME', districtId: 'coimbatore', process: 'Vegetable dehydration', monthlyCapacity: 90, certs: ['FSSAI licence'], priceIndex: 0.98, quality: 0.84, verification: 'declared', workers: 55, machines: ['Tray dryers'], about: 'Vegetable and herb dryer.' },
    { id: 'a7', name: 'Anantapur Women Dryers Cooperative', type: 'Cooperative', districtId: 'anantapur', process: 'Vegetable dehydration', monthlyCapacity: 30, certs: [], priceIndex: 0.82, quality: 0.76, verification: 'declared', workers: 160, machines: ['Solar dryers'], about: 'Women’s cooperative drying vegetables.' },
    { id: 'a8', name: 'Kochi Spice Processors', type: 'MSME', districtId: 'kochi', process: 'Spice processing', monthlyCapacity: 100, certs: ['FSSAI licence', 'HACCP'], priceIndex: 1.0, quality: 0.9, verification: 'verified', workers: 70, machines: ['Cryo grinder', 'Blender', 'Steam steriliser'], about: 'Spice grinding and blending.' },
    { id: 'a9', name: 'Vijayawada Chilli and Spice FPO', type: 'FPO', districtId: 'vijayawada', process: 'Spice processing', monthlyCapacity: 80, certs: ['FSSAI licence'], priceIndex: 0.9, quality: 0.82, verification: 'declared', workers: 900, machines: ['Pulveriser', 'Blender'], about: 'Chilli growers’ producer company.' },
    { id: 'a10', name: 'Pithampur Flexipack', type: 'MSME', districtId: 'pithampur', process: 'Flexible packaging', monthlyCapacity: 400, certs: ['FSSAI packaging compliance'], priceIndex: 1.06, quality: 0.88, verification: 'verified', workers: 120, machines: ['Rotogravure press', 'Laminator', 'Pouch maker'], about: 'Flexible packaging converter.' },
    { id: 'a11', name: 'Vapi Laminates', type: 'MSME', districtId: 'vapi', process: 'Flexible packaging', monthlyCapacity: 250, certs: [], priceIndex: 0.97, quality: 0.82, verification: 'declared', workers: 80, machines: ['Laminator', 'Slitter'], about: 'Laminate maker.' },
    { id: 'a12', name: 'Tiruppur Corrugators', type: 'MSME', districtId: 'tiruppur', process: 'Packaging', monthlyCapacity: 500, certs: [], priceIndex: 0.9, quality: 0.83, verification: 'verified', workers: 45, machines: ['Corrugator'], about: 'Corrugated box maker.' },
    { id: 'a13', name: 'Mysuru Flakes and Puffs', type: 'MSME', districtId: 'mysuru', process: 'Grain flaking', monthlyCapacity: 150, certs: ['FSSAI licence'], priceIndex: 1.02, quality: 0.86, verification: 'verified', workers: 50, machines: ['Flaking mill', 'Puffing gun'], about: 'Flakes and puffed cereals.' },
    { id: 'a14', name: 'Tumakuru Puffed Rice SHG', type: 'SHG federation', districtId: 'tumakuru', process: 'Grain flaking', monthlyCapacity: 60, certs: [], priceIndex: 0.86, quality: 0.78, verification: 'declared', workers: 130, machines: ['Traditional puffing kilns'], about: 'SHGs making puffed rice and millet.' },
  ],
  newSites: [
    { id: 'an1', name: 'Coimbatore Vegetable Dehydration Park', process: 'Vegetable dehydration', districtId: 'coimbatore', capexCr: 6, priceIndex: 0.93, readyMonths: 10, quality: 0.85, rural: false, workers: 110 },
    { id: 'an2', name: 'Tiruppur Flexible Packaging Line', process: 'Flexible packaging', districtId: 'tiruppur', capexCr: 9, priceIndex: 0.98, readyMonths: 12, quality: 0.85, rural: false, workers: 70 },
    { id: 'an3', name: 'Dharwad Millet Flaking Unit (FPO)', process: 'Grain flaking', districtId: 'dharwad', capexCr: 2.5, priceIndex: 0.88, readyMonths: 8, quality: 0.8, rural: true, workers: 60 },
  ],
  processes: [
    { name: 'Millet processing', nameHi: 'मिलेट प्रसंस्करण', lakhPerThousand: 600, months: 4, refCapacity: 100 },
    { name: 'Vegetable dehydration', nameHi: 'सब्ज़ी निर्जलीकरण', lakhPerThousand: 3500, months: 6, refCapacity: 80 },
    { name: 'Grain flaking', nameHi: 'अनाज फ्लेकिंग', lakhPerThousand: 1200, months: 5, refCapacity: 100 },
    { name: 'Spice processing', nameHi: 'मसाला प्रसंस्करण', lakhPerThousand: 1000, months: 4, refCapacity: 80 },
    { name: 'Flexible packaging', nameHi: 'लचीली पैकेजिंग', lakhPerThousand: 400, months: 6, refCapacity: 300 },
    { name: 'Packaging', nameHi: 'पैकेजिंग', lakhPerThousand: 150, months: 3, refCapacity: 300 },
  ],
  certs: {
    'FSSAI licence': { costLakh: 0.5, months: 2, labelHi: 'FSSAI लाइसेंस', schemes: ['PM Formalisation of Micro Food Processing Enterprises (PM FME)'] },
    HACCP: { costLakh: 3, months: 4, labelHi: 'HACCP प्रमाणन', schemes: ['PM FME'] },
    'FSSAI packaging compliance': { costLakh: 2, months: 3, labelHi: 'FSSAI पैकेजिंग अनुपालन', schemes: ['MSME ZED certification support'] },
  },
  demandSignals: [
    { process: 'Millet processing', buyers: 9, monthlyUnits: 1800, region: 'South India', from: '2027' },
    { process: 'Vegetable dehydration', buyers: 7, monthlyUnits: 900, region: 'All India', from: '2027' },
    { process: 'Grain flaking', buyers: 6, monthlyUnits: 700, region: 'South India', from: '2027' },
    { process: 'Spice processing', buyers: 10, monthlyUnits: 600, region: 'All India', from: '2027' },
    { process: 'Flexible packaging', buyers: 12, monthlyUnits: 2500, region: 'All India', from: '2027' },
    { process: 'Packaging', buyers: 15, monthlyUnits: 4000, region: 'Tamil Nadu and Karnataka', from: '2027' },
  ],
  opportunities: [
    { id: 'millet-flour', process: 'Millet processing', name: 'Millet flours and mixes for schools (PM POSHAN)', nameHi: 'स्कूलों के लिए मिलेट आटा और मिश्रण', marketCr: 1200, growthPct: 20, buyers: 15, overlap: 0.85, equipmentLakh: 25, certs: ['FSSAI licence'], certLakh: 0.5, trainingLakh: 2, revenueLakh: 300, marginPct: 12, readyMonths: 4, jobs: 40, reuses: ['Cleaning and grading', 'Farmer network'], needs: ['Pulveriser', 'Packing machine'] },
    { id: 'millet-snacks', process: 'Millet processing', name: 'Millet snacks and cookies', nameHi: 'मिलेट स्नैक्स और कुकीज़', marketCr: 2000, growthPct: 25, buyers: 20, overlap: 0.6, equipmentLakh: 60, certs: ['HACCP'], certLakh: 3, trainingLakh: 4, revenueLakh: 450, marginPct: 16, readyMonths: 8, jobs: 60, reuses: ['Millet sourcing'], needs: ['Extruder or baking line', 'Food technologist'] },
    { id: 'fruit-powders', process: 'Vegetable dehydration', name: 'Fruit and vegetable powders', nameHi: 'फल और सब्ज़ी पाउडर', marketCr: 1500, growthPct: 18, buyers: 14, overlap: 0.75, equipmentLakh: 45, certs: ['HACCP'], certLakh: 3, trainingLakh: 2, revenueLakh: 350, marginPct: 18, readyMonths: 6, jobs: 50, reuses: ['Dryers', 'Produce sourcing'], needs: ['Pulveriser', 'Moisture analyser'] },
    { id: 'export-dehydrated', process: 'Vegetable dehydration', name: 'Export-grade dehydrated onion', nameHi: 'निर्यात-ग्रेड सूखा प्याज़', marketCr: 3000, growthPct: 9, buyers: 25, overlap: 0.8, equipmentLakh: 90, certs: ['HACCP'], certLakh: 3, trainingLakh: 2, revenueLakh: 700, marginPct: 11, readyMonths: 8, jobs: 70, reuses: ['Dryers'], needs: ['Belt dryer', 'Export documentation'] },
    { id: 'breakfast-cereal', process: 'Grain flaking', name: 'Millet breakfast cereal', nameHi: 'मिलेट नाश्ता सीरियल', marketCr: 1100, growthPct: 22, buyers: 10, overlap: 0.7, equipmentLakh: 80, certs: ['HACCP'], certLakh: 3, trainingLakh: 3, revenueLakh: 420, marginPct: 15, readyMonths: 9, jobs: 40, reuses: ['Flaking'], needs: ['Toaster and coating drum'] },
    { id: 'spice-export', process: 'Spice processing', name: 'Steam-sterilised spices for export', nameHi: 'निर्यात के लिए भाप-शुद्ध मसाले', marketCr: 4000, growthPct: 12, buyers: 30, overlap: 0.8, equipmentLakh: 70, certs: ['HACCP'], certLakh: 3, trainingLakh: 2, revenueLakh: 600, marginPct: 14, readyMonths: 6, jobs: 35, reuses: ['Grinding and blending'], needs: ['Steam steriliser', 'Lab tests'] },
    { id: 'compostable-pouches', process: 'Flexible packaging', name: 'Compostable and recyclable pouches', nameHi: 'कम्पोस्टेबल और रिसाइकिल योग्य पाउच', marketCr: 1800, growthPct: 24, buyers: 22, overlap: 0.7, equipmentLakh: 120, certs: ['FSSAI packaging compliance'], certLakh: 2, trainingLakh: 3, revenueLakh: 650, marginPct: 13, readyMonths: 9, jobs: 30, reuses: ['Lamination', 'Pouch making'], needs: ['Mono-material lamination', 'Compostability testing'] },
    { id: 'moulded-fibre-agri', process: 'Packaging', name: 'Moulded-fibre trays from crop residue', nameHi: 'फसल अवशेष से मोल्डेड-फाइबर ट्रे', marketCr: 1400, growthPct: 24, buyers: 15, overlap: 0.6, equipmentLakh: 55, certs: ['Compostability test'], certLakh: 4, trainingLakh: 3, revenueLakh: 380, marginPct: 16, readyMonths: 7, jobs: 60, reuses: ['Packaging design', 'Buyer relationships'], needs: ['Pulp moulding machine', 'Crop-residue collection'] },
  ],
};
