import type { MisconceptionId, Problem } from './types';

/**
 * The misconception engine.
 *
 * A wrong answer is data, not a verdict. Most ed-tech throws the wrong answer
 * away and records a 0. But the specific wrong answer a child produces is
 * almost always the output of a *consistent rule they are following*. Recover
 * the rule and you know what to teach; record a 0 and you know nothing.
 *
 * Each signature is a pure function: given the problem and what the child
 * actually entered, would this bug produce exactly that? One match is a
 * hypothesis. Two matches across different problems is a finding — because the
 * odds of the same wrong rule reproducing by chance twice are tiny.
 *
 * This file is deliberately dependency-free and deterministic. No model call
 * is needed to *detect* a misconception; the LLM's job is to phrase the
 * response, never to decide the diagnosis. That keeps diagnosis auditable,
 * instant, free, and identical for every child — which matters a great deal
 * when the user is seven years old.
 */

export interface MisconceptionDef {
  id: MisconceptionId;
  label: string;
  /** what the child believes — stated as a rule, in their voice */
  belief: string;
  /** what a parent should be told, without jargon */
  parentGloss: string;
  /**
   * How much a single match is worth as evidence.
   *
   * 'high' means the answer this bug produces is structurally distinctive —
   * 62-38 -> 36 is not a number you land on by being a bit off, so one match
   * is already strong. 'low' means the bug predicts something near the correct
   * answer (typically answer +/- a small amount), which an ordinary near-miss
   * hits by chance surprisingly often. Treating those two as equal evidence
   * gives the system confident hallucinated diagnoses, which is worse than no
   * diagnosis at all: it sends a child into a repair loop for a bug they never
   * had. Low-specificity bugs therefore need a third sighting before we act.
   */
  specificity: 'high' | 'low';
  /** produce the answer this bug would give, or null if not applicable */
  predict: (p: Problem) => number | null;
}

const digits = (n: number) => ({ t: Math.floor(Math.abs(n) / 10) % 10, o: Math.abs(n) % 10 });

