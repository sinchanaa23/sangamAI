import Src from '../../components/Src';
import { COUNTRIES, countryOf, DEFAULT_RATES, laneFor, RATES_AS_OF, setGlobalBuyer, useGlobalBuyer } from './settings';
import type { Currency } from './settings';

const CURRENCIES: Currency[] = ['INR', 'USD', 'EUR'];

/** Where the buyer is and which currency they see prices in. */
export default function GlobalBuyerPanel() {
  const g = useGlobalBuyer();
  const country = countryOf(g.country);
  const lane = laneFor(g.country);
  const pickCountry = (code: string) => setGlobalBuyer({ country: code, currency: countryOf(code).currency });

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <label className="field" style={{ minWidth: 200 }}>Your company is in
            <select value={g.country} onChange={(e) => pickCountry(e.target.value)}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
          </label>
          <div className="field">Show prices in
            <div className="segmented">{CURRENCIES.map((c) => <button key={c} className={g.currency === c ? 'on' : ''} onClick={() => setGlobalBuyer({ currency: c })}>{c}</button>)}</div>
          </div>
          {lane && (
            <label className="field" style={{ width: 150 }}>Your import duty (%)
              <input type="number" min={0} max={100} step={0.1} value={g.dutyPct} onChange={(e) => setGlobalBuyer({ dutyPct: Math.max(0, Number(e.target.value)) })} />
            </label>
          )}
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        {lane
          ? <>Quotes below also show the landed cost at {lane.port}, shipped from Chennai on the {lane.country} sea lane. {country.onward ? `${country.onward}.` : ''} Enter your own duty rate for this part; it is 0% until you do.</>
          : <>Indian buyers see quotes with domestic freight to your plant. Pick another country to see export routes, landed cost and a due-diligence pack.</>}
      </p>
      {g.currency !== 'INR' && (
        <details style={{ marginTop: 10 }}>
          <summary>Exchange rates used ({RATES_AS_OF}) <Src kind="estimated" title="A fixed table, not a live feed. Replace with the RBI reference rate for your date." /></summary>
          <div className="row small" style={{ gap: 16, flexWrap: 'wrap' }}>
            {CURRENCIES.filter((c) => c !== 'INR').map((c) => (
              <label key={c} className="row" style={{ gap: 6 }}>1 {c} = ₹
                <input className="cell num" style={{ width: 80, border: '1px solid var(--line)' }} type="number" min={1} step={0.01} value={g.rates[c]} onChange={(e) => setGlobalBuyer({ rates: { ...g.rates, [c]: Math.max(0.01, Number(e.target.value)) } })} />
              </label>
            ))}
            <button className="link-btn small" onClick={() => setGlobalBuyer({ rates: DEFAULT_RATES })}>Reset</button>
          </div>
          <p className="tiny" style={{ marginTop: 6 }}>A fixed table so every screen agrees. Check it against the RBI reference rate before you rely on a figure.</p>
        </details>
      )}
    </div>
  );
}
