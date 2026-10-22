// All data in this file is simulated for the prototype.
// Place names are real; companies, capacities, prices and scores are fictional.
import type { BomLine, Buyer, District, NewSite, Seller } from './types';

export const buyer: Buyer = {
  name: 'Veer Electric Mobility',
  product: 'EV scooter wiring harness',
  plantDistrictId: 'hosur',
  monthlyUnits: 20000,
  unitCost: 4200,
  importLeadDays: 45,
  safetyStockDays: 21,
};

export const districts: District[] = [
  { id: 'hosur', name: 'Hosur', state: 'Tamil Nadu', lat: 12.74, lon: 77.83, climateRisk: 0.2, power: 0.9, connectivity: 0.85 },
  { id: 'krishnagiri', name: 'Krishnagiri', state: 'Tamil Nadu', lat: 12.52, lon: 78.21, climateRisk: 0.3, power: 0.8, connectivity: 0.7 },
  { id: 'chennai', name: 'Sriperumbudur', state: 'Tamil Nadu', lat: 12.97, lon: 79.95, climateRisk: 0.7, power: 0.92, connectivity: 0.95 },
  { id: 'coimbatore', name: 'Coimbatore', state: 'Tamil Nadu', lat: 11.02, lon: 76.96, climateRisk: 0.25, power: 0.88, connectivity: 0.8 },
  { id: 'madurai', name: 'Madurai', state: 'Tamil Nadu', lat: 9.93, lon: 78.12, climateRisk: 0.4, power: 0.8, connectivity: 0.72 },
  { id: 'dharwad', name: 'Dharwad', state: 'Karnataka', lat: 15.46, lon: 75.01, climateRisk: 0.3, power: 0.82, connectivity: 0.7 },
  { id: 'pune', name: 'Chakan, Pune', state: 'Maharashtra', lat: 18.76, lon: 73.86, climateRisk: 0.25, power: 0.93, connectivity: 0.9 },
  { id: 'satara', name: 'Satara', state: 'Maharashtra', lat: 17.68, lon: 74.0, climateRisk: 0.3, power: 0.82, connectivity: 0.72 },
  { id: 'silvassa', name: 'Silvassa', state: 'Dadra and Nagar Haveli', lat: 20.27, lon: 73.02, climateRisk: 0.35, power: 0.9, connectivity: 0.82 },
  { id: 'vapi', name: 'Vapi', state: 'Gujarat', lat: 20.37, lon: 72.9, climateRisk: 0.4, power: 0.9, connectivity: 0.85 },
  { id: 'rajkot', name: 'Rajkot', state: 'Gujarat', lat: 22.3, lon: 70.8, climateRisk: 0.35, power: 0.88, connectivity: 0.78 },
  { id: 'manesar', name: 'Manesar', state: 'Haryana', lat: 28.36, lon: 76.94, climateRisk: 0.35, power: 0.9, connectivity: 0.9 },
];

export const bom: BomLine[] = [
  { id: 'copper', name: 'Copper wire and cable', sharePct: 38, importedFrom: 'East Asia', process: 'Wire drawing', requiredCerts: ['ISO 9001', 'BIS IS 694'], weightKg: 1.5 },
  { id: 'connectors', name: 'Connectors and terminals', sharePct: 24, importedFrom: 'East Asia', process: 'Connector making', requiredCerts: ['ISO 9001', 'IATF 16949'], weightKg: 0.3 },
  { id: 'assembly', name: 'Harness assembly and testing', sharePct: 18, importedFrom: 'East Asia', process: 'Harness assembly', requiredCerts: ['IPC/WHMA-A-620 training', 'ESD-safe workspace'], weightKg: 1.0 },
  { id: 'sleeving', name: 'PVC sleeving and tape', sharePct: 8, importedFrom: 'East Asia', process: 'Polymer extrusion', requiredCerts: ['ISO 9001'], weightKg: 0.4 },
  { id: 'clips', name: 'Moulded clips and grommets', sharePct: 6, importedFrom: 'East Asia', process: 'Injection moulding', requiredCerts: ['ISO 9001'], weightKg: 0.2 },
  { id: 'packaging', name: 'Packaging', sharePct: 6, importedFrom: 'India', process: 'Packaging', requiredCerts: [], weightKg: 0.5 },
];

