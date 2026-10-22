// Districts Sangam knows about. Coordinates are real (approximate town centres).
// The app reads the same list from src/geo/districts.json.
import { readFileSync } from 'node:fs';
export const DISTRICTS = JSON.parse(readFileSync(new URL('../src/geo/districts.json', import.meta.url), 'utf8'));

// HS codes (HS 2022) tracked per sector.
export const HS_CODES = [
  // EV wiring harness
  ['854430', 'Wiring sets for vehicles'],
  ['854442', 'Insulated conductors fitted with connectors, up to 1,000 V'],
  ['853690', 'Connectors and other electrical apparatus, up to 1,000 V'],
  ['740811', 'Refined copper wire, over 6 mm'],
  ['740311', 'Refined copper cathodes'],
  ['390410', 'PVC, not mixed'],
  ['390810', 'Polyamides (nylon 6, 6-6 and others)'],
  ['392690', 'Other plastic articles (clips, grommets)'],
  ['481910', 'Corrugated paper cartons and boxes'],
  // Construction materials
  ['721420', 'Steel reinforcing bars (rebar)'],
  ['252329', 'Portland cement'],
  ['690721', 'Ceramic tiles, low water absorption'],
  ['441873', 'Bamboo assembled panels and flooring'],
  ['761010', 'Aluminium doors and windows'],
  ['848180', 'Taps, cocks and valves'],
  // Agri and food processing
  ['071290', 'Dried vegetables'],
  ['100829', 'Millet'],
  ['190410', 'Cereal flakes and puffed products'],
  ['392321', 'Polyethylene sacks and bags'],
  ['841931', 'Dryers for agricultural products'],
];

export const LPI_COUNTRIES = ['CHN', 'VNM', 'THA', 'KOR', 'JPN', 'ARE', 'NLD', 'IND'];
