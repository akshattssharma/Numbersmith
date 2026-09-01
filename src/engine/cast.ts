import type { Attempt } from './types';

/**
 * The cast and the favourites — everything that makes a problem feel like it is
 * about *this* child's world.
 *
 * Two hard rules govern this whole file, and both are architectural rather than
 * policy documents:
 *
 *  1. **Nothing here ever leaves the device.** The cast lives in local storage,
 *     is never sent to a server (there isn't one) and — see `scrubNames` — is
 *     stripped out of anything that could reach a language model. A child's
 *     friends' first names are other people's children's names. We hold them
 *     because the game is better for it, and we hold them nowhere else.
 *
 *  2. **First names only, entered by a parent.** No surnames, no photos, no
 *     relationship detail beyond a label the child picks. A free text field a
 *     child types into is content someone has to moderate; a parent-gated setup
 *     screen is not. This is the version that survives a COPPA conversation and
 *     a school procurement review, and the cost is one setup screen.
 */

export type FavouriteCategory = 'fruit' | 'snack' | 'animal' | 'game' | 'place' | 'toy';

export interface FavouriteItem {
  id: string;
  category: FavouriteCategory;
  /** singular noun as it appears mid-sentence */
  one: string;
  /** plural, because "3 sheeps" undoes the whole effect */
  many: string;
  /** placeholder art. Real illustration replaces this; the shape does not change. */
  icon: string;
  /** can this be counted out as individual objects? Places cannot. */
  countable: boolean;
}

export interface CastMember {
  id: string;
  /** first name only — enforced at the input, not just requested */
  name: string;
  relation: 'friend' | 'family';
  characterId: string;
}

export interface PersonalProfile {
  /** what the child is called in a problem. "You" if not set — which is fine. */
  childName?: string;
  cast: CastMember[];
  favourites: string[];              // ids into CATALOGUE, seeded by tapping
  /** learned engagement per context id — residual against this child's own mean */
  engagement: Record<string, { n: number; sum: number }>;
  /** recency, so the same friend and the same fruit do not appear every item */
  lastUsed: Record<string, number>;
}

/* ------------------------------------------------------------------ catalogue */

const F = (
  id: string, category: FavouriteCategory, one: string, many: string, icon: string,
  countable = true,
): FavouriteItem => ({ id, category, one, many, icon, countable });

export const CATALOGUE: FavouriteItem[] = [
  // fruit
  F('apple', 'fruit', 'apple', 'apples', '🍎'),
  F('banana', 'fruit', 'banana', 'bananas', '🍌'),
  F('grape', 'fruit', 'grape', 'grapes', '🍇'),
  F('melon', 'fruit', 'melon slice', 'melon slices', '🍉'),
  F('strawberry', 'fruit', 'strawberry', 'strawberries', '🍓'),
  F('mango', 'fruit', 'mango', 'mangoes', '🥭'),
  // snack
  F('cookie', 'snack', 'cookie', 'cookies', '🍪'),
  F('pizza', 'snack', 'pizza slice', 'pizza slices', '🍕'),
  F('icecream', 'snack', 'ice cream', 'ice creams', '🍦'),
  F('popcorn', 'snack', 'popcorn box', 'popcorn boxes', '🍿'),
  F('donut', 'snack', 'doughnut', 'doughnuts', '🍩'),
  // animal
  F('cat', 'animal', 'cat', 'cats', '🐈'),
  F('dog', 'animal', 'dog', 'dogs', '🐕'),
  F('dinosaur', 'animal', 'dinosaur', 'dinosaurs', '🦕'),
  F('penguin', 'animal', 'penguin', 'penguins', '🐧'),
  F('frog', 'animal', 'frog', 'frogs', '🐸'),
  F('horse', 'animal', 'horse', 'horses', '🐴'),
  // game / toy
  F('football', 'game', 'football', 'footballs', '⚽'),
  F('basketball', 'game', 'basketball', 'basketballs', '🏀'),
  F('cricketball', 'game', 'cricket ball', 'cricket balls', '🏏'),
  F('chesspiece', 'game', 'chess piece', 'chess pieces', '♟️'),
  F('card', 'game', 'trading card', 'trading cards', '🃏'),
  F('brick', 'toy', 'building brick', 'building bricks', '🧱'),
  F('robot', 'toy', 'toy robot', 'toy robots', '🤖'),
  F('rocket', 'toy', 'toy rocket', 'toy rockets', '🚀'),
  F('marble', 'toy', 'marble', 'marbles', '🔮'),
  F('kite', 'toy', 'kite', 'kites', '🪁'),
  // place — not countable; used as *setting*, never as the thing being counted
  F('park', 'place', 'the park', 'the park', '🏞️', false),
  F('beach', 'place', 'the beach', 'the beach', '🏖️', false),
  F('treehouse', 'place', 'the treehouse', 'the treehouse', '🌳', false),
  F('space', 'place', 'the space station', 'the space station', '🛰️', false),
  F('library', 'place', 'the library', 'the library', '📚', false),
];

export const itemById = (id: string): FavouriteItem | undefined =>
  CATALOGUE.find((f) => f.id === id);

export const byCategory = (c: FavouriteCategory): FavouriteItem[] =>
  CATALOGUE.filter((f) => f.category === c);

export const CATEGORY_LABELS: Record<FavouriteCategory, string> = {
  fruit: 'Fruit', snack: 'Snacks', animal: 'Animals',
  game: 'Games', place: 'Places', toy: 'Toys',
};

/* ------------------------------------------------------------------- profile */

export function emptyProfile(): PersonalProfile {
  return { cast: [], favourites: [], engagement: {}, lastUsed: {} };
}