export const sellers: Seller[] = [
  // Copper wire
  { id: 's1', name: 'Silvassa Conductors', type: 'MSME', districtId: 'silvassa', process: 'Wire drawing', monthlyCapacity: 30000, certs: ['ISO 9001', 'BIS IS 694'], priceIndex: 0.97, quality: 0.86, verification: 'verified', workers: 140 },
  { id: 's2', name: 'Coimbatore Cable Works', type: 'MSME', districtId: 'coimbatore', process: 'Wire drawing', monthlyCapacity: 12000, certs: ['ISO 9001', 'BIS IS 694'], priceIndex: 1.0, quality: 0.84, verification: 'declared', workers: 70 },
  { id: 's3', name: 'Rajkot Copper Industries', type: 'MSME', districtId: 'rajkot', process: 'Wire drawing', monthlyCapacity: 25000, certs: ['ISO 9001'], priceIndex: 0.94, quality: 0.8, verification: 'verified', workers: 110 },
  // Connectors
  { id: 's4', name: 'Pune Precision Connectors', type: 'MSME', districtId: 'pune', process: 'Connector making', monthlyCapacity: 14000, certs: ['ISO 9001', 'IATF 16949'], priceIndex: 1.08, quality: 0.9, verification: 'verified', workers: 220 },
  { id: 's5', name: 'Manesar Terminal Tech', type: 'MSME', districtId: 'manesar', process: 'Connector making', monthlyCapacity: 25000, certs: ['ISO 9001'], priceIndex: 1.04, quality: 0.85, verification: 'verified', workers: 160 },
  { id: 's6', name: 'Hosur Tool and Die Cluster', type: 'MSME', districtId: 'hosur', process: 'Connector making', monthlyCapacity: 15000, certs: ['ISO 9001'], priceIndex: 0.98, quality: 0.8, verification: 'declared', workers: 90 },
  // Harness assembly
  { id: 's12', name: 'Chakan Harness Systems', type: 'MSME', districtId: 'pune', process: 'Harness assembly', monthlyCapacity: 25000, certs: ['IPC/WHMA-A-620 training', 'ESD-safe workspace'], priceIndex: 1.02, quality: 0.88, verification: 'verified', workers: 300 },
  { id: 's13', name: 'Krishnagiri Mahila Harness Collective', type: 'SHG federation', districtId: 'krishnagiri', process: 'Harness assembly', monthlyCapacity: 8000, certs: [], priceIndex: 0.85, quality: 0.74, verification: 'declared', workers: 180 },
  { id: 's14', name: 'Satara Gramin Assembly Co-op', type: 'Cooperative', districtId: 'satara', process: 'Harness assembly', monthlyCapacity: 12000, certs: ['ESD-safe workspace'], priceIndex: 0.88, quality: 0.78, verification: 'verified', workers: 210 },
  { id: 's15', name: 'Madurai SHG Kitting Network', type: 'SHG federation', districtId: 'madurai', process: 'Harness assembly', monthlyCapacity: 6000, certs: [], priceIndex: 0.84, quality: 0.72, verification: 'declared', workers: 120 },
  // Sleeving
  { id: 's7', name: 'Vapi Polymer Extrusions', type: 'MSME', districtId: 'vapi', process: 'Polymer extrusion', monthlyCapacity: 50000, certs: ['ISO 9001'], priceIndex: 0.92, quality: 0.84, verification: 'verified', workers: 85 },
  { id: 's8', name: 'Chennai Flexitubes', type: 'MSME', districtId: 'chennai', process: 'Polymer extrusion', monthlyCapacity: 30000, certs: ['ISO 9001'], priceIndex: 0.96, quality: 0.82, verification: 'verified', workers: 60 },
  // Clips
  { id: 's9', name: 'Sriperumbudur Moulders', type: 'MSME', districtId: 'chennai', process: 'Injection moulding', monthlyCapacity: 35000, certs: ['ISO 9001'], priceIndex: 0.95, quality: 0.83, verification: 'verified', workers: 75 },
  { id: 's10', name: 'Hosur Plastic Components', type: 'MSME', districtId: 'hosur', process: 'Injection moulding', monthlyCapacity: 25000, certs: ['ISO 9001'], priceIndex: 0.99, quality: 0.86, verification: 'verified', workers: 95 },
  { id: 's11', name: 'Dharwad Women’s Moulding Co-op', type: 'Cooperative', districtId: 'dharwad', process: 'Injection moulding', monthlyCapacity: 10000, certs: [], priceIndex: 0.9, quality: 0.75, verification: 'declared', workers: 65 },
  // Packaging
  { id: 's16', name: 'Hosur Corrugated Boxes', type: 'MSME', districtId: 'hosur', process: 'Packaging', monthlyCapacity: 60000, certs: ['ISO 9001'], priceIndex: 0.92, quality: 0.84, verification: 'verified', workers: 40 },
  { id: 's17', name: 'Krishnagiri FPO Agro-fibre Packs', type: 'FPO', districtId: 'krishnagiri', process: 'Packaging', monthlyCapacity: 15000, certs: [], priceIndex: 0.82, quality: 0.76, verification: 'declared', workers: 55 },
];

