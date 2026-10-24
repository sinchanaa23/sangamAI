import { useMemo } from 'react';
import './motion.css';

type GraphemeSegmenter = {
  segment(input: string): Iterable<{ segment: string }>;
};

type SegmenterCtor = new (
  locale?: string,
  options?: { granularity?: 'grapheme' | 'word' | 'sentence' },
) => GraphemeSegmenter;

/* Intl.Segmenter arrived after ES2020 (the tsconfig lib), so the constructor is
   reached through a narrow structural type instead of the global declaration. */
const SegmenterImpl: SegmenterCtor | undefined = (
  Intl as { Segmenter?: SegmenterCtor }
).Segmenter;

/** Split into graphemes — never code units, so Devanagari/Kannada/Tamil
    matras stay joined. Uses Intl.Segmenter when present, else code points. */
function splitGraphemes(text: string): string[] {
  if (SegmenterImpl) {
    try {
      const segmenter = new SegmenterImpl(undefined, { granularity: 'grapheme' });
      const parts: string[] = [];
      for (const part of segmenter.segment(text)) parts.push(part.segment);
      return parts;
    } catch {
      /* fall through to the code-point fallback */
    }
  }
  return Array.from(text);
}

export default function TextReveal({
  text,
  as = 'div',
  className,
  delay = 0,
  stagger = 45,
}: {
  text: string;
  as?: 'h1' | 'h2' | 'div' | 'span';
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const parts = useMemo(() => splitGraphemes(text), [text]);
  const Tag = as;
  return (
    <Tag className={className} aria-label={text}>
      {parts.map((grapheme, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="fw-rise"
          style={{
            display: 'inline-block',
            whiteSpace: 'pre',
            animationDelay: `${delay + i * stagger}ms`,
          }}
        >
          {grapheme}
        </span>
      ))}
    </Tag>
  );
}
