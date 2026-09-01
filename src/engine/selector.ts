import { ALL_CONCEPTS, CONCEPTS, topoOrder } from './conceptGraph';
import { blockingPrereq, expectedSuccess, isReady, mastery, bugConcepts, bestRepresentation } from './learnerModel';
import { generate, generateDiscriminating } from './problemGen';
import type { ConceptId, LearnerModel, MisconceptionId, Problem, Representation } from './types';

/**
 * What should this child do next?
 *
 * Ordered by what a good tutor would actually do, most urgent first:
 *
 *   1. Resolve a confirmed wrong rule. Everything else is wasted effort while
 *      one is active.
 *   2. Split a tie between two candidate rules — ask the question whose answer
 *      tells you which one it is.
 *   3. Repair the blocking prerequisite. When a child fails at borrowing, the
 *      fault is usually in place value, and drilling borrowing will not touch it.
 *   4. Keep a fading skill alive (spaced review, driven by time and mastery).
 *   5. Move forward into the frontier concept.
 *   6. Probe a neglected surface — periodically test the same concept on the
 *      representation we have least evidence for, so the affinity picture stays
 *      honest rather than self-confirming.
 */

export type Reason =
  | 'repair-misconception'
  | 'disambiguate'
  | 'shore-prerequisite'
  | 'spaced-review'
  | 'frontier'
  | 'probe-representation'
  | 'catch-the-mistake'
  | 'consolidate'
  | 'confidence-win';

export interface Selection {
  problem: Problem;
  reason: Reason;
  concept: ConceptId;
  targetBug?: MisconceptionId;
  /** engine-facing explanation — surfaced in the Brain view, never to the child */
  rationale: string;
}

const DAY = 86400_000;

