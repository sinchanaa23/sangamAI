import { useEffect, useState } from 'react';
import type { NegotiationEvent } from '../../contracts';

/** Plays a recorded list of negotiation events one at a time, like the live stream would. */
export function useReplay(events: NegotiationEvent[], stepMs = 1600) {
  const [count, setCount] = useState(0);
  const [playing, setPlaying] = useState(true);
  const done = count >= events.length;

  useEffect(() => {
    if (!playing || done) return;
    const t = setTimeout(() => setCount((c) => c + 1), count === 0 ? 400 : stepMs);
    return () => clearTimeout(t);
  }, [playing, done, count, stepMs]);

  return {
    shown: events.slice(0, count),
    playing: playing && !done,
    done,
    toggle: () => setPlaying((p) => !p),
    restart: () => { setCount(0); setPlaying(true); },
    skip: () => setCount(events.length),
  };
}
