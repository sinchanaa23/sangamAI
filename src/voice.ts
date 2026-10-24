// Voice input for the workforce profile, on the browser's Web Speech API
// (hi-IN, kn-IN, ta-IN in Chrome). Bhashini through server/bhashini.ts can
// replace this later without touching the pages; until keys arrive the browser
// covers the same languages. Typed input in the form always stays available —
// voice fills fields, it never replaces them.

export type VoiceLang = 'hi-IN' | 'kn-IN' | 'ta-IN';

export const VOICE_LANGS: { code: VoiceLang; native: string; english: string }[] = [
  { code: 'hi-IN', native: 'हिंदी', english: 'Hindi' },
  { code: 'kn-IN', native: 'ಕನ್ನಡ', english: 'Kannada' },
  { code: 'ta-IN', native: 'தமிழ்', english: 'Tamil' },
];

// Minimal structural types: the DOM lib's SpeechRecognition types are not stable
// across the TypeScript versions the team uses, so we talk to the API through these.
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
interface SpeechEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
type RecognitionCtor = new () => RecognitionLike;

const getCtor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export function speechSupported(): boolean {
  return getCtor() != null;
}

export interface ListenHandlers {
  /** fired as partial text arrives */
  onPartial?: (text: string) => void;
  /** fired once with the final transcript */
  onFinal: (text: string) => void;
  onError: (message: string) => void;
}

export interface ListenHandle { stop(): void }

/** Listen for one utterance. Returns a handle to stop early (say, when the user skips). */
export function listenOnce(lang: VoiceLang, h: ListenHandlers): ListenHandle {
  const Ctor = getCtor();
  if (!Ctor) { h.onError('not-supported'); return { stop: () => {} }; }
  const rec = new Ctor();
  rec.lang = lang;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let finalText: string | null = null;
  rec.onresult = (e) => {
    let text = '';
    for (let i = e.resultIndex; i < e.results.length; i++) text += e.results[i][0].transcript;
    if (e.results[e.results.length - 1].isFinal) {
      finalText = text.trim();
      h.onFinal(finalText);
    } else {
      h.onPartial?.(text.trim());
    }
  };
  rec.onerror = (e) => {
    if (finalText != null) return; // some browsers raise a harmless error after a final result
    h.onError(e.error ?? 'unknown');
  };
  rec.onend = () => { if (finalText == null) h.onError('no-speech'); };
  try { rec.start(); } catch { h.onError('start-failed'); }
  return { stop: () => { try { rec.stop(); } catch { /* already stopped */ } } };
}

/** Say a prompt out loud in the chosen language (best effort; never blocks the flow). */
export function speak(text: string, lang: VoiceLang): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang === lang) ?? window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang.slice(0, 2)));
    if (voice) u.voice = voice;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  } catch { /* speech synthesis unavailable: the question is also on screen */ }
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}

// ---------- turning what was heard into values ----------

// digits spoken in Indian languages usually come back as ASCII digits, but map
// the native digit characters too just in case
const DIGIT_BLOCKS: [RegExp, string][] = [
  [/[०-९]/g, '०'], [/[೦-೯]/g, '೦'], [/[௦-௯]/g, '௦'],
];
const toAsciiDigits = (s: string) => {
  let out = s;
  for (const [re, zero] of DIGIT_BLOCKS) {
    if (re.test(out)) out = out.replace(re, (d) => String(d.charCodeAt(0) - zero.charCodeAt(0)));
  }
  return out;
};

/** Pull a number out of a transcript; null when none was spoken. */
export function parseNumber(text: string): number | null {
  const m = toAsciiDigits(text).replace(/[,]/g, '').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

/** Match a transcript against per-language keyword sets, e.g. for the safety choice. */
export function matchChoice<T extends string>(text: string, choices: Record<T, readonly string[]>): T | null {
  const t = text.trim();
  for (const [key, words] of Object.entries(choices) as [T, string[]][]) {
    if (words.some((w) => t.includes(w))) return key;
  }
  return null;
}
