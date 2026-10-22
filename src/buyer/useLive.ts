import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeSignals, fetchFx, fetchHazards, fetchNews } from '../live';
import type { FeedState, Fx, Hazard, Headline } from '../live';

const run = <T,>(p: Promise<T>, set: (s: FeedState<T>) => void) =>
  p.then((data) => set({ status: 'ok', data, at: new Date() })).catch((e) => set({ status: 'error', message: String(e?.message ?? e) }));

/** Loads live feeds once and keeps them while the buyer moves between pages. */
export function useLive() {
  const [fx, setFx] = useState<FeedState<Fx>>({ status: 'loading' });
  const [hazards, setHazards] = useState<FeedState<Hazard[]>>({ status: 'loading' });
  const [news, setNews] = useState<FeedState<Headline[]>>({ status: 'loading' });

  const refresh = useCallback(() => {
    setFx({ status: 'loading' }); setHazards({ status: 'loading' }); setNews({ status: 'loading' });
    run(fetchFx(), setFx);
    run(fetchHazards(), setHazards);
    run(fetchNews(), setNews);
  }, []);

  useEffect(refresh, [refresh]);

  const signals = useMemo(
    () => computeSignals(news.status === 'ok' ? news.data : null, hazards.status === 'ok' ? hazards.data : null),
    [news, hazards],
  );
  return { fx, hazards, news, signals, refresh };
}

export type Live = ReturnType<typeof useLive>;
