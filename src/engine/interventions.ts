import type { LearnerModel, MisconceptionId, Representation } from './types';

/**
 * The intervention graph.
 *
 * Knowing a child holds a wrong rule is only half the job. The other half is
 * knowing what actually shifts it — and that is an empirical question, not a
 * design opinion. So every intervention is a first-class object with an id,
 * and every time one is delivered we log the tuple:
 *
 *     (misconception, intervention, representation, outcome)
 *
 * At one child that log is a debugging aid. At a hundred thousand children it
 * is the asset: "for smaller-from-larger, on a child who scores high on
 * manipulative affinity, the forced-unbundle ritual resolves it in 2.1 items;
 * the symbolic comparison takes 7." No competitor can copy that by copying the
 * artwork or the question bank. It is the reason to log it from the very first
 * prototype session rather than "once we have scale".
 */

export interface Intervention {
  id: string;
  for: MisconceptionId;
  representation: Representation;
  /** what the game actually does — the mechanic, not a lecture */
  action: string;
  /** the companion's line, kept under two short sentences by design */
  line: string;
  /** hard rule: never re-teach the same way twice in one session */
  cooldownItems: number;
}

export const INTERVENTIONS: Intervention[] = [
  /* ------------------------------------------- sub-smaller-from-larger */
  {
    id: 'unbundle-ritual',
    for: 'sub-smaller-from-larger',
    representation: 'manipulative',
    action:
      'Lock the ones tray to the exact count they have. Taking more than is there is physically impossible, so the only move left is to tap a ten-rod and watch it break into ten ones.',
    line: 'There are only two loose ones here and we need eight. Can we open a bundle?',
    cooldownItems: 6,
  },
  {
    id: 'debt-story',
    for: 'sub-smaller-from-larger',
    representation: 'story',
    action:
      'Frame it as owing: the crate needs 8 crystals, the pouch holds 2. The child must decide where the rest comes from before any arithmetic happens.',
    line: 'They want eight and we have two loose. Where do the other six come from?',
    cooldownItems: 6,
  },
  {
    id: 'two-answers-side-by-side',
    for: 'sub-smaller-from-larger',
    representation: 'symbolic',
    action:
      "Show their answer and the true answer as two bundle piles, unlabelled, and ask which pile is bigger. The contradiction does the teaching, not the explanation.",
    line: 'Two piles. Which one is more?',
    cooldownItems: 8,
  },

  /* ---------------------------------------- sub-borrow-not-decremented */
  {
    id: 'watch-the-tens-shelf',
    for: 'sub-borrow-not-decremented',
    representation: 'manipulative',
    action:
      'Animate the ten-rod physically leaving the tens shelf as it breaks apart, and leave the empty slot visible for the rest of the problem.',
    line: 'The bundle came off the shelf to make those ones. The shelf has one fewer now.',
    cooldownItems: 6,
  },

  /* -------------------------------------------------- add-dropped-carry */
  {
    id: 'overflow-tray',
    for: 'add-dropped-carry',
    representation: 'manipulative',
    action:
      'Make the ones tray hold exactly nine. The tenth one has nowhere to go until the child bundles, so the carry becomes a physical necessity rather than a rule to remember.',
    line: 'The tray only holds nine. What do we do with the extras?',
    cooldownItems: 6,
  },
  {
    id: 'carry-as-cargo',
    for: 'add-dropped-carry',
    representation: 'story',
    action:
      'The overflow becomes a package that must be delivered to the tens shelf before the ship can launch — the carry is a step in the plot, not a mark above a column.',
    line: 'That spare bundle still needs loading before we go.',
    cooldownItems: 6,
  },

  /* ------------------------------------------------ add-carry-appended */
  {
    id: 'one-digit-per-slot',
    for: 'add-carry-appended',
    representation: 'symbolic',
    action:
      'Give each column a single physical slot that will not accept a two-digit token, so the child discovers the constraint by trying it.',
    line: 'Twelve is right — but only one digit fits in that slot.',
    cooldownItems: 6,
  },

  /* --------------------------------------------- add-place-misaligned */
  {
    id: 'colour-the-columns',
    for: 'add-place-misaligned',
    representation: 'manipulative',
    action:
      'Colour tens and ones distinctly and refuse cross-colour merges. Misalignment stops being possible rather than being corrected.',
    line: 'Blues go with blues, yellows with yellows.',
    cooldownItems: 5,
  },

  /* ------------------------------------------------------- sub-reversed */
  {
    id: 'direction-arrow',
    for: 'sub-reversed',
    representation: 'story',
    action:
      'Show the quantity leaving the pile it came from, with a visible direction, before any numbers are entered.',
    line: 'We start with the big pile. Things leave it.',
    cooldownItems: 5,
  },

  /* ------------------------------------------- count-on-off-by-one */
  {
    id: 'silent-start',
    for: 'count-on-off-by-one',
    representation: 'manipulative',
    action:
      'Freeze the starting number as a filled bar with no countable dots, so there is nothing there to count and the child must count only the added ones.',
    line: 'Seven is already in the tank. Count only the new ones.',
    cooldownItems: 6,
  },

  /* ------------------------------------------------ mult-added-instead */
  {
    id: 'fill-every-crate',
    for: 'mult-added-instead',
    representation: 'manipulative',
    action:
      'Force the child to physically fill each container one at a time. Repeated addition becomes something they did, not something they were told.',
    line: 'Four crates. Every one needs three. Fill them all.',
    cooldownItems: 6,
  },
  {
    id: 'array-reveal',
    for: 'mult-added-instead',
    representation: 'symbolic',
    action:
      'Snap the filled containers into a rectangle so rows-times-columns and repeated addition are visibly the same object.',
    line: 'Look — the same crates, in a rectangle.',
    cooldownItems: 7,
  },

  /* ---------------------------------------------- mult-one-group-off */
  {
    id: 'stamp-each-jump',
    for: 'mult-one-group-off',
    representation: 'manipulative',
    action:
      'Leave a visible footprint at each skip-count jump so the child can count the jumps after the fact instead of holding them in memory.',
    line: 'Every jump leaves a mark. Count the marks.',
    cooldownItems: 5,
  },

  /* ---------------------------------------------- pv-digits-reversed */
  {
    id: 'say-it-build-it',
    for: 'pv-digits-reversed',
    representation: 'story',
    action:
      'Say the number in full ("four tens and seven ones") while the bundles assemble in that order, so the spoken order and the built order match.',
    line: 'Four bundles first. Then seven loose.',
    cooldownItems: 6,
  },
];

