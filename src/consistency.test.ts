import { describe, expect, it } from 'vitest';
import { DEFAULT_RATES } from './buyer/global/settings';
import { ROAD_FACTOR, ROAD_RS_PER_TONNE_KM } from './freight';
import { fxRate } from './realdata';
import { USD_INR } from './routes';
import { FX_INR } from '../server/agents/tools';

describe('one exchange-rate table and one road-freight rate', () => {
  it('every screen and the agents use the ECB rates in fx.json', () => {
    expect(USD_INR).toBe(fxRate('USD').inrPer);
    expect(DEFAULT_RATES).toEqual({ INR: 1, USD: fxRate('USD').inrPer, EUR: fxRate('EUR').inrPer });
    expect(FX_INR).toEqual(DEFAULT_RATES);
  });

  it('road freight is defined once, as an estimate', () => {
    expect(ROAD_RS_PER_TONNE_KM).toBe(3);
    expect(ROAD_FACTOR).toBe(1.3);
  });
});