export function selectNext(
  m: LearnerModel,
  opts: {
    rng: () => number;
    difficulty: number;
    now: number;
    itemIndex: number;
    forceWin?: boolean;
    /** the engine occasionally hands the child a deliberate bug to catch */
    allowCatch?: boolean;
    /** how many of the recent items were already repair items */
    recentRepairs?: number;
  },
): Selection {
  const { rng, now, itemIndex } = opts;
  const difficulty = opts.difficulty;

  // Repair is the highest priority, but it must not become the whole game.
  // A child who spends twenty straight items on the thing they are worst at
  // learns that the game is a place where they fail, and no amount of gentle
  // wording fixes that. So repair gets a duty cycle: at most three of any six
  // items. The rest of the session still moves forward, which is also what
  // gives the repair somewhere to transfer to.
  const repairSaturated = (opts.recentRepairs ?? 0) >= 3;

  const active = (Object.entries(m.misconceptions) as [MisconceptionId, NonNullable<typeof m.misconceptions[MisconceptionId]>][])
    .filter(([, s]) => s && s.status !== 'resolved')
    .sort((a, b) => b[1].confidence - a[1].confidence);

  /* ------- 0. engineered win: rebuild footing after a bad run ------------- */
  if (opts.forceWin) {
    const easy = strongestConcept(m);
    return {
      problem: generate({
        concept: easy,
        // Flat and low, not "a bit below current". A guaranteed win has to be
        // actually guaranteed; scaling it off a difficulty that is already too
        // high just produces another failure with kinder framing.
        difficulty: 0.05,
        representation: bestRepresentation(m),
        rng,
      }),
      reason: 'confidence-win',
      concept: easy,
      rationale:
        'Two misses in a row. Serving something well inside reach on their strongest surface — the point is to restore footing, not to teach.',
    };
  }

  /* ------- 1. confirmed wrong rule -> repair it -------------------------- */
  const confirmed = repairSaturated
    ? undefined
    : active.find(([, s]) => s.status === 'confirmed' || s.status === 'resolving');
  if (confirmed) {
    const [bug] = confirmed;
    const concept = bugConcepts(bug)[0];

    // Catching the companion making *your* mistake is the least threatening way
    // to meet it: the error is someone else's, so there is nothing to defend.
    if (opts.allowCatch && itemIndex % 4 === 3) {
      const p = generate({ concept, difficulty, representation: bestRepresentation(m), rng, plant: bug });
      if (p.plantedBug) {
        return {
          problem: p,
          reason: 'catch-the-mistake',
          concept,
          targetBug: bug,
          rationale: `Companion performs "${bug}" on purpose. Spotting it in someone else is far easier than admitting it in yourself, and a correct catch is strong evidence the rule is shifting.`,
        };
      }
    }

    return {
      problem: generate({ concept, difficulty: Math.min(difficulty, 0.5), representation: bestRepresentation(m), rng }),
      reason: 'repair-misconception',
      concept,
      targetBug: bug,
      rationale: `"${bug}" is confirmed. Working it on their strongest surface until the rule shifts; mastery on this concept stays capped until it does.`,
    };
  }

  /* ------- 2. two candidate rules -> ask a question that splits them ----- */
  const suspected = active.filter(([, s]) => s.status === 'suspected');
  if (suspected.length >= 2) {
    const [a] = suspected[0];
    const [b] = suspected[1];
    const concept = bugConcepts(a)[0];
    return {
      problem: generateDiscriminating(
        { concept, difficulty, representation: m.policy.representation, rng },
        a, b,
      ),
      reason: 'disambiguate',
      concept,
      targetBug: a,
      rationale: `"${a}" and "${b}" both explain the last answer. This item is chosen because the two rules predict different answers on it, so whatever they enter resolves the tie.`,
    };
  }

  /* ------- 3. the prerequisite that is actually blocking them ------------ */
  const frontier = pickFrontier(m);
  const blocked = blockingPrereq(m, frontier);
  if (blocked && mastery(m, blocked) < 0.5) {
    return {
      problem: generate({ concept: blocked, difficulty: Math.min(difficulty, 0.55), representation: m.policy.representation, rng }),
      reason: 'shore-prerequisite',
      concept: blocked,
      rationale: `They are stalling on ${CONCEPTS[frontier].label}, but the missing piece upstream is ${CONCEPTS[blocked].label}. Practising the harder skill would not have touched it.`,
    };
  }

  /* ------- 3.5 exploration budget: never trust a belief you never test ---
     An adaptive system that only ever serves the surface it currently believes
     is best cannot discover that it was wrong — the evidence that would
     correct it is exactly the evidence it stops collecting. That failure is
     silent and it is fatal here, because "she is bad at maths" and "she is
     fine but cannot read the question" look identical from inside a system
     that only ever asks in words.

     So a fixed share of items is spent on the surface we know least about,
     unconditionally, until every surface has real evidence behind it. It costs
     roughly one item in four early on and it is the single most valuable
     spend in the whole loop. */
  const thinnest = (['manipulative', 'symbolic', 'story'] as Representation[])
    .map((r) => ({ r, n: totalOnRep(m, r) }))
    .sort((a, b) => a.n - b.n)[0];

  if (thinnest.n < 6 || (thinnest.n < 12 && rng() < 0.3)) {
    const c = mastery(m, frontier) < 0.3 ? (blockingPrereq(m, frontier) ?? frontier) : frontier;
    return {
      problem: generate({ concept: c, difficulty: Math.max(0.12, difficulty - 0.1), representation: thinnest.r, rng }),
      reason: 'probe-representation',
      concept: c,
      rationale: `Only ${thinnest.n} attempt${thinnest.n === 1 ? '' : 's'} on the ${thinnest.r} surface. Spending an item there deliberately — an affinity estimate built only from the surface we already prefer just confirms itself.`,
    };
  }

  /* ------- 4. spaced review of something going stale --------------------- */
  const stale = ALL_CONCEPTS
    .filter((c) => m.concepts[c].attempts >= 3 && mastery(m, c) > 0.6)
    .map((c) => ({ c, age: (now - m.concepts[c].lastSeen) / DAY }))
    .filter((x) => x.age > m.policy.reviewIntervalDays)
    .sort((a, b) => b.age - a.age)[0];
  if (stale && rng() < 0.3) {
    return {
      problem: generate({ concept: stale.c, difficulty: Math.max(0.2, difficulty - 0.15), representation: m.policy.representation, rng }),
      reason: 'spaced-review',
      concept: stale.c,
      rationale: `${CONCEPTS[stale.c].label} has not been touched in ${stale.age.toFixed(1)} days and is due before it decays.`,
    };
  }

  /* ------- 5. consolidate before advancing -------------------------------
     The move a good tutor makes and an unsupervised difficulty controller
     never does. The frontier concept is by definition the one the child cannot
     yet do, so a session made mostly of frontier items runs at coin-flip
     accuracy no matter how far the difficulty knob is turned down — the knob
     controls how hard the item is, not how unfamiliar the idea is. Turning the
     knob was our first attempt and it did nothing: measured accuracy on
     steered items sat between 13% and 50%.

     The fix is to change *what* is served, not just how hard it is: step back
     to something the child nearly knows and consolidate there. Most of a
     session should be near-mastered material with a few stretches, not a
     continuous assault on the edge of what they can do. */
  const predictedAtFrontier = expectedSuccess(mastery(m, frontier), difficulty);
  if (predictedAtFrontier < 0.7) {
    const consolidation = ALL_CONCEPTS
      .filter((c) => isReady(m, c) && c !== frontier)
      .map((c) => ({ c, p: mastery(m, c) }))
      .filter((x) => x.p >= 0.3 && x.p < 0.9)
      .sort((a, b) => b.p - a.p)[0];

    if (consolidation) {
      return {
        problem: generate({ concept: consolidation.c, difficulty, representation: m.policy.representation, rng }),
        reason: 'consolidate',
        concept: consolidation.c,
        rationale: `${CONCEPTS[frontier].label} would land at roughly ${(predictedAtFrontier * 100).toFixed(0)}% — too far outside reach to build anything. Consolidating ${CONCEPTS[consolidation.c].label} (${(consolidation.p * 100).toFixed(0)}%) instead, which is where the practice actually pays.`,
      };
    }
  }

  /* ------- 6. forward into the frontier ---------------------------------- */
  return {
    problem: generate({ concept: frontier, difficulty, representation: m.policy.representation, rng }),
    reason: 'frontier',
    concept: frontier,
    rationale: `Prerequisites for ${CONCEPTS[frontier].label} are in place and mastery is ${(mastery(m, frontier) * 100).toFixed(0)}%. Pushing forward at difficulty ${difficulty.toFixed(2)}.`,
  };
}