export const MISCONCEPTIONS: Record<MisconceptionId, MisconceptionDef> = {
  /* ---------------------------------------------------------------- addition */

  'add-dropped-carry': {
    id: 'add-dropped-carry',
    specificity: 'high',
    label: 'Dropped the carry',
    belief: 'I add each column and write what I get. The extra ten just goes away.',
    parentGloss:
      'They add the ones and the tens correctly but lose the extra ten when the ones column overflows.',
    predict: (p) => {
      if (p.kind !== 'combine') return null;
      const A = digits(p.a), B = digits(p.b);
      if (A.o + B.o < 10) return null;
      return (A.t + B.t) * 10 + ((A.o + B.o) % 10);
    },
  },

  'add-carry-appended': {
    id: 'add-carry-appended',
    specificity: 'high',
    label: 'Wrote the whole sum in the ones column',
    belief: 'Ones plus ones is twelve, so I write twelve.',
    parentGloss:
      'They understand the arithmetic but not that a column can only hold one digit.',
    predict: (p) => {
      if (p.kind !== 'combine') return null;
      const A = digits(p.a), B = digits(p.b);
      if (A.o + B.o < 10) return null;
      return (A.t + B.t) * 100 + (A.o + B.o);
    },
  },

  'add-place-misaligned': {
    id: 'add-place-misaligned',
    specificity: 'high',
    label: 'Lined the digits up wrongly',
    belief: 'I add the first digit to the first digit.',
    parentGloss:
      'When one number is shorter, they add its digit to the wrong column — a place-value issue, not an addition one.',
    predict: (p) => {
      if (p.kind !== 'combine') return null;
      if (p.b >= 10) return null; // only bites when the second number is single-digit
      const A = digits(p.a);
      return (A.t + p.b) * 10 + A.o;
    },
  },

  /* ------------------------------------------------------------- subtraction */

  'sub-smaller-from-larger': {
    id: 'sub-smaller-from-larger',
    specificity: 'high',
    label: 'Always took the smaller digit from the larger',
    belief: 'Subtracting means the small one goes away from the big one, in every column.',
    parentGloss:
      'The single most common subtraction bug. In each column they subtract the smaller digit from the larger one, so the answer looks reasonable but is wrong whenever borrowing is needed.',
    predict: (p) => {
      if (p.kind !== 'ship') return null;
      const A = digits(p.a), B = digits(p.b);
      if (A.o >= B.o) return null; // bug is invisible when no borrow is needed
      return Math.abs(A.t - B.t) * 10 + Math.abs(A.o - B.o);
    },
  },

  'sub-borrow-not-decremented': {
    id: 'sub-borrow-not-decremented',
    specificity: 'high',
    label: 'Borrowed but never paid it back',
    belief: 'I can take a ten whenever I need one, and the tens column stays the same.',
    parentGloss:
      'They know to break open a ten, but forget that the tens column now has one fewer.',
    predict: (p) => {
      if (p.kind !== 'ship') return null;
      const A = digits(p.a), B = digits(p.b);
      if (A.o >= B.o) return null;
      return (A.t - B.t) * 10 + (A.o + 10 - B.o);
    },
  },

  'sub-reversed': {
    id: 'sub-reversed',
    specificity: 'high',
    label: 'Subtracted the wrong way round',
    belief: 'It does not matter which number goes first.',
    parentGloss:
      'They treat subtraction like addition, where order does not matter. Usually a reading-the-problem issue rather than an arithmetic one.',
    predict: (p) => (p.kind === 'ship' ? p.b - p.a : null),
  },

  /* ---------------------------------------------------------------- counting */

  'count-on-off-by-one': {
    id: 'count-on-off-by-one',
    specificity: 'low',
    label: 'Counted the starting number',
    belief: 'To add five to seven I say: seven, eight, nine, ten, eleven.',
    parentGloss:
      "They count the number they started on as their first step, so every answer lands one short. It's a counting-strategy bug, not a fact-recall one.",
    predict: (p) => {
      if (p.kind !== 'combine') return null;
      if (p.a > 20 || p.b > 10) return null;
      return p.answer - 1;
    },
  },

  /* ---------------------------------------------------------- multiplication */

  'mult-added-instead': {
    id: 'mult-added-instead',
    specificity: 'high',
    label: 'Added instead of multiplied',
    belief: 'Four groups of three — that is four and three.',
    parentGloss:
      'They have not yet connected "groups of" with repeated addition, so they fall back on the operation they know.',
    predict: (p) => (p.kind === 'groups' ? p.a + p.b : null),
  },

  'mult-one-group-off': {
    id: 'mult-one-group-off',
    specificity: 'low',
    label: 'Lost one group while skip-counting',
    belief: 'Six, twelve, eighteen — that is three groups.',
    parentGloss:
      'They multiply by skip-counting out loud and lose track of how many jumps they have made. The method is right; the bookkeeping slips.',
    predict: (p) => (p.kind === 'groups' ? p.answer - p.b : null),
  },

  /* -------------------------------------------------------------- place value */

  'pv-digits-reversed': {
    id: 'pv-digits-reversed',
    specificity: 'high',
    label: 'Read the digits in the wrong order',
    belief: 'Forty-seven — I hear seven first, so seven bundles and four loose.',
    parentGloss:
      'They swap the tens and ones. In English the ones digit is often said in a way that invites this, so it is very common and usually short-lived.',
    predict: (p) => {
      if (p.kind !== 'load') return null;
      const A = digits(p.answer);
      const flipped = A.o * 10 + A.t;
      return flipped === p.answer ? null : flipped;
    },
  },
};

export const ALL_MISCONCEPTIONS = Object.keys(MISCONCEPTIONS) as MisconceptionId[];

/**
 * Which known bugs would have produced exactly this answer?
 *
 * Returning a list, not a single id, is deliberate: several bugs can predict
 * the same number on one problem. Disambiguating them is the job of the
 * *next* problem, which `selector.ts` picks specifically to split the tie.
 */
export function matchMisconceptions(p: Problem, given: number): MisconceptionId[] {
  if (given === p.answer) return [];
  const hits: MisconceptionId[] = [];
  for (const id of ALL_MISCONCEPTIONS) {
    const predicted = MISCONCEPTIONS[id].predict(p);
    if (predicted !== null && predicted === given) hits.push(id);
  }
  return hits;
}

/**
 * Build a problem that separates two candidate bugs: one where they predict
 * different answers. This is the "ask a question whose answer distinguishes
 * the hypotheses" move — cheap to implement, and it is what turns a guess into
 * a diagnosis.
 */
export function isDiscriminating(p: Problem, a: MisconceptionId, b: MisconceptionId): boolean {
  const pa = MISCONCEPTIONS[a].predict(p);
  const pb = MISCONCEPTIONS[b].predict(p);
  if (pa === null || pb === null) return false;
  return pa !== pb && pa !== p.answer && pb !== p.answer;
}
