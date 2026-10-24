import { useEffect, useState } from 'react';
import { DEMO_EVENTS } from './demoFixture';
import { streamNegotiation } from '../../api';
import type { NegotiationEvent } from '../../contracts';
import { useReplay } from './useReplay';

export type FeedSource = 'live' | 'server-replay' | 'offline';

/**
 * Events for the room. With a negotiation id it follows that negotiation's stream.
 * Without one it plays the server's recorded demo, and if the server is not running,
 * the copy bundled with the app, so the room always has something to show.
 */
export function useFeed(id: string | null) {
  const [events, setEvents] = useState<NegotiationEvent[]>([]);
  const [failed, setFailed] = useState(false);
  const [run, setRun] = useState(0);
  const offline = !id && failed;
  const replay = useReplay(offline ? DEMO_EVENTS : []);

  useEffect(() => {
    setEvents([]); setFailed(false);
    let got = 0;
    return streamNegotiation(id ?? 'demo', (e) => { got++; setEvents((x) => [...x, e]); }, () => { if (got === 0 || id) setFailed(true); });
  }, [id, run]);

  if (offline) {
    return { events: replay.shown, source: 'offline' as FeedSource, error: false, done: replay.done, playing: replay.playing, toggle: replay.toggle, skip: replay.skip, restart: replay.restart };
  }
  const done = events.some((e) => e.type === 'end');
  return {
    events, source: (id ? 'live' : 'server-replay') as FeedSource, error: failed && !done, done, playing: !done && !failed,
    toggle: undefined, skip: undefined, restart: () => setRun((r) => r + 1),
  };
}
