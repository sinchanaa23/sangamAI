import { describe, expect, it } from 'vitest';
import { fxRate, importDuty, trade, unitValueUsdPerKg } from './realdata';

describe('real public data accessors', () => {
  it('reads India\'s MFN duty for a tracked product', () => {
    expect(importDuty('854430')).toMatchObject({ rate: 0.15 });
    expect(importDuty('854430')?.source).toContain('WITS');
    expect(importDuty('000000')).toBeNull();
    expect(importDuty(undefined)).toBeNull();
  });

  it('derives what India paid per kg from Comtrade value and weight', () => {
    const v = unitValueUsdPerKg('854430')!;
    expect(v.usdPerKg).toBeGreaterThan(5);
    expect(v.usdPerKg).toBeLessThan(100);
    expect(v.year).toBeGreaterThanOrEqual(2022);
    const t = trade('854430')!;
    expect(v.usdPerKg).toBeCloseTo(t.totalUsd / t.netKg!, 1);
    expect(unitValueUsdPerKg('854430', 'ZZZ')).toBeNull();
    expect(unitValueUsdPerKg('000000')).toBeNull();
  });

  it('gives a dated exchange rate for each currency', () => {
    expect(fxRate('INR').inrPer).toBe(1);
    expect(fxRate('USD').inrPer).toBeGreaterThan(60);
    expect(fxRate('USD').inrPer).toBeLessThan(130);
    expect(fxRate('EUR').inrPer).toBeGreaterThan(fxRate('USD').inrPer);
    expect(fxRate('USD').date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
