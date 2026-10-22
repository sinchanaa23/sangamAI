// Affordable housing materials. Companies, capacities, prices and scores are simulated; places and HS codes are real.
// Capacities are in "homes' worth of material per month".
import type { SectorTemplate } from './types';

export const construction: SectorTemplate = {
  id: 'construction',
  name: 'Construction materials',
  blurb: 'An affordable-housing developer localising imported finishing materials',
  buyer: {
    name: 'Sahyadri Homes', product: 'Affordable home (450 sq ft)', unitLabel: 'home',
    plantDistrictId: 'pune', monthlyUnits: 50, importLeadDays: 50, safetyStockDays: 30,
    unitsPerContainer: 12, lostContribution: 60000,
  },
  bom: [
    {
      id: 'steel', name: 'Rebar and structural steel', cost: 240000, hs: '721420', spec: 'Fe 500D TMT bars, 8-25 mm, about 3.5 t per home',
      importedFrom: 'India', process: 'Steel rolling', requiredCerts: ['BIS IS 1786'], weightKg: 3500,
      tiers: [
        { name: 'Iron ore and pellets', stage: 'raw material', indianSupply: 'strong', indianRegions: 'Odisha, Jharkhand, Chhattisgarh, Karnataka', note: 'India is a major iron ore producer' },
        { name: 'Billets', stage: 'intermediate', indianSupply: 'strong', indianRegions: 'Maharashtra, Chhattisgarh, Odisha', note: '' },
      ],
    },
    {
      id: 'cement', name: 'Cement', cost: 160000, hs: '252329', spec: 'OPC 53 / PPC, about 9 t per home',
      importedFrom: 'India', process: 'Cement grinding', requiredCerts: ['BIS IS 269'], weightKg: 9000,
      tiers: [
        { name: 'Clinker', stage: 'intermediate', indianSupply: 'strong', indianRegions: 'Andhra Pradesh, Rajasthan, Madhya Pradesh', note: '' },
        { name: 'Fly ash and slag', stage: 'raw material', indianSupply: 'strong', indianRegions: 'Near thermal plants and steel mills', note: 'By-products, widely available' },
      ],
    },
    {
      id: 'blocks', name: 'Walling blocks', cost: 90000, hs: '690410', spec: 'Fly-ash bricks or AAC blocks, about 12 t per home',
      importedFrom: 'India', process: 'Block making', requiredCerts: ['BIS IS 12894'], weightKg: 12000,
      tiers: [{ name: 'Fly ash, lime, gypsum', stage: 'raw material', indianSupply: 'strong', indianRegions: 'Near thermal power plants', note: '' }],
    },
    {
      id: 'panels', name: 'Doors and partition panels', cost: 50000, hs: '441873', spec: 'Bamboo mat board doors and partitions',
      importedFrom: 'China', process: 'Bamboo processing', requiredCerts: ['BIS IS 13958'], weightKg: 300,
      tiers: [
        { name: 'Bamboo culms', stage: 'raw material', indianSupply: 'strong', indianRegions: 'Assam, Tripura, Mizoram, Karnataka, Maharashtra', note: 'India has large bamboo stocks; processing is the gap' },
        { name: 'Resins and adhesives', stage: 'intermediate', indianSupply: 'partial', indianRegions: 'Gujarat', note: '' },
      ],
    },
    {
      id: 'windows', name: 'Aluminium windows', cost: 60000, hs: '761010', spec: 'Sliding windows, powder-coated sections, 6 per home',
      importedFrom: 'China', process: 'Aluminium fabrication', requiredCerts: ['ISO 9001'], weightKg: 250,
      tiers: [
        { name: 'Aluminium extrusions', stage: 'intermediate', indianSupply: 'partial', indianRegions: 'Gujarat, Maharashtra, Odisha', note: 'Primary aluminium is strong; architectural extrusion capacity is mixed' },
        { name: 'Glass', stage: 'intermediate', indianSupply: 'strong', indianRegions: 'Gujarat, Rajasthan, Tamil Nadu', note: '' },
      ],
    },
    {
      id: 'tiles', name: 'Floor and wall tiles', cost: 45000, hs: '690721', spec: 'Vitrified tiles 600x600, about 1.2 t per home',
      importedFrom: 'China', process: 'Tile pressing', requiredCerts: ['BIS IS 15622'], weightKg: 1200,
      tiers: [{ name: 'Clay, feldspar, glazes', stage: 'raw material', indianSupply: 'strong', indianRegions: 'Gujarat (Morbi), Rajasthan', note: 'Morbi is one of the world’s largest tile clusters' }],
    },
    {
      id: 'fittings', name: 'Sanitary and plumbing fittings', cost: 35000, hs: '848180', spec: 'CP brass taps, valves and fittings set',
      importedFrom: 'China', process: 'Fittings machining', requiredCerts: ['BIS IS 8931'], weightKg: 80,
      tiers: [{ name: 'Brass rods and ingots', stage: 'intermediate', indianSupply: 'strong', indianRegions: 'Gujarat (Jamnagar)', note: '' }],
    },
  ],
  sellers: [
    { id: 'c1', name: 'Sambhajinagar Rebar Mills', type: 'MSME', districtId: 'aurangabad', process: 'Steel rolling', monthlyCapacity: 120, certs: ['BIS IS 1786', 'ISO 9001'], priceIndex: 0.98, quality: 0.88, verification: 'verified', workers: 320, machines: ['Re-rolling mill', 'Quenching line'], about: 'TMT bar maker serving Marathwada builders.' },
    { id: 'c2', name: 'Nagpur Steel Re-rollers', type: 'MSME', districtId: 'nagpur', process: 'Steel rolling', monthlyCapacity: 60, certs: ['BIS IS 1786'], priceIndex: 0.96, quality: 0.84, verification: 'declared', workers: 180, machines: ['Re-rolling mill'], about: 'Re-roller in the Vidarbha belt.' },
    { id: 'c3', name: 'Satara Cement Grinding Unit', type: 'MSME', districtId: 'satara', process: 'Cement grinding', monthlyCapacity: 80, certs: ['BIS IS 269'], priceIndex: 0.97, quality: 0.86, verification: 'verified', workers: 110, machines: ['Ball mill', 'Packing plant'], about: 'Split grinding unit using bought-in clinker.' },
    { id: 'c4', name: 'Nashik Slag Cement Co', type: 'MSME', districtId: 'nashik', process: 'Cement grinding', monthlyCapacity: 40, certs: [], priceIndex: 0.93, quality: 0.8, verification: 'declared', workers: 70, machines: ['Ball mill'], about: 'Slag cement grinder.' },
    { id: 'c5', name: 'Pune Fly-ash Brick SHG Federation', type: 'SHG federation', districtId: 'pune', process: 'Block making', monthlyCapacity: 30, certs: [], priceIndex: 0.85, quality: 0.76, verification: 'declared', workers: 140, machines: ['Hydraulic brick presses'], about: 'Women SHGs making fly-ash bricks.' },
    { id: 'c6', name: 'Satara Gramin AAC Cooperative', type: 'Cooperative', districtId: 'satara', process: 'Block making', monthlyCapacity: 35, certs: ['BIS IS 12894'], priceIndex: 0.9, quality: 0.82, verification: 'verified', workers: 120, machines: ['Brick presses', 'Curing yard'], about: 'Village cooperative supplying district housing schemes.' },
    { id: 'c7', name: 'Nashik Blocks', type: 'MSME', districtId: 'nashik', process: 'Block making', monthlyCapacity: 70, certs: ['BIS IS 12894'], priceIndex: 0.95, quality: 0.86, verification: 'verified', workers: 90, machines: ['AAC autoclaves'], about: 'AAC block plant.' },
    { id: 'c8', name: 'Agartala Bamboo Producer Company', type: 'FPO', districtId: 'agartala', process: 'Bamboo processing', monthlyCapacity: 25, certs: [], priceIndex: 0.82, quality: 0.78, verification: 'declared', workers: 260, machines: ['Mat weaving', 'Hot press (small)'], about: 'Bamboo farmer producer company in Tripura.' },
    { id: 'c9', name: 'Guwahati Bamboo Board Works', type: 'MSME', districtId: 'guwahati', process: 'Bamboo processing', monthlyCapacity: 40, certs: ['BIS IS 13958'], priceIndex: 0.95, quality: 0.86, verification: 'verified', workers: 150, machines: ['Mat board hot press', 'Door shaping line'], about: 'Bamboo mat board and door maker.' },
    { id: 'c10', name: 'Dharwad Bamboo Cooperative', type: 'Cooperative', districtId: 'dharwad', process: 'Bamboo processing', monthlyCapacity: 15, certs: [], priceIndex: 0.85, quality: 0.78, verification: 'declared', workers: 90, machines: ['Mat weaving'], about: 'Medar community bamboo cooperative.' },
    { id: 'c11', name: 'Pune Aluminium Systems', type: 'MSME', districtId: 'pune', process: 'Aluminium fabrication', monthlyCapacity: 60, certs: ['ISO 9001'], priceIndex: 1.05, quality: 0.88, verification: 'verified', workers: 80, machines: ['CNC cutting', 'Crimping', 'Glazing line'], about: 'Window and facade fabricator.' },
    { id: 'c12', name: 'Rajkot Extrusion Fabricators', type: 'MSME', districtId: 'rajkot', process: 'Aluminium fabrication', monthlyCapacity: 40, certs: [], priceIndex: 0.97, quality: 0.82, verification: 'declared', workers: 60, machines: ['Cutting', 'Powder coating'], about: 'Window fabricator with its own coating line.' },
    { id: 'c13', name: 'Rajkot Ceramic Works', type: 'MSME', districtId: 'rajkot', process: 'Tile pressing', monthlyCapacity: 200, certs: ['BIS IS 15622'], priceIndex: 0.92, quality: 0.87, verification: 'verified', workers: 240, machines: ['Hydraulic presses', 'Roller kiln', 'Digital glazing'], about: 'Vitrified tile maker in the Saurashtra cluster.' },
    { id: 'c14', name: 'Sanand Tile Co', type: 'MSME', districtId: 'sanand', process: 'Tile pressing', monthlyCapacity: 60, certs: [], priceIndex: 0.95, quality: 0.82, verification: 'declared', workers: 110, machines: ['Press', 'Kiln'], about: 'Wall tile maker.' },
    { id: 'c15', name: 'Rajkot Brass Fittings Cluster', type: 'MSME', districtId: 'rajkot', process: 'Fittings machining', monthlyCapacity: 80, certs: ['BIS IS 8931'], priceIndex: 0.95, quality: 0.85, verification: 'verified', workers: 130, machines: ['CNC turning', 'Chrome plating'], about: 'Brass fittings consortium.' },
    { id: 'c16', name: 'Ludhiana Sanitary Works', type: 'MSME', districtId: 'ludhiana', process: 'Fittings machining', monthlyCapacity: 50, certs: [], priceIndex: 0.97, quality: 0.8, verification: 'declared', workers: 75, machines: ['Turning', 'Polishing'], about: 'Tap and valve maker.' },
    { id: 'c17', name: 'Howrah Foundry Co-op', type: 'Cooperative', districtId: 'howrah', process: 'Fittings machining', monthlyCapacity: 20, certs: [], priceIndex: 0.9, quality: 0.76, verification: 'declared', workers: 85, machines: ['Sand casting', 'Lathes'], about: 'Foundry workers’ cooperative.' },
  ],
  newSites: [
    { id: 'cn1', name: 'Satara Bamboo Panel Hub (FPO joint venture)', process: 'Bamboo processing', districtId: 'satara', capexCr: 2.8, priceIndex: 0.86, readyMonths: 10, quality: 0.8, rural: true, workers: 120 },
    { id: 'cn2', name: 'Pune Window Fabrication Line', process: 'Aluminium fabrication', districtId: 'pune', capexCr: 4.5, priceIndex: 0.98, readyMonths: 8, quality: 0.85, rural: false, workers: 60 },
    { id: 'cn3', name: 'Nashik Fittings Machining Centre', process: 'Fittings machining', districtId: 'nashik', capexCr: 6, priceIndex: 0.96, readyMonths: 12, quality: 0.84, rural: false, workers: 90 },
  ],
  processes: [
    { name: 'Steel rolling', nameHi: 'स्टील रोलिंग', lakhPerThousand: 2000, months: 10, refCapacity: 100 },
    { name: 'Cement grinding', nameHi: 'सीमेंट पिसाई', lakhPerThousand: 2700, months: 12, refCapacity: 80 },
    { name: 'Block making', nameHi: 'ब्लॉक निर्माण', lakhPerThousand: 600, months: 4, refCapacity: 50 },
    { name: 'Bamboo processing', nameHi: 'बांस प्रसंस्करण', lakhPerThousand: 1500, months: 6, refCapacity: 30 },
    { name: 'Aluminium fabrication', nameHi: 'एल्यूमिनियम फैब्रिकेशन', lakhPerThousand: 1200, months: 5, refCapacity: 50 },
    { name: 'Tile pressing', nameHi: 'टाइल प्रेसिंग', lakhPerThousand: 800, months: 9, refCapacity: 150 },
    { name: 'Fittings machining', nameHi: 'फिटिंग्स मशीनिंग', lakhPerThousand: 900, months: 6, refCapacity: 60 },
  ],
  certs: {
    'BIS IS 1786': { costLakh: 8, months: 6, labelHi: 'BIS IS 1786 लाइसेंस', schemes: ['MSME ZED certification support'] },
    'BIS IS 269': { costLakh: 6, months: 6, labelHi: 'BIS IS 269 लाइसेंस', schemes: ['MSME ZED certification support'] },
    'BIS IS 12894': { costLakh: 2, months: 3, labelHi: 'BIS IS 12894 लाइसेंस', schemes: ['MSME ZED certification support', 'PMEGP'] },
    'BIS IS 13958': { costLakh: 2, months: 4, labelHi: 'BIS IS 13958 लाइसेंस', schemes: ['National Bamboo Mission', 'MSME ZED certification support'] },
    'BIS IS 15622': { costLakh: 3, months: 4, labelHi: 'BIS IS 15622 लाइसेंस', schemes: ['MSME ZED certification support'] },
    'BIS IS 8931': { costLakh: 3, months: 4, labelHi: 'BIS IS 8931 लाइसेंस', schemes: ['MSME ZED certification support'] },
  },
  demandSignals: [
    { process: 'Bamboo processing', buyers: 6, monthlyUnits: 400, region: 'West and South India', from: '2027' },
    { process: 'Aluminium fabrication', buyers: 9, monthlyUnits: 700, region: 'All India', from: '2027' },
    { process: 'Fittings machining', buyers: 8, monthlyUnits: 900, region: 'All India', from: '2027' },
    { process: 'Tile pressing', buyers: 11, monthlyUnits: 1500, region: 'All India', from: '2027' },
    { process: 'Block making', buyers: 14, monthlyUnits: 1200, region: 'Maharashtra', from: '2027' },
    { process: 'Steel rolling', buyers: 12, monthlyUnits: 1800, region: 'West India', from: '2027' },
    { process: 'Cement grinding', buyers: 10, monthlyUnits: 1600, region: 'West India', from: '2027' },
  ],
  opportunities: [
    { id: 'bamboo-flooring', process: 'Bamboo processing', name: 'Bamboo flooring and decking', nameHi: 'बांस फ़्लोरिंग और डेकिंग', marketCr: 900, growthPct: 18, buyers: 12, overlap: 0.75, equipmentLakh: 60, certs: ['BIS IS 13958'], certLakh: 2, trainingLakh: 4, revenueLakh: 400, marginPct: 15, readyMonths: 8, jobs: 70, reuses: ['Bamboo sourcing', 'Weaving and pressing'], needs: ['Strand-woven press', 'Kiln drying'] },
    { id: 'bamboo-furniture', process: 'Bamboo processing', name: 'Bamboo furniture for schools and offices', nameHi: 'स्कूलों और दफ्तरों के लिए बांस का फर्नीचर', marketCr: 1200, growthPct: 12, buyers: 20, overlap: 0.7, equipmentLakh: 35, certs: [], certLakh: 0, trainingLakh: 5, revenueLakh: 300, marginPct: 14, readyMonths: 5, jobs: 80, reuses: ['Bamboo treatment', 'Craft skills'], needs: ['Joinery tools', 'Design support'] },
    { id: 'upvc-windows', process: 'Aluminium fabrication', name: 'uPVC windows and doors', nameHi: 'यूपीवीसी खिड़कियां और दरवाज़े', marketCr: 4500, growthPct: 15, buyers: 25, overlap: 0.7, equipmentLakh: 55, certs: ['ISO 9001'], certLakh: 2, trainingLakh: 3, revenueLakh: 500, marginPct: 12, readyMonths: 5, jobs: 35, reuses: ['Fabrication skills', 'Glazing'], needs: ['uPVC welding machine', 'Profile supplier tie-up'] },
    { id: 'solar-structures', process: 'Aluminium fabrication', name: 'Solar module mounting structures', nameHi: 'सोलर मॉड्यूल माउंटिंग स्ट्रक्चर', marketCr: 3000, growthPct: 25, buyers: 15, overlap: 0.65, equipmentLakh: 90, certs: ['ISO 9001'], certLakh: 2, trainingLakh: 3, revenueLakh: 800, marginPct: 11, readyMonths: 7, jobs: 40, reuses: ['Cutting and drilling', 'Coating'], needs: ['Roll-forming line', 'Galvanising partner'] },
    { id: 'pressure-fittings', process: 'Fittings machining', name: 'Gas and water pressure fittings', nameHi: 'गैस और पानी के प्रेशर फिटिंग', marketCr: 2200, growthPct: 14, buyers: 18, overlap: 0.8, equipmentLakh: 70, certs: ['BIS IS 8931'], certLakh: 3, trainingLakh: 2, revenueLakh: 450, marginPct: 13, readyMonths: 6, jobs: 30, reuses: ['CNC turning', 'Plating'], needs: ['Pressure test benches'] },
    { id: 'jal-jeevan-fittings', process: 'Fittings machining', name: 'Rural water-tap connections', nameHi: 'ग्रामीण नल कनेक्शन फिटिंग', marketCr: 1500, growthPct: 10, buyers: 30, overlap: 0.85, equipmentLakh: 30, certs: ['BIS IS 8931'], certLakh: 3, trainingLakh: 2, revenueLakh: 280, marginPct: 10, readyMonths: 4, jobs: 25, reuses: ['Turning', 'Assembly'], needs: ['Moulds for plastic parts'] },
    { id: 'large-slabs', process: 'Tile pressing', name: 'Large-format slabs for export', nameHi: 'निर्यात के लिए बड़े स्लैब', marketCr: 6000, growthPct: 16, buyers: 40, overlap: 0.75, equipmentLakh: 400, certs: ['ISO 9001'], certLakh: 2, trainingLakh: 4, revenueLakh: 2500, marginPct: 12, readyMonths: 14, jobs: 60, reuses: ['Kiln', 'Glazing'], needs: ['Slab press', 'Export packaging'] },
    { id: 'aac-panels', process: 'Block making', name: 'Precast wall panels', nameHi: 'प्रीकास्ट दीवार पैनल', marketCr: 2500, growthPct: 20, buyers: 16, overlap: 0.6, equipmentLakh: 150, certs: ['BIS IS 12894'], certLakh: 2, trainingLakh: 4, revenueLakh: 700, marginPct: 13, readyMonths: 10, jobs: 50, reuses: ['Raw material sourcing', 'Curing yard'], needs: ['Moulds and vibrating tables', 'Crane'] },
    { id: 'paver-blocks', process: 'Block making', name: 'Paver blocks for roads and yards', nameHi: 'सड़कों के लिए पेवर ब्लॉक', marketCr: 1800, growthPct: 11, buyers: 35, overlap: 0.85, equipmentLakh: 25, certs: ['BIS IS 15658'], certLakh: 2, trainingLakh: 1, revenueLakh: 220, marginPct: 12, readyMonths: 3, jobs: 30, reuses: ['Presses', 'Curing'], needs: ['Paver moulds'] },
    { id: 'steel-fab', process: 'Steel rolling', name: 'Pre-engineered building sections', nameHi: 'प्री-इंजीनियर्ड बिल्डिंग सेक्शन', marketCr: 8000, growthPct: 14, buyers: 30, overlap: 0.5, equipmentLakh: 500, certs: ['ISO 9001'], certLakh: 2, trainingLakh: 5, revenueLakh: 3000, marginPct: 9, readyMonths: 14, jobs: 80, reuses: ['Steel sourcing'], needs: ['Fabrication bay', 'Welding robots'] },
    { id: 'ready-mix', process: 'Cement grinding', name: 'Ready-mix concrete', nameHi: 'रेडी-मिक्स कंक्रीट', marketCr: 9000, growthPct: 12, buyers: 50, overlap: 0.5, equipmentLakh: 350, certs: ['ISO 9001'], certLakh: 2, trainingLakh: 3, revenueLakh: 2000, marginPct: 8, readyMonths: 8, jobs: 40, reuses: ['Cement supply'], needs: ['Batching plant', 'Transit mixers'] },
  ],
};
