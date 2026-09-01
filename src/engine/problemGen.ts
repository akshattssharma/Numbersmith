import type { ChallengeKind, ConceptId, Problem, Representation, MisconceptionId } from './types';
import { MISCONCEPTIONS, ALL_MISCONCEPTIONS } from './misconceptions';

/**
 * Problems are generated, never stored.
 *
 * A question bank is a liability: it caps how much a child can play, it leaks
 * (kids memorise answer positions), and it cannot be targeted at a specific
 * bug. A generator can be asked for exactly the item we need right now —
 * "a subtraction that requires borrowing, at difficulty 0.6, that would
 * distinguish smaller-from-larger from borrow-not-decremented" — which is
 * precisely the request the diagnosis loop wants to make.
 */

/** Small deterministic PRNG so demos, tests and replays are reproducible. */
export function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const pick = <T,>(rng: () => number, xs: T[]): T => xs[Math.floor(rng() * xs.length)];
const between = (rng: () => number, lo: number, hi: number) =>
  lo + Math.floor(rng() * (hi - lo + 1));

const KIND_FOR: Record<ConceptId, ChallengeKind> = {
  'number-sense': 'load',
  'counting-on': 'combine',
  'number-bonds-10': 'combine',
  'place-value-2digit': 'load',
  'add-within-20': 'combine',
  'add-2digit-nocarry': 'combine',
  'add-2digit-carry': 'combine',
  'sub-within-20': 'ship',
  'sub-2digit-noborrow': 'ship',
  'sub-2digit-borrow': 'ship',
  'skip-counting': 'groups',
  'equal-groups': 'groups',
  arrays: 'groups',
  'mult-facts-2-5-10': 'groups',
};

let counter = 0;
const nextId = () => `p${(++counter).toString(36)}`;

export interface GenOptions {
  concept: ConceptId;
  difficulty: number;          // 0..1
  representation: Representation;
  rng: () => number;
  /** if set, bias generation toward an item that separates these two bugs */
  discriminate?: [MisconceptionId, MisconceptionId];
  /** generate a 'catch the mistake' item performing this bug */
  plant?: MisconceptionId;
}

export function generate(opts: GenOptions): Problem {
  const { concept, difficulty: d, representation, rng } = opts;
  const kind: ChallengeKind = opts.plant ? 'catch' : KIND_FOR[concept];

  let a = 0, b = 0, answer = 0, regroup = false;

  switch (KIND_FOR[concept]) {
    case 'load': {
      // Compose a target quantity out of bundles and loose ones.
      const max = concept === 'number-sense' ? 9 + Math.round(d * 11) : 19 + Math.round(d * 80);
      answer = between(rng, concept === 'number-sense' ? 3 : 12, max);
      // Harder loads use a target whose ones digit invites a reversal error.
      if (d > 0.5 && answer % 10 === Math.floor(answer / 10)) answer += 1;
      a = answer; b = 0;
      break;
    }
    case 'combine': {
      if (concept === 'counting-on' || concept === 'add-within-20') {
        a = between(rng, 3, 9 + Math.round(d * 8));
        b = between(rng, 2, 4 + Math.round(d * 5));
      } else if (concept === 'number-bonds-10') {
        a = between(rng, 1, 9);
        b = 10 - a;
      } else if (concept === 'add-2digit-nocarry') {
        const at = between(rng, 1, 4), bt = between(rng, 1, 4);
        const ao = between(rng, 0, 4), bo = between(rng, 0, 9 - ao);
        a = at * 10 + ao; b = bt * 10 + bo;
      } else {
        // add-2digit-carry: force the ones column to overflow
        const at = between(rng, 1, 3 + Math.round(d * 5));
        const bt = between(rng, 1, 2 + Math.round(d * 4));
        const ao = between(rng, 4, 9);
        const bo = between(rng, 10 - ao, 9);
        a = at * 10 + ao; b = bt * 10 + bo;
      }
      answer = a + b;
      regroup = (a % 10) + (b % 10) >= 10;
      break;
    }
    case 'ship': {
      if (concept === 'sub-within-20') {
        a = between(rng, 6, 12 + Math.round(d * 8));
        b = between(rng, 2, a - 1);
      } else if (concept === 'sub-2digit-noborrow') {
        const at = between(rng, 2, 6), ao = between(rng, 4, 9);
        a = at * 10 + ao;
        b = between(rng, 1, at - 1) * 10 + between(rng, 0, ao);
      } else {
        // sub-2digit-borrow: force the ones column to be short
        const at = between(rng, 2, 4 + Math.round(d * 5));
        const ao = between(rng, 0, 5);
        a = at * 10 + ao;
        const bt = between(rng, 1, at - 1);
        const bo = between(rng, ao + 1, 9);
        b = bt * 10 + bo;
      }
      answer = a - b;
      regroup = a % 10 < b % 10;
      break;
    }
    case 'groups': {
      // a = size of each group, b = number of groups
      const pool = d < 0.4 ? [2, 5, 10] : d < 0.7 ? [2, 3, 4, 5, 10] : [2, 3, 4, 5, 6, 7, 8, 10];
      a = pick(rng, pool);
      b = between(rng, 2, 3 + Math.round(d * 5));
      answer = a * b;
      break;
    }
  }

  const problem: Problem = {
    id: nextId(),
    concept,
    kind,
    representation,
    a,
    b,
    answer,
    difficulty: d,
    regroup,
  };

  if (opts.plant) {
    const wrong = MISCONCEPTIONS[opts.plant].predict({ ...problem, kind: KIND_FOR[concept] });
    if (wrong !== null && wrong !== answer) {
      problem.plantedBug = opts.plant;
      problem.plantedAnswer = wrong;
    } else {
      problem.kind = KIND_FOR[concept]; // bug not applicable here; fall back to a normal item
    }
  }

  return problem;
}

/**
 * Generate an item that gives two candidate bugs *different* predictions, so
 * the next answer resolves which one the child actually holds. Tries a bounded
 * number of times and falls back to a plain item.
 */
export function generateDiscriminating(
  opts: GenOptions,
  a: MisconceptionId,
  b: MisconceptionId,
  tries = 24,
): Problem {
  for (let i = 0; i < tries; i++) {
    const p = generate(opts);
    const pa = MISCONCEPTIONS[a].predict(p);
    const pb = MISCONCEPTIONS[b].predict(p);
    if (pa !== null && pb !== null && pa !== pb && pa !== p.answer && pb !== p.answer) return p;
  }
  return generate(opts);
}

/** Which bugs could even show up on this item? Used to score item value. */
export function applicableBugs(p: Problem): MisconceptionId[] {
  return ALL_MISCONCEPTIONS.filter((id) => {
    const v = MISCONCEPTIONS[id].predict(p);
    return v !== null && v !== p.answer;
  });
}
