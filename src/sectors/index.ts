import { agri } from './agri';
import { construction } from './construction';
import { ev } from './ev';
import type { SectorTemplate } from './types';
import type { SectorId } from '../types';

export const SECTORS: Record<SectorId, SectorTemplate> = { ev, construction, agri };
export const SECTOR_LIST: SectorTemplate[] = [ev, construction, agri];
export type { SectorTemplate, OpportunitySeed } from './types';
