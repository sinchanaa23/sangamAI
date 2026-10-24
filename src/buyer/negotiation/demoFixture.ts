// The recorded demo negotiation (server/fixtures/demo-negotiation.json, owned by P1), bundled so the
// room still plays when the server is not running. Its figures are simulated, except the living-wage
// floor: GLWC Rural Nilgiris, ₹14,926 a month ÷ 26 days ≈ ₹574 a worker-day, the nearest rural
// benchmark for Krishnagiri, so tagged estimated.
import fixture from '../../../server/fixtures/demo-negotiation.json';
import type { NegotiationEvent, Rfq } from '../../contracts';

export const DEMO_RFQ = fixture.rfq as Rfq;
export const DEMO_EVENTS = fixture.events as NegotiationEvent[];
export const LIVING_WAGE_PER_DAY = 574;
