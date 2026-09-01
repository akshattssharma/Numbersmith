import type { CastMember, FavouriteItem, PersonalProfile } from './cast';
import { chooseContext, itemById } from './cast';
import type { ChallengeKind, Problem } from './types';

/**
 * Personalized problem text.
 *
 * The appeal of this feature is obvious and the risk is not, so the risk is
 * what this file is built around.
 *
 * **A name can become the maths.** "Jack brings 3 more apples" does not say
 * whether Jack handed them over or walked in holding them, so a child has to
 * decide what happened before they can decide what to add. That converts an
 * arithmetic item into a reading-comprehension item, and it does it invisibly:
 * the child fails, the engine records a subtraction error, and the actual cause
 * was a preposition. Every template below therefore states the direction of
 * transfer explicitly, and the child is always the single pile being counted.
 * Nobody ever has to track two people's quantities at once.
 *
 * **Interesting detail is not free.** Detail that is vivid but irrelevant
 * competes for the same working memory the arithmetic needs, and it costs most
 * for exactly the children who are already struggling with language. So
 * personalization has an intensity, it is set by the learner model rather than
 * by preference, and for some children the correct setting is off. See
 * `derivePolicy` in struggle.ts.
 *
 * **Novelty is most of the effect.** The fourth consecutive problem about Jack
 * and apples is less engaging than a generic one. Context selection carries a
 * hard recency penalty, and a share of items stay deliberately generic — both
 * to keep the effect fresh and to measure whether it is working at all.
 */

export type Intensity = 'off' | 'light' | 'full';

export interface RenderedProblem {
  text: string;
  /** ids of every personalized element used — logged for the engagement model */
  contextIds: string[];
  person?: CastMember;
  item?: FavouriteItem;
  /** true when this item was deliberately left generic as an A/B control */
  isControl: boolean;
}

/**
 * Word budgets per intensity. These are caps, not targets: a story item that
 * runs long is a story item that is measuring reading speed.
 */
const MAX_WORDS: Record<Intensity, number> = { off: 14, light: 20, full: 30 };

/* ------------------------------------------------------------------ builders */

/**
 * Two things are being varied here and they must never be confused:
 *
 *   - the **surface**, decided by the selector, which is what makes an item
 *     symbolic notation or prose. That is a pedagogical choice.
 *   - the **personalization**, decided by the learner model, which is whose
 *     world the prose is about. That is a motivational choice.
 *
 * The first version collapsed them: an item with personalization off rendered
 * as bare `13 − 5` even on the story surface. Two things broke. The language
 * probe stopped probing language, because there was no longer a sentence to
 * unpack. And the control arm of the A/B differed from the treatment arm in
 * *surface* as well as personalization, so the comparison measured two
 * variables at once and could not have answered the question it exists for.
 *
 * So: the surface decides whether there are words. Personalization decides
 * whose world those words are about. `person` and `item` being undefined is
 * how genericness is expressed, never a drop to notation.
 */

/** Neutral stand-ins, so a control item reads like an ordinary word problem. */
const GENERIC_THING = 'blocks';
const GENERIC_PERSON = 'your friend';

function combine(a: number, b: number, item: FavouriteItem | undefined, person: CastMember | undefined, intensity: Intensity, place?: FavouriteItem): string {
  const things = item ? item.many : GENERIC_THING;
  if (intensity === 'light') return `You have ${a} ${things}. You get ${b} more. How many now?`;
  const who = person ? person.name : GENERIC_PERSON;
  const where = place ? ` at ${place.one}` : '';
  return `You have ${a} ${things}${where}. ${cap(who)} gives you ${b} more. How many do you have now?`;
}

function ship(a: number, b: number, item: FavouriteItem | undefined, person: CastMember | undefined, intensity: Intensity): string {
  const things = item ? item.many : GENERIC_THING;
  if (intensity === 'light') return `You have ${a} ${things}. You give away ${b}. How many are left?`;
  // Subtraction is ALWAYS the child giving away. Never "Jack takes some",
  // which leaves it open whether he took them from this pile or another, and
  // never a named person as the one left holding the answer.
  const who = person ? person.name : GENERIC_PERSON;
  return `You have ${a} ${things}. You give ${b} of them to ${who}. How many are left?`;
}

function groups(a: number, b: number, item: FavouriteItem | undefined, person: CastMember | undefined, intensity: Intensity): string {
  const things = item ? item.many : GENERIC_THING;
  if (intensity === 'light') return `${b} boxes. Each holds ${a} ${things}. How many altogether?`;
  const who = person ? person.name : GENERIC_PERSON;
  return `You and ${who} fill ${b} boxes. Every box holds ${a} ${things}. How many ${things} altogether?`;
}

