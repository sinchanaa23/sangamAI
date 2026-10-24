// What each section and page is for, shown on the section landing pages and in the hover lists.
// Keys are `${workspace}:${id}`. A section's landing page is the page id `@${groupId}`.
import type { Workspace } from '../ui';

export interface NavItem { id: string; label: string; count?: number }
export interface NavGroup { id: string; title: string; items: NavItem[] }

export const GROUP_BLURB: Record<string, string> = {
  'buyer:understand': 'See how exposed your supply chain is to imports and shocks.',
  'buyer:design': 'Find Indian alternatives and plan the supply chain you want.',
  'buyer:act': 'Ask for quotes, negotiate with suppliers and switch over.',
  'buyer:setup': 'Your company, your parts, and how Sangam connects to your systems.',
  'supplier:today': 'What buyers need from you right now.',
  'supplier:grow': 'Build capability and win more business.',
  'supplier:trust': 'Show buyers you are fair and reliable.',
  'ecosystem:deal': 'Where buyers and suppliers meet and rate each other.',
  'ecosystem:build': 'Plan a new business and find skill clusters.',
  'ecosystem:fair': 'Fair work, signed proof and impact.',
  'ecosystem:data': 'Where the numbers on every page come from.',
  'ecosystem:team': 'Tools for the Sangam team.',
};

export const ITEM_DESC: Record<string, string> = {
  'buyer:today': 'Which parts you import, from whom, with India’s real import figures for each.',
  'buyer:sim': 'Stress-test your import lane with live shipping news, disasters and currency moves, then try what-if sliders.',
  'buyer:routes': 'Step-by-step journeys for every part, abroad and in India, with days and cost.',
  'buyer:india': 'Ranked Indian supply chains for each part, with the gaps and scheme support.',
  'buyer:ranking': 'Every company that can make a part, ranked by one Sangam score you can re-weight.',
  'buyer:network': 'Design a future Indian network and compare its cost and returns with importing.',
  'buyer:location': 'Where in India to set up a new unit, scored by climate, connectivity and local suppliers.',
  'buyer:requirements': 'Publish what you need, compare quotes side by side, and start an agent negotiation.',
  'buyer:funding': 'Suppliers’ funding requests, listed for you to co-fund item by item. Pledges are simulated: no money moves.',
  'buyer:switch': 'A phased plan, with gates, for moving each part to an Indian supplier.',
  'buyer:devel': 'Help a supplier close certificate and capacity gaps, with milestones.',
  'buyer:setup': 'Edit your company, your parts and their costs.',
  'buyer:integrations': 'Import and export plain CSV files; no vendor lock-in.',
  'supplier:overview': 'Your company at a glance: demand, gaps and next steps.',
  'supplier:opps': 'Open buyer requirements you can quote on, and the quotes you have sent.',
  'supplier:consortia': 'Team up with other suppliers to bid for larger orders.',
  'supplier:projects': 'Development projects with buyers to close gaps: certificates, machines, training.',
  'supplier:funding': 'Apply for capital item by item (R&D, machines, certificates, working capital) and track each application to buyers’ commitments.',
  'supplier:grow': 'New products your skills and machines could make, with market size and set-up cost.',
  'supplier:workforce': 'Your workforce and wages, and the live Fair Work grade buyers see on every quote.',
  'supplier:sustainability': 'An environmental and ethical checklist, with cited sources.',
  'supplier:profile': 'Company profile, certificates and documents.',
  'ecosystem:negotiate': 'Watch buyer and supplier agents bargain under the living-wage floor.',
  'ecosystem:reviews': 'Buyers rate suppliers and suppliers rate buyers, checked against real orders.',
  'ecosystem:architect': 'Design a business and its whole supply chain from scratch.',
  'ecosystem:clusters': 'Government-listed craft and industry clusters, with their suppliers and grades.',
  'ecosystem:impact': 'Jobs, wage uplift, women’s share and imports replaced, each with its source.',
  'ecosystem:passport': 'Workers’ signed skill and contract credentials.',
  'ecosystem:check': 'Paste a credential and see whether it is genuine or has been changed.',
  'ecosystem:report': 'Workers can report a problem at work, anonymously.',
  'ecosystem:sources': 'Every dataset and live feed, with its source and date.',
  'ecosystem:verify': 'Auditor flags, worker reports, certificates and reviews waiting for a person.',
  'ecosystem:districts': 'Where India’s supply gaps are, district by district.',
};

export const WORKSPACE_LABEL: Record<Workspace, string> = { buyer: 'Buyer', supplier: 'Supplier', ecosystem: 'Ecosystem' };

/** A section's landing page id. */
export const hubId = (groupId: string) => `@${groupId}`;
export const isHub = (page: string) => page.startsWith('@');

/** The group a page belongs to; for a landing page, the group it is the landing page of. */
export function groupOf(groups: NavGroup[], page: string): NavGroup | undefined {
  return isHub(page) ? groups.find((g) => g.id === page.slice(1)) : groups.find((g) => g.items.some((i) => i.id === page));
}
