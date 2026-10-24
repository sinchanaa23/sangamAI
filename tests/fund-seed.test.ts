import { describe, expect, it } from 'vitest';
import { seedSector } from '../src/seeds';
import { loadDataset } from '../src/data';

describe('seedSector funding', () => {
  it('seeds three applications with listed/submitted statuses', () => {
    loadDataset('ev', undefined, [], []);
    const seed = seedSector();
    expect(seed.funding).toHaveLength(3);
    expect(seed.funding.filter((f) => f.status === 'listed')).toHaveLength(2);
    expect(seed.funding.every((f) => f.projections.source === 'estimated')).toBe(true);
    expect(seed.funding[0].commitments).toHaveLength(1);
  });
});
