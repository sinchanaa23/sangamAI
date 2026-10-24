// The one smooth-scroll instance and its live state, so any component can react to how fast and which way the page is moving.
import type Lenis from 'lenis';

export interface ScrollState { velocity: number; progress: number; direction: number }
type Listener = (s: ScrollState) => void;

let current: Lenis | null = null;
const listeners = new Set<Listener>();

export const setLenis = (l: Lenis | null) => { current = l; };
export const getLenis = () => current;
export const emitScroll = (s: ScrollState) => listeners.forEach((f) => f(s));
/** Subscribe to scroll updates; returns the unsubscribe function. Nothing fires when smooth scrolling is off (reduced motion). */
export const onScroll = (f: Listener) => { listeners.add(f); return () => { listeners.delete(f); }; };