/** Facilities that do not exist yet and would have to be set up (greenfield). */
export const newSites: NewSite[] = [
  { id: 'n1', name: 'Hosur Copper Wire Unit', process: 'Wire drawing', districtId: 'hosur', capexCr: 26, priceIndex: 0.95, readyMonths: 18, quality: 0.85, rural: false, workers: 120 },
  { id: 'n2', name: 'Krishnagiri Extrusion Line (FPO joint venture)', process: 'Polymer extrusion', districtId: 'krishnagiri', capexCr: 3.5, priceIndex: 0.9, readyMonths: 9, quality: 0.82, rural: true, workers: 40 },
  { id: 'n3', name: 'Hosur Connector Tooling Centre', process: 'Connector making', districtId: 'hosur', capexCr: 21, priceIndex: 1.0, readyMonths: 20, quality: 0.86, rural: false, workers: 150 },
  { id: 'n4', name: 'Krishnagiri SHG Assembly Hub', process: 'Harness assembly', districtId: 'krishnagiri', capexCr: 3.2, priceIndex: 0.84, readyMonths: 8, quality: 0.78, rural: true, workers: 260 },
  { id: 'n5', name: 'Madurai Rural Kitting Hub', process: 'Harness assembly', districtId: 'madurai', capexCr: 2.4, priceIndex: 0.84, readyMonths: 8, quality: 0.76, rural: true, workers: 200 },
  { id: 'n6', name: 'Dharwad Co-op Moulding Line', process: 'Injection moulding', districtId: 'dharwad', capexCr: 1.8, priceIndex: 0.9, readyMonths: 6, quality: 0.78, rural: true, workers: 60 },
];

/** Cost and time to close a gap. Indicative figures for the prototype. */
export const certGaps: Record<string, { costLakh: number; months: number; labelHi: string; schemes: string[] }> = {
  'ISO 9001': { costLakh: 2, months: 3, labelHi: 'ISO 9001 प्रमाणन', schemes: ['MSME ZED certification support'] },
  'BIS IS 694': { costLakh: 3, months: 3, labelHi: 'BIS IS 694 लाइसेंस', schemes: ['MSME ZED certification support'] },
  'IATF 16949': { costLakh: 18, months: 9, labelHi: 'IATF 16949 प्रमाणन', schemes: ['MSME ZED certification support', 'CGTMSE credit guarantee'] },
  'IPC/WHMA-A-620 training': { costLakh: 4, months: 3, labelHi: 'IPC/WHMA-A-620 प्रशिक्षण', schemes: ['Skill India (NSDC)', 'DAY-NRLM skilling'] },
  'ESD-safe workspace': { costLakh: 6, months: 2, labelHi: 'ESD-सुरक्षित कार्यस्थल', schemes: ['CGTMSE credit guarantee', 'PMEGP'] },
};

/** Capex in lakh rupees per 1,000 extra units a month, and months to install. */
export const capacityCost: Record<string, { lakhPerThousand: number; months: number }> = {
  'Wire drawing': { lakhPerThousand: 12, months: 8 },
  'Connector making': { lakhPerThousand: 15, months: 8 },
  'Harness assembly': { lakhPerThousand: 3, months: 4 },
  'Polymer extrusion': { lakhPerThousand: 5, months: 5 },
  'Injection moulding': { lakhPerThousand: 6, months: 5 },
  Packaging: { lakhPerThousand: 2, months: 3 },
};

/** Aggregated, anonymised demand that sellers see. Never names a buyer. */
export const demandSignals: { process: string; buyers: number; monthlyUnits: number; region: string; from: string }[] = [
  { process: 'Harness assembly', buyers: 3, monthlyUnits: 46000, region: 'South India', from: '2027' },
  { process: 'Connector making', buyers: 4, monthlyUnits: 90000, region: 'All India', from: '2027' },
  { process: 'Wire drawing', buyers: 5, monthlyUnits: 120000, region: 'All India', from: '2027' },
  { process: 'Injection moulding', buyers: 6, monthlyUnits: 75000, region: 'South and West India', from: '2027' },
  { process: 'Polymer extrusion', buyers: 3, monthlyUnits: 60000, region: 'All India', from: '2028' },
  { process: 'Packaging', buyers: 7, monthlyUnits: 110000, region: 'Tamil Nadu and Karnataka', from: '2027' },
];
