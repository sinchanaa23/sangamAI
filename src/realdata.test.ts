import { describe, expect, it } from 'vitest';
import { fxRate, importDuty, industryStats, labourMarket, trade, unitValueUsdPerKg } from './realdata';

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

describe('factory statistics (Annual Survey of Industries)', () => {
  it('derives wage, output and women\'s share from real counts', () => {
    const s = industryStats('Tamil Nadu', '27')!;
    expect(s.scope).toBe('state');
    // 204,030 lakh of worker wages over 30,725 thousand mandays
    expect(s.wagePerWorkerDay).toBeCloseTo((204030 * 1e5) / (30725 * 1e3), 0);
    expect(s.wagePerWorkerDay).toBeGreaterThan(200);
    expect(s.wagePerWorkerDay).toBeLessThan(2000);
    expect(s.femaleShare).toBeCloseTo(11607 / 83980, 4);
    expect(s.wageShareOfGva).toBeGreaterThan(0);
    expect(s.wageShareOfGva).toBeLessThan(1);
    expect(s.source).toContain('Annual Survey of Industries');
  });

  it('matches the app\'s state spellings, including Dadra and Nagar Haveli', () => {
    expect(industryStats('Dadra and Nagar Haveli', '27')?.scope).toBe('state');
  });

  it('falls back to All India for a state without figures, and to nothing for an unknown industry', () => {
    expect(industryStats('Atlantis', '27')?.scope).toBe('all-india');
    expect(industryStats('Tamil Nadu', '99')).toBeNull();
  });
});

describe('labour market wages (Periodic Labour Force Survey)', () => {
  it('gives what casual and salaried workers earn in a state, with the pay gap for women', () => {
    const m = labourMarket('Tamil Nadu')!;
    expect(m.casualPerDay).toBeGreaterThan(200);
    expect(m.casualPerDay).toBeLessThan(1500);
    expect(m.casualPerDayFemale!).toBeLessThan(m.casualPerDay!);
    expect(m.salariedPerMonth).toBeGreaterThan(8000);
    expect(m.source).toContain('Periodic Labour Force Survey');
  });

  it('matches the app\'s state spellings and returns nothing for an unknown state', () => {
    expect(labourMarket('Dadra and Nagar Haveli')?.casualPerDay).toBeGreaterThan(0);
    expect(labourMarket('Atlantis')).toBeNull();
  });
});
