// The supplier Development-projects tab must never be empty: every sector seeds
// two showcase projects and the hero seller gets flagship reviews.
import { describe, expect, it } from 'vitest';
import { seedSector, seedSustainabilityFor } from '../src/seeds';
import { scoreSustainability } from '../src/sustainability';
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

describe('seedSustainability demo data', () => {
  SECTOR_LIST.forEach((t) => {
    it(`seeds sustainability answers for every seller in ${t.name}`, () => {
      for (const s of t.sellers) {
        const seed = seedSustainabilityFor(s.name);
        expect(seed, `seller "${s.name}" (${s.id}) in ${t.name} is missing sustainability seed`).not.toBeNull();
        const res = scoreSustainability(seed!, t.id);
        expect(res.score).toBeGreaterThan(0);
        expect(['Bronze', 'Silver', 'Gold', 'Platinum']).toContain(res.level);
        expect(res.level).not.toBe('Not assessed');
      }
    });
  });
});
