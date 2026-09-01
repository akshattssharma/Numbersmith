import type { ConceptId } from './types';

/**
 * The concept graph — not a question bank.
 *
 * The bank-vs-graph distinction is the whole architecture. A bank can only
 * answer "what next?" by shuffling. A graph can answer "which *prerequisite*
 * is actually missing?", which is the question that matters when a child is
 * stuck. When a child fails `add-2digit-carry`, we don't hand them more
 * carrying problems — we test `place-value-2digit` and `number-bonds-10`
 * first, because the bug is almost always upstream.
 */

export interface ConceptNode {
  id: ConceptId;
  label: string;
  /** child-facing wording; never appears as "objective" text to the kid */
  gist: string;
  prereqs: ConceptId[];
  /** nominal US grade band, used only for parent-facing framing */
  grade: string;
  /** BKT parameters. Tuned per concept, not global — slip is higher on */
  /** multi-step items, guess is higher where the answer space is small.   */
  bkt: { init: number; learn: number; slip: number; guess: number };
}

export const CONCEPTS: Record<ConceptId, ConceptNode> = {
  'number-sense': {
    id: 'number-sense',
    label: 'Number sense',
    gist: 'Knowing how big a number feels',
    prereqs: [],
    grade: 'K–1',
    bkt: { init: 0.4, learn: 0.18, slip: 0.08, guess: 0.2 },
  },
  'counting-on': {
    id: 'counting-on',
    label: 'Counting on',
    gist: 'Starting from a number instead of from one',
    prereqs: ['number-sense'],
    grade: 'K–1',
    bkt: { init: 0.35, learn: 0.2, slip: 0.1, guess: 0.15 },
  },
  'number-bonds-10': {
    id: 'number-bonds-10',
    label: 'Bonds to ten',
    gist: 'Pairs that make ten',
    prereqs: ['counting-on'],
    grade: '1',
    bkt: { init: 0.3, learn: 0.22, slip: 0.08, guess: 0.15 },
  },
  'place-value-2digit': {
    id: 'place-value-2digit',
    label: 'Tens and ones',
    gist: 'A ten is one bundle, not ten separate things',
    prereqs: ['number-bonds-10'],
    grade: '1–2',
    bkt: { init: 0.25, learn: 0.2, slip: 0.1, guess: 0.1 },
  },
  'add-within-20': {
    id: 'add-within-20',
    label: 'Adding within 20',
    gist: 'Putting small groups together',
    prereqs: ['counting-on', 'number-bonds-10'],
    grade: '1–2',
    bkt: { init: 0.3, learn: 0.2, slip: 0.1, guess: 0.12 },
  },
  'add-2digit-nocarry': {
    id: 'add-2digit-nocarry',
    label: 'Adding tens and ones',
    gist: 'Add the ones, add the tens',
    prereqs: ['place-value-2digit', 'add-within-20'],
    grade: '2',
    bkt: { init: 0.2, learn: 0.2, slip: 0.1, guess: 0.06 },
  },
  'add-2digit-carry': {
    id: 'add-2digit-carry',
    label: 'Adding with regrouping',
    gist: 'Ten loose ones become one new bundle',
    prereqs: ['add-2digit-nocarry', 'number-bonds-10'],
    grade: '2',
    bkt: { init: 0.12, learn: 0.16, slip: 0.12, guess: 0.05 },
  },
  'sub-within-20': {
    id: 'sub-within-20',
    label: 'Subtracting within 20',
    gist: 'Taking some away',
    prereqs: ['add-within-20'],
    grade: '1–2',
    bkt: { init: 0.28, learn: 0.2, slip: 0.1, guess: 0.12 },
  },
  'sub-2digit-noborrow': {
    id: 'sub-2digit-noborrow',
    label: 'Subtracting tens and ones',
    gist: 'Take from the ones, take from the tens',
    prereqs: ['place-value-2digit', 'sub-within-20'],
    grade: '2',
    bkt: { init: 0.18, learn: 0.2, slip: 0.1, guess: 0.06 },
  },
  'sub-2digit-borrow': {
    id: 'sub-2digit-borrow',
    label: 'Subtracting with regrouping',
    gist: 'Break open a bundle to get more ones',
    prereqs: ['sub-2digit-noborrow', 'place-value-2digit'],
    grade: '2–3',
    bkt: { init: 0.1, learn: 0.15, slip: 0.14, guess: 0.05 },
  },
  'skip-counting': {
    id: 'skip-counting',
    label: 'Skip counting',
    gist: 'Counting in jumps',
    prereqs: ['counting-on'],
    grade: '2',
    bkt: { init: 0.3, learn: 0.22, slip: 0.09, guess: 0.12 },
  },
  'equal-groups': {
    id: 'equal-groups',
    label: 'Equal groups',
    gist: 'Same amount in every container',
    prereqs: ['skip-counting', 'add-within-20'],
    grade: '2–3',
    bkt: { init: 0.22, learn: 0.2, slip: 0.1, guess: 0.1 },
  },
  arrays: {
    id: 'arrays',
    label: 'Rows and columns',
    gist: 'Groups arranged in a rectangle',
    prereqs: ['equal-groups'],
    grade: '3',
    bkt: { init: 0.18, learn: 0.2, slip: 0.1, guess: 0.08 },
  },
  'mult-facts-2-5-10': {
    id: 'mult-facts-2-5-10',
    label: 'Times 2, 5 and 10',
    gist: 'The friendliest multiplication facts',
    prereqs: ['arrays', 'skip-counting'],
    grade: '3',
    bkt: { init: 0.15, learn: 0.18, slip: 0.1, guess: 0.08 },
  },
};

export const ALL_CONCEPTS = Object.keys(CONCEPTS) as ConceptId[];

/** Every prerequisite, transitively, nearest-first. */
export function prereqChain(id: ConceptId, seen = new Set<ConceptId>()): ConceptId[] {
  const out: ConceptId[] = [];
  for (const p of CONCEPTS[id].prereqs) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p, ...prereqChain(p, seen));
  }
  return out;
}

/** Concepts that list `id` as a direct prerequisite. */
export function unlockedBy(id: ConceptId): ConceptId[] {
  return ALL_CONCEPTS.filter((c) => CONCEPTS[c].prereqs.includes(id));
}

/** Topological order, so any UI that lists concepts lists them coherently. */
export function topoOrder(): ConceptId[] {
  const out: ConceptId[] = [];
  const mark = new Set<ConceptId>();
  const visit = (c: ConceptId) => {
    if (mark.has(c)) return;
    mark.add(c);
    CONCEPTS[c].prereqs.forEach(visit);
    out.push(c);
  };
  ALL_CONCEPTS.forEach(visit);
  return out;
}