/**
 * The *deepest* concept whose prerequisites are met but which is not yet
 * mastered.
 *
 * Deepest, not shallowest. Taking the first unmastered node in topological
 * order looks safer but is actually a trap: it pins every child to the bottom
 * of the graph until they have ground an early concept to 85%, which is
 * exactly the "everyone gets the same game, slightly slower" failure the whole
 * product exists to avoid. A child whose prerequisites are solid has earned the
 * right to be further along, and letting them run ahead is what makes the
 * strong learner's experience genuinely different rather than merely faster.
 */
export function pickFrontier(m: LearnerModel): ConceptId {
  // Hysteresis first. Recomputing the deepest available concept every single
  // item makes the learner thrash: a couple of right answers open a deeper
  // node, the deeper node is hard, mastery on it dips, and the child ping-pongs
  // across eleven concepts collecting two attempts on each and mastering none.
  // Real tutors stay on a thing. So does this: we only move on once the current
  // concept is either mastered or has had a fair run.
  const last = m.history[m.history.length - 1];
  if (last) {
    const c = last.concept;
    const attempts = m.concepts[c].attempts;
    if (isReady(m, c) && mastery(m, c) < 0.85 && attempts < 6) return c;
  }

  const order = topoOrder();
  let best: ConceptId = order[0];
  for (const c of order) {
    if (!isReady(m, c)) continue;
    if (mastery(m, c) >= 0.85) continue;
    best = c;
  }
  return best;
}

/** Total attempts this child has made on a given surface, across all concepts. */
export function totalOnRep(m: LearnerModel, r: Representation): number {
  return m.history.filter((h) => h.representation === r).length;
}

export function strongestConcept(m: LearnerModel): ConceptId {
  return ALL_CONCEPTS.slice().sort((a, b) => mastery(m, b) - mastery(m, a))[0];
}

/** Concepts the child could start next — used by the parent view and the map. */
export function unlockedFrontier(m: LearnerModel): ConceptId[] {
  return ALL_CONCEPTS.filter((c) => isReady(m, c) && mastery(m, c) < 0.85);
}

export function currentRepresentation(m: LearnerModel, sel: Selection): Representation {
  return sel.problem.representation;
}