/**
 * Pick the intervention most likely to work *for this child*: match their
 * strongest representation, skip anything that already failed for them, and
 * never repeat one that is still on cooldown.
 */
export function chooseIntervention(
  m: LearnerModel,
  bug: MisconceptionId,
  itemsSinceStart: number,
): Intervention | null {
  const candidates = INTERVENTIONS.filter((i) => i.for === bug);
  if (!candidates.length) return null;

  const tried = m.interventionLog.filter((l) => l.misconception === bug);
  const failed = new Set(tried.filter((l) => l.outcome === 'worse' || l.outcome === 'same').map((l) => l.intervention));
  const recent = new Set(
    tried
      .filter((l) => itemsSinceStart - (l.at ?? 0) < (INTERVENTIONS.find((i) => i.id === l.intervention)?.cooldownItems ?? 6))
      .map((l) => l.intervention),
  );

  const scored = candidates.map((i) => {
    let score = m.traits.repAffinity[i.representation];
    if (failed.has(i.id)) score -= 1.5;
    if (recent.has(i.id)) score -= 1.0;
    // Slight preference for untried options — exploration is how the graph learns.
    if (!tried.some((l) => l.intervention === i.id)) score += 0.25;
    return { i, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].i;
}

export function logIntervention(
  m: LearnerModel,
  bug: MisconceptionId,
  iv: Intervention,
  at: number,
): LearnerModel {
  const entry = {
    misconception: bug,
    intervention: iv.id,
    representation: iv.representation,
    at,
    outcome: 'pending' as const,
  };
  const st = m.misconceptions[bug];
  const misconceptions = { ...m.misconceptions };
  if (st) {
    misconceptions[bug] = {
      ...st,
      status: 'resolving',
      interventions: [...st.interventions, { id: iv.id, at, outcome: 'pending' }],
    };
  }
  return { ...m, misconceptions, interventionLog: [...m.interventionLog, entry] };
}
