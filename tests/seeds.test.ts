// The supplier Development-projects tab must never be empty: every sector seeds
// two showcase projects and the hero seller gets flagship reviews.
import { describe, expect, it } from 'vitest';
import { seedSector } from '../src/seeds';
import { loadDataset } from '../src/data';
import { SECTOR_LIST } from '../src/sectors';

describe('seedSector demo data', () => {
  SECTOR_LIST.forEach((t) => {
    it(`seeds two development projects and hero reviews for ${t.name}`, () => {
      loadDataset(t.id, undefined, [], []);
      const seed = seedSector();
      expect(seed.projects).toHaveLength(2);
      expect(seed.projects.every((p) => p.sector === t.id && p.sellerId && p.milestones.length >= 3)).toBe(true);
      expect(seed.projects.some((p) => p.milestones.some((m) => m.status === 'submitted'))).toBe(true);
      expect(seed.reviews.filter((r) => r.status === 'verified').length).toBeGreaterThanOrEqual(2);
    });
  });
});