function load(n: number, item: FavouriteItem | undefined, person: CastMember | undefined, intensity: Intensity): string {
  const things = item ? item.many : GENERIC_THING;
  if (intensity === 'light') return `Build a pile of exactly ${n} ${things}.`;
  const who = person ? person.name : GENERIC_PERSON;
  return `${cap(who)} asks for exactly ${n} ${things}. Build the pile.`;
}

/** Bare notation. Only ever reached via the symbolic surface. */
function notation(p: Problem): string {
  switch (p.kind === 'catch' ? inferKind(p) : p.kind) {
    case 'combine': return `${p.a} + ${p.b}`;
    case 'ship': return `${p.a} − ${p.b}`;
    case 'groups': return `${p.b} × ${p.a}`;
    default: return `Build ${p.answer}.`;
  }
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/* -------------------------------------------------------------------- render */

export function renderProblem(
  p: Problem,
  profile: PersonalProfile,
  intensity: Intensity,
  itemIndex: number,
  rng: () => number,
): RenderedProblem {
  // The symbolic surface is notation by definition. Nothing to personalize.
  if (p.representation === 'symbolic') {
    return { text: notation(p), contextIds: [], isControl: false };
  }
  // A holdout of roughly one story item in six stays generic on purpose.
  //
  // Without it, "personalization helps" is an assumption the product can never
  // check. With it, every child generates their own comparison: engagement on
  // personalized items against engagement on control items, for them
  // specifically. It will not be positive for every child, and knowing which
  // children it fails for is worth far more than the handful of items it costs.
  //
  // Critically, a control keeps the *structure* of the item it replaces —
  // same surface, same sentence shape, comparable length — and removes only
  // the child's own world: "your friend" instead of Jack, "blocks" instead of
  // footballs. One variable, isolated. A control that also changed the wording
  // style would tell us nothing about personalization.
  const isControl = intensity !== 'off' && rng() < 0.16;
  const structure: Intensity = intensity === 'off' ? 'light' : intensity;

  const picked = isControl
    ? { item: undefined, person: undefined, ids: [] as string[] }
    : chooseContext(profile, itemIndex, rng, {
        needCountable: true,
        wantPerson: structure === 'full' && intensity !== 'off',
      });
  const effective = structure;

  // A place is a setting, never a countable. It only ever appears as scenery on
  // full intensity, and only on addition, where it cannot be mistaken for a
  // quantity.
  const placeId = effective === 'full' && !isControl && intensity !== 'off'
    ? profile.favourites.find((id) => itemById(id)?.countable === false)
    : undefined;
  const place = placeId && rng() < 0.35 ? itemById(placeId) : undefined;

  let text: string;
  switch (p.kind === 'catch' ? inferKind(p) : p.kind) {
    case 'combine': text = combine(p.a, p.b, picked.item, picked.person, effective, place); break;
    case 'ship': text = ship(p.a, p.b, picked.item, picked.person, effective); break;
    case 'groups': text = groups(p.a, p.b, picked.item, picked.person, effective); break;
    default: text = load(p.answer, picked.item, picked.person, effective); break;
  }

  // Hard cap. If a template ever runs long, fall back a level rather than ship
  // a wall of text to a seven-year-old who is here to do arithmetic.
  if (countWords(text) > MAX_WORDS[effective] && effective === 'full') {
    return renderProblem(p, profile, 'light', itemIndex, rng);
  }

  return {
    text,
    contextIds: picked.ids,
    person: picked.person,
    item: picked.item,
    isControl,
  };
}

const countWords = (s: string) => s.trim().split(/\s+/).length;

function inferKind(p: Problem): ChallengeKind {
  if (p.concept.startsWith('sub')) return 'ship';
  if (p.concept.startsWith('add') || p.concept === 'counting-on' || p.concept === 'number-bonds-10') return 'combine';
  if (p.concept === 'place-value-2digit' || p.concept === 'number-sense') return 'load';
  return 'groups';
}

/**
 * How much personalization can this item carry?
 *
 * Manipulative items get a name at most — the child is manipulating objects,
 * and a paragraph above the tray is something to read past. Symbolic items get
 * nothing: the whole point of that surface is the notation, and decorating it
 * defeats the measurement. The story surface is where personalization belongs
 * and where it earns its place.
 */
export function intensityForSurface(
  policy: Intensity,
  surface: Problem['representation'],
  kind?: ChallengeKind,
): Intensity {
  if (surface === 'symbolic') return 'off';
  if (surface === 'manipulative') {
    if (policy === 'off') return 'off';
    // A "build me exactly 34 footballs" request is one short line and reads
    // naturally with a name on it. Everything else on this surface would put a
    // two-clause sentence above a tray the child is meant to be manipulating,
    // which is reading they did not come here to do.
    return kind === 'load' ? policy : 'light';
  }
  return policy;
}