/**
 * A profile good enough to play with before anyone has set anything up.
 * Cold start matters: the first session should already feel like a game, not
 * like a form with a game behind it.
 */
export function defaultProfile(): PersonalProfile {
  return {
    ...emptyProfile(),
    favourites: ['apple', 'cookie', 'dinosaur', 'football', 'rocket', 'park'],
  };
}

/** First names only — enforced here rather than asked for in placeholder text. */
export function normaliseName(raw: string): string {
  const first = raw.trim().split(/\s+/)[0] ?? '';
  const clean = first.replace(/[^\p{L}\p{M}'-]/gu, '').slice(0, 14);
  return clean ? clean[0].toUpperCase() + clean.slice(1) : '';
}

/* ---------------------------------------------------------------- engagement */

/**
 * Engagement, deliberately measured *without* accuracy.
 *
 * The tempting version reweights favourites by how often the child gets those
 * problems right. It is wrong twice over: it would let the game conclude that
 * apples make a child better at arithmetic, and it would quietly bias item
 * selection toward contexts where the child already performs well, corrupting
 * the mastery estimate that the rest of the engine depends on.
 *
 * So engagement is measured from behaviour that has nothing to do with being
 * correct: did they stay with it, did they need help, did they answer promptly.
 * A context can make a child *keener* without making them cleverer, and keener
 * is the thing personalization is actually for.
 */
export function engagementScore(a: Attempt, personalMedianLatency: number): number {
  const stayed = a.abandoned ? 0 : 1;
  const unaided = a.hintsUsed === 0 ? 1 : 0.4;
  const prompt = a.latencyMs < personalMedianLatency * 1.15 ? 1 : 0.35;
  return 0.45 * stayed + 0.2 * unaided + 0.35 * prompt;
}

export function recordEngagement(
  p: PersonalProfile,
  contextIds: string[],
  score: number,
  baseline: number,
  at: number,
): PersonalProfile {
  const engagement = { ...p.engagement };
  const lastUsed = { ...p.lastUsed };
  for (const id of contextIds) {
    const cur = engagement[id] ?? { n: 0, sum: 0 };
    // Residual against the child's own running mean, so a context that only
    // ever appears on easy items does not look magical.
    engagement[id] = { n: cur.n + 1, sum: cur.sum + (score - baseline) };
    lastUsed[id] = at;
  }
  return { ...p, engagement, lastUsed };
}

export function engagementLift(p: PersonalProfile, id: string): number | null {
  const e = p.engagement[id];
  if (!e || e.n < 3) return null;
  return e.sum / e.n;
}

/* -------------------------------------------------------------------- choose */

/**
 * Pick a context for the next story item.
 *
 * Two forces pull against each other. Engagement lift says use what works.
 * Recency says do not use it again yet — the fourth consecutive problem about
 * Jack and apples is not four times as engaging as the first, it is *less*
 * engaging than a generic one, because novelty is most of the effect and it
 * burns fast. So a recency penalty is applied hard, and it is the reason the
 * favourite list needs five per category rather than one.
 */
export function chooseContext(
  p: PersonalProfile,
  itemIndex: number,
  rng: () => number,
  opts: { needCountable: boolean; wantPerson: boolean },
): { item?: FavouriteItem; person?: CastMember; ids: string[] } {
  const pool = p.favourites
    .map(itemById)
    .filter((f): f is FavouriteItem => !!f && (!opts.needCountable || f.countable));

  const score = (id: string) => {
    const lift = engagementLift(p, id) ?? 0;
    const since = itemIndex - (p.lastUsed[id] ?? -99);
    const recency = since < 3 ? -1.2 : since < 6 ? -0.4 : 0;
    return lift + recency + rng() * 0.3;
  };

  const item = pool.length
    ? pool.slice().sort((a, b) => score(b.id) - score(a.id))[0]
    : undefined;

  const person = opts.wantPerson && p.cast.length
    ? p.cast.slice().sort((a, b) => score(b.id) - score(a.id))[0]
    : undefined;

  const ids = [item?.id, person?.id].filter((x): x is string => !!x);
  return { item, person, ids };
}

/* ----------------------------------------------------------------- safety */

/**
 * Remove every cast name from a string before it can reach a model.
 *
 * The companion's optional model rephrase is the only path in this app by which
 * text could leave the device, so it is the only place this has to hold — and
 * it holds by construction rather than by remembering. Names are stripped on
 * the way out and the rendered line is assembled locally afterwards.
 */
export function scrubNames(text: string, p: PersonalProfile): string {
  let out = text;
  for (const m of p.cast) {
    if (!m.name) continue;
    out = out.replace(new RegExp(`\\b${escapeRe(m.name)}\\b`, 'gi'), 'their friend');
  }
  if (p.childName) {
    out = out.replace(new RegExp(`\\b${escapeRe(p.childName)}\\b`, 'gi'), 'they');
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True if any cast name survives in the text — used as a test assertion. */
export function containsCastName(text: string, p: PersonalProfile): boolean {
  return p.cast.some((m) => m.name && new RegExp(`\\b${escapeRe(m.name)}\\b`, 'i').test(text))
    || (!!p.childName && new RegExp(`\\b${escapeRe(p.childName)}\\b`, 'i').test(text));
}

/* --------------------------------------------------------------- persistence */

const KEY = 'numbersmith.profile.v1';

export function loadProfile(): PersonalProfile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultProfile();
    const parsed = JSON.parse(raw) as PersonalProfile;
    return { ...defaultProfile(), ...parsed };
  } catch {
    // Private windows, cleared site data, storage disabled entirely — all of
    // which must degrade to "the game still works", never to a broken screen.
    return defaultProfile();
  }
}

export function saveProfile(p: PersonalProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* nothing to do and nothing worth telling a child about */
  }
}
