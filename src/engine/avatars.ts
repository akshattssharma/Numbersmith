/**
 * The character library.
 *
 * Sixty characters, built procedurally from a small set of parts and rendered
 * as inline SVG. No image files, no model call, no network, no latency, and —
 * the part that matters most — no likeness of a real child is ever created.
 *
 * A child picks a character and names it "Jack". The emotional payoff is the
 * same as a generated portrait, because what makes it *their* Jack is the name
 * and the role, not the resemblance. What is avoided is substantial: per-image
 * cost, a moderation surface pointed at children, unpredictable output in the
 * middle of a play loop, and the single riskiest thing a children's product can
 * do, which is generate likenesses of real children.
 *
 * Sixty is chosen so a classroom's worth of children can each have a distinct
 * cast without collisions being obvious, and so the whole set can be reviewed
 * by a person once rather than moderated forever.
 */

export interface Character {
  id: string;
  /** body silhouette */
  shape: 'round' | 'tall' | 'wide' | 'bean' | 'blob';
  ears: 'none' | 'round' | 'pointy' | 'long' | 'antenna';
  eyes: 'dots' | 'big' | 'wide' | 'sleepy';
  mouth: 'smile' | 'grin' | 'small' | 'oh';
  pattern: 'none' | 'spots' | 'belly' | 'stripe';
  /** [body, accent, detail] */
  palette: [string, string, string];
}

/**
 * Hues chosen to stay distinguishable from each other and from the three world
 * palettes, and to read clearly at 32px, which is the size they are usually
 * seen at. Deliberately non-human colours: a purple creature named Jack is
 * obviously a character *standing for* Jack, which is the honest framing and
 * also sidesteps every question about skin tone representation in a generated
 * set.
 */
const PALETTES: [string, string, string][] = [
  ['#7DD3FC', '#0EA5E9', '#082F49'], // sky
  ['#86EFAC', '#22C55E', '#052E16'], // fern
  ['#FCA5A5', '#EF4444', '#450A0A'], // coral
  ['#FDE68A', '#F59E0B', '#451A03'], // honey
  ['#C4B5FD', '#8B5CF6', '#2E1065'], // iris
  ['#F9A8D4', '#EC4899', '#500724'], // blossom
  ['#5EEAD4', '#14B8A6', '#042F2E'], // lagoon
  ['#FDBA74', '#F97316', '#431407'], // ember
  ['#A5B4FC', '#6366F1', '#1E1B4B'], // dusk
  ['#D9F99D', '#84CC16', '#1A2E05'], // moss
  ['#F0ABFC', '#D946EF', '#4A044E'], // orchid
  ['#94A3B8', '#475569', '#0F172A'], // slate
];

const SHAPES: Character['shape'][] = ['round', 'tall', 'wide', 'bean', 'blob'];
const EARS: Character['ears'][] = ['none', 'round', 'pointy', 'long', 'antenna'];
const EYES: Character['eyes'][] = ['dots', 'big', 'wide', 'sleepy'];
const MOUTHS: Character['mouth'][] = ['smile', 'grin', 'small', 'oh'];
const PATTERNS: Character['pattern'][] = ['none', 'spots', 'belly', 'stripe'];

/**
 * The library is generated deterministically rather than listed by hand, so a
 * character id means the same thing forever — including across app updates, so
 * a child's Jack never silently becomes a different creature.
 */
export const CHARACTERS: Character[] = Array.from({ length: 60 }, (_, i) => ({
  id: `c${String(i).padStart(2, '0')}`,
  shape: SHAPES[i % SHAPES.length],
  ears: EARS[Math.floor(i / 5) % EARS.length],
  eyes: EYES[Math.floor(i / 3) % EYES.length],
  mouth: MOUTHS[Math.floor(i / 7) % MOUTHS.length],
  pattern: PATTERNS[Math.floor(i / 11) % PATTERNS.length],
  palette: PALETTES[i % PALETTES.length],
}));

export const characterById = (id: string): Character =>
  CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

/** Characters not already taken by someone in the cast. */
export function availableCharacters(taken: string[]): Character[] {
  const used = new Set(taken);
  return CHARACTERS.filter((c) => !used.has(c.id));
}
