// Manual check: runs one live negotiation against the model in .env.local and prints the events. Usage: npm run try:live
// Set SANGAM_DEBUG=1 to see why any agent turn fell back to the rule-based move.
import { createApp } from './app';
import { openDb } from './db';
process.loadEnvFile('.env.local');
const app = createApp(openDb(':memory:'));
const t0 = Date.now();
const rfq = { buyerId: 'veer', buyerCountry: 'IN', part: 'EV scooter wiring harness (assembly and test)', quantity: 8000, needBy: '2027-06-01', budget: { amount: 5_400_000, currency: 'INR' } };
const n = await (await app.request('/api/negotiations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rfq, supplierIds: [] }) })).json() as { id: string; mode: string };
console.log('mode', n.mode);
const text = await (await app.request(`/api/negotiations/${n.id}/stream`)).text();
for (const l of text.split('\n').filter((x) => x.startsWith('data:'))) {
  const e = JSON.parse(l.slice(5));
  const o = e.offer ? ` | ₹${Math.round(e.offer.price.amount / 8000)}/unit wage ${e.offer.labour.wagePerWorkerDay} r${e.offer.round} ${e.offer.status}${e.offer.reason ? ' (' + e.offer.reason.slice(0, 70) + ')' : ''}` : '';
  const d = e.decision ? ` ${e.decision} grade ${e.score?.grade}` : '';
  console.log(`${e.type}/${e.from ?? ''}${d}${o} :: ${(e.text ?? e.outcome ?? '').slice(0, 150)}`);
}
console.log(`took ${Math.round((Date.now() - t0) / 1000)}s`);
process.exit(0);
