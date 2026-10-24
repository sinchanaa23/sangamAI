// The recorded demo negotiation (server/fixtures/demo-negotiation.json, owned by P1), bundled so the
// room still plays when the server is not running. Its figures are simulated.
import fixture from '../../../server/fixtures/demo-negotiation.json';
import type { NegotiationEvent, Rfq } from '../../contracts';

export const DEMO_RFQ = fixture.rfq as Rfq;
export const DEMO_EVENTS = fixture.events as NegotiationEvent[];
