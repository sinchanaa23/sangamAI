// The negotiation as a confluence: the supplier's price and the buyer's price are two rivers that move toward each other round by round,
// and meet in one stream when the deal is agreed. Drawn from the real offers; blocked offers show as hollow marks on the side that made them.
import { useRef } from 'react';
import type { NegotiationEvent } from '../../contracts';
import { gsap, MOTION_OK, NO_MOTION, useGSAP } from '../../gsapSetup';

const W = 320, H = 200, TOP = 30, BOTTOM = 36;
const X = (round: number) => 34 + (round - 1) * 62;
const MEET_X = 268;

interface Pt { x: number; v: number; blocked?: boolean }

/** A river segment that leaves horizontally and arrives horizontally, so the line flows like water. */
const flow = (pts: { x: number; y: number }[]) =>
  pts.map((p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const q = pts[i - 1]!, mid = (q.x + p.x) / 2;
    return `C ${mid} ${q.y}, ${mid} ${p.y}, ${p.x} ${p.y}`;
  }).join(' ');

export default function ConvergenceCard({ events, qty, budget, currency }: { events: NegotiationEvent[]; qty: number; budget: number; currency: string }) {
  const root = useRef<HTMLDivElement>(null);

  // price a unit, per side, in the order the offers arrived
  const perUnit = (amount: number) => amount / qty;
  const sup: Pt[] = [], buy: Pt[] = [{ x: X(1), v: perUnit(budget) }];
  let deal: { v: number } | null = null;
  for (const e of events) {
    if (!('offer' in e) || !e.offer) continue;
    const o = e.offer;
    if (o.status === 'accepted') { deal = { v: perUnit(o.price.amount) }; continue; }
    const p: Pt = { x: X(Math.min(o.round, 4)), v: perUnit(o.price.amount), blocked: o.status === 'rejected' };
    (e.from === 'supplier' ? sup : e.from === 'buyer' ? buy : []).push(p);
  }
  const all = [...sup, ...buy].map((p) => p.v).concat(deal ? [deal.v] : []);
  const lo = Math.min(...all), hi = Math.max(...all);
  const pad = Math.max((hi - lo) * 0.18, hi * 0.03);
  const Y = (v: number) => TOP + ((hi + pad - v) / (hi - lo + pad * 2 || 1)) * (H - TOP - BOTTOM);
  const live = (pts: Pt[]) => pts.filter((p) => !p.blocked).map((p) => ({ x: p.x, y: Y(p.v) }));

  const line = (pts: Pt[]) => {
    const l = live(pts);
    if (deal) l.push({ x: MEET_X, y: Y(deal.v) });
    return l.length > 1 ? flow(l) : '';
  };
  const supPath = line(sup), buyPath = line(buy);
  const dealY = deal ? Y(deal.v) : 0;
  const sig = `${sup.length}-${buy.length}-${deal ? 1 : 0}`;
  const money = (v: number) => (currency === 'INR' ? `₹${Math.round(v)}` : `${currency} ${v.toFixed(2)}`);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.fromTo('.cc-river', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.9, ease: 'power2.out', stagger: 0.12 });
      gsap.from('.cc-dot', { scale: 0, autoAlpha: 0, duration: 0.5, ease: 'back.out(2)', stagger: 0.05, delay: 0.25 });
      if (deal) {
        gsap.fromTo('.cc-tail', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.7, ease: 'power2.out', delay: 0.7, stagger: 0.08 });
        gsap.fromTo('.cc-ripple', { scale: 0.4, autoAlpha: 0.6, svgOrigin: `${MEET_X} ${dealY}` }, { scale: 3, autoAlpha: 0, duration: 2.2, ease: 'power1.out', stagger: 0.7, repeat: 2, delay: 0.9 });
      }
    });
    mm.add(NO_MOTION, () => undefined);
    return () => mm.revert();
  }, { scope: root, dependencies: [sig], revertOnUpdate: true });

  if (sup.length + buy.length < 2) return null;

  return (
    <div className="card cc" ref={root}>
      <div className="section-title">Two rivers, one stream</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Price a unit by round. Supplier and buyer prices move toward each other${deal ? ` and meet at ${money(deal.v)}` : ''}.`}>
        {[1, 2, 3, 4].map((r) => (
          <g key={r}>
            <line x1={X(r)} x2={X(r)} y1={TOP - 6} y2={H - BOTTOM + 6} className="cc-grid" />
            <text x={X(r)} y={H - 12} textAnchor="middle" className="cc-axis">R{r}</text>
          </g>
        ))}
        <text x={MEET_X} y={H - 12} textAnchor="middle" className="cc-axis">Deal</text>
        {supPath && <path className="cc-river" d={supPath} fill="none" stroke="#a4552c" strokeWidth="3" strokeLinecap="round" />}
        {buyPath && <path className="cc-river" d={buyPath} fill="none" stroke="#111111" strokeWidth="3" strokeLinecap="round" />}
        {deal && <>
          <path className="cc-tail" d={`M ${MEET_X} ${dealY - 2.5} L ${W - 6} ${dealY - 2.5}`} stroke="#a4552c" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path className="cc-tail" d={`M ${MEET_X} ${dealY + 2.5} L ${W - 6} ${dealY + 2.5}`} stroke="#111111" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          {[0, 1, 2].map((i) => <circle key={i} className="cc-ripple" cx={MEET_X} cy={dealY} r="8" fill="none" stroke="#111111" strokeWidth="1" opacity="0" />)}
          <circle className="cc-dot" cx={MEET_X} cy={dealY} r="5.5" fill="#fbfbfa" stroke="#111111" strokeWidth="2" />
          <text x={MEET_X} y={dealY - 12} textAnchor="middle" className="cc-value">{money(deal.v)}</text>
        </>}
        {sup.map((p, i) => <circle key={`s${i}`} className="cc-dot" cx={p.x} cy={Y(p.v)} r={p.blocked ? 4 : 3.6} fill={p.blocked ? '#fbfbfa' : '#a4552c'} stroke={p.blocked ? '#9f2f2d' : '#a4552c'} strokeWidth="1.6" />)}
        {buy.map((p, i) => <circle key={`b${i}`} className="cc-dot" cx={p.x} cy={Y(p.v)} r={p.blocked ? 4 : 3.6} fill={p.blocked ? '#fbfbfa' : '#111111'} stroke={p.blocked ? '#9f2f2d' : '#111111'} strokeWidth="1.6" />)}
        <text x={X(1)} y={TOP - 14} className="cc-axis">{money(hi)} a unit</text>
      </svg>
      <div className="cc-legend">
        <span><i style={{ background: '#a4552c' }} />Supplier</span>
        <span><i style={{ background: '#111111' }} />Buyer</span>
        <span><i className="blocked" />Blocked by the wage floor</span>
      </div>
    </div>
  );
}
