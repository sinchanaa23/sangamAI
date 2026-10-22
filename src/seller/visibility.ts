// What a supplier is allowed to see of a buyer's requirement (confidentiality rules).
import { active, buyer } from '../data';
import { district } from '../engine';
import type { Requirement, StoreState } from '../model';
import type { Seller } from '../types';
import { checksFor } from '../trust';

export function visibleTo(r: Requirement, s: Seller): boolean {
  if (r.process !== s.process) return false;
  return r.visibility !== 'invite' || r.invited.includes(s.id);
}

export function buyerLabel(r: Requirement, s: Seller, state: StoreState): string {
  const plant = district(buyer.plantDistrictId);
  const anon = `${active.template.name} company, ${plant.state}`;
  if (r.visibility === 'anonymous') return anon;
  if (state.sharing.nameToVerifiedOnly && checksFor(s, state).identity !== 'verified') return `${anon} (name shown once you are verified)`;
  return `${buyer.name}, ${plant.name}`;
}

export function volumeLabel(r: Requirement): string {
  if (r.exactVolume) return r.monthlyVolume.toLocaleString('en-IN');
  const lo = Math.floor((r.monthlyVolume * 0.7) / 10) * 10, hi = Math.ceil((r.monthlyVolume * 1.3) / 10) * 10;
  return `${lo.toLocaleString('en-IN')} to ${hi.toLocaleString('en-IN')}`;
}
