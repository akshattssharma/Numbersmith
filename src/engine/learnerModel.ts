import { CONCEPTS, ALL_CONCEPTS, prereqChain } from './conceptGraph';
import { matchMisconceptions, MISCONCEPTIONS } from './misconceptions';
import type {
  Attempt, ConceptId, ConceptState, Diagnosis, ErrorClass,
  LearnerModel, MisconceptionId, Problem, Representation, WorldId,
} from './types';

/**
 * The Math Brain.
 *
 * Two things make this more than a scoreboard:
 *
 *  1. It separates *knowledge* (Bayesian knowledge tracing per concept) from
 *     *belief* (a misconception register). A child with a confirmed wrong rule
 *     is not "40% of the way to knowing subtraction" — they are confidently
 *     doing something else, and more practice makes them better at the wrong
 *     thing. So a confirmed misconception clamps mastery rather than averaging
 *     into it. Getting this wrong is how adaptive systems drill children
 *     deeper into their own bugs.
 *
 *  2. It reads *how* the answer arrived, not just what it was. Latency against
 *     operand size separates counting from recall. Speed against correctness
 *     separates carelessness from a gap. Behaviour after failure measures
 *     perseverance. None of this is visible in an accuracy percentage.
 */

const EWMA = (prev: number, x: number, alpha: number) => prev * (1 - alpha) + x * alpha;
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));

function blankConcept(id: ConceptId): ConceptState {
  return {
    pKnow: CONCEPTS[id].bkt.init,
    attempts: 0,
    correct: 0,
    lastSeen: 0,
    byRep: {
      manipulative: { n: 0, correct: 0, totalLatency: 0 },
      symbolic: { n: 0, correct: 0, totalLatency: 0 },
      story: { n: 0, correct: 0, totalLatency: 0 },
    },
  };
}

export function createLearner(id: string, name: string): LearnerModel {
  const concepts = {} as Record<ConceptId, ConceptState>;
  ALL_CONCEPTS.forEach((c) => (concepts[c] = blankConcept(c)));
  return {
    id,
    name,
    createdAt: Date.now(),
    concepts,
    misconceptions: {},
    traits: {
      repAffinity: { manipulative: 0, symbolic: 0, story: 0 },
      latencySlope: 0,
      strategy: 'mixed',
      impulsivity: 0.2,
      perseverance: 0.5,
      hintReliance: 0.2,
      frustration: 0.15,
      confidence: 0.5,
      genreAffinity: { starship: 0, grove: 0, vault: 0 },
      staminaEstimate: 12,
    },
    policy: {
      world: 'starship',
      representation: 'manipulative',
      difficulty: 0.25,
      hintTiming: 'onRequest',
      timePressure: false,
      companionTone: 'coach',
      rewardStyle: 'collection',
      reviewIntervalDays: 2,
      sessionTarget: 10,
    },
    history: [],
    interventionLog: [],
    challengeDoor: { offered: 0, tookHarder: 0 },
  };
}

/* ------------------------------------------------------------------ mastery */

/** Standard BKT posterior + learning step. */
export function bktUpdate(pKnow: number, correct: boolean, c: ConceptId): number {
  const { learn, slip, guess } = CONCEPTS[c].bkt;
  const post = correct
    ? (pKnow * (1 - slip)) / (pKnow * (1 - slip) + (1 - pKnow) * guess)
    : (pKnow * slip) / (pKnow * slip + (1 - pKnow) * (1 - guess));
  return clamp(post + (1 - post) * learn, 0.01, 0.99);
}

/** Mastery, with confirmed misconceptions holding the ceiling down. */
export function mastery(m: LearnerModel, c: ConceptId): number {
  let p = m.concepts[c].pKnow;
  for (const [id, st] of Object.entries(m.misconceptions)) {
    if (!st || st.status === 'resolved') continue;
    if (!bugTouchesConcept(id as MisconceptionId, c)) continue;
    // A confirmed wrong rule caps you below "mastered" no matter the hit rate.
    p = Math.min(p, st.status === 'confirmed' ? 0.45 : 0.7);
  }
  return p;
}

const BUG_CONCEPTS: Record<MisconceptionId, ConceptId[]> = {
  'add-dropped-carry': ['add-2digit-carry', 'place-value-2digit'],
  'add-carry-appended': ['add-2digit-carry', 'place-value-2digit'],
  'add-place-misaligned': ['add-2digit-nocarry', 'place-value-2digit'],
  'sub-smaller-from-larger': ['sub-2digit-borrow'],
  'sub-borrow-not-decremented': ['sub-2digit-borrow'],
  'sub-reversed': ['sub-within-20', 'sub-2digit-noborrow'],
  'count-on-off-by-one': ['counting-on', 'add-within-20'],
  'mult-added-instead': ['equal-groups', 'mult-facts-2-5-10'],
  'mult-one-group-off': ['equal-groups', 'skip-counting'],
  'pv-digits-reversed': ['place-value-2digit'],
};
export const bugConcepts = (b: MisconceptionId) => BUG_CONCEPTS[b];
const bugTouchesConcept = (b: MisconceptionId, c: ConceptId) => BUG_CONCEPTS[b].includes(c);

/** Nearest prerequisite that is itself weak — the thing actually blocking them. */
export function blockingPrereq(m: LearnerModel, c: ConceptId): ConceptId | null {
  for (const p of prereqChain(c)) if (mastery(m, p) < 0.55) return p;
  return null;
}

export function isReady(m: LearnerModel, c: ConceptId): boolean {
  return CONCEPTS[c].prereqs.every((p) => mastery(m, p) >= 0.6);
}

/* ---------------------------------------------------------------- diagnosis */

/** Median latency the child has shown on this concept, for calibration. */
function personalLatency(m: LearnerModel, c: ConceptId): number {
  const xs = m.history.filter((h) => h.concept === c).map((h) => h.latencyMs);
  if (xs.length < 3) {
    const all = m.history.map((h) => h.latencyMs);
    if (!all.length) return 6000;
    return all.sort((x, y) => x - y)[Math.floor(all.length / 2)];
  }
  return xs.sort((x, y) => x - y)[Math.floor(xs.length / 2)];
}

/**
 * Turn one attempt into an explanation. This is the "I understand why you
 * thought that" step, and the order of the checks encodes the priority:
 * a systematic rule beats a speed story, and a cross-representation gap beats
 * a knowledge gap — because "can't read the question" and "can't do the maths"
 * demand completely different responses.
 */
export function diagnose(m: LearnerModel, p: Problem, given: number, a: Attempt): Diagnosis {
  if (a.correct) {
    return { errorClass: 'correct', confidence: 1, reading: 'Solved it.' };
  }

  const med = personalLatency(m, p.concept);
  const fast = a.latencyMs < med * 0.55;
  const slow = a.latencyMs > med * 1.8;

  // 1. Does a known wrong rule predict exactly this answer?
  //
  // Prefer a high-specificity match. A low-specificity bug predicts something
  // a hair off the correct answer, which an ordinary fast slip lands on by
  // chance often enough to matter — so when the only candidate is a weak one
  // and the answer is both fast and adjacent, carelessness is the better
  // explanation. Getting this wrong sends children into repair loops for bugs
  // they do not have, which is the most expensive mistake this file can make.
  const hits = matchMisconceptions(p, given);
  const strong = hits.filter((h) => MISCONCEPTIONS[h].specificity === 'high');
  const chosen = strong[0] ?? hits[0];
  const weakOnly = hits.length > 0 && strong.length === 0;

  if (chosen && !(weakOnly && fast && Math.abs(given - p.answer) <= 2)) {
    const prior = m.misconceptions[chosen]?.fires ?? 0;
    const base = MISCONCEPTIONS[chosen].specificity === 'high' ? 0.45 : 0.25;
    const confidence = clamp(base + prior * 0.2 + (hits.length === 1 ? 0.1 : 0));
    return {
      errorClass: 'misconception',
      misconception: chosen,
      confidence,
      reading: MISCONCEPTIONS[chosen].belief,
    };
  }

  // 2. Same concept, other surface — is this a notation or language problem?
  const st = m.concepts[p.concept];
  const here = st.byRep[p.representation];
  const elsewhere = (['manipulative', 'symbolic', 'story'] as Representation[])
    .filter((r) => r !== p.representation)
    .map((r) => st.byRep[r]);
  const rateHere = here.n >= 3 ? here.correct / here.n : null;
  const nOther = elsewhere.reduce((s, r) => s + r.n, 0);
  const rateOther = nOther >= 3 ? elsewhere.reduce((s, r) => s + r.correct, 0) / nOther : null;

  if (rateHere !== null && rateOther !== null && rateOther - rateHere > 0.35) {
    if (p.representation === 'symbolic') {
      return {
        errorClass: 'notation',
        confidence: clamp(0.5 + (rateOther - rateHere)),
        reading: 'Understands the idea; the written notation is what is in the way.',
      };
    }
    if (p.representation === 'story') {
      return {
        errorClass: 'language',
        confidence: clamp(0.5 + (rateOther - rateHere)),
        reading: 'Can do the maths; unpacking the sentence is what is in the way.',
      };
    }
  }

  // 3. Fought the interface: lots of churn, then a near-miss.
  if (a.churn >= 6 && Math.abs(given - p.answer) <= 2) {
    return {
      errorClass: 'interface',
      confidence: 0.6,
      reading: 'Had the right amount but could not get it entered.',
    };
  }

  // 4. Very fast and far off, with no rule behind it — disengaged, not stuck.
  const far = Math.abs(given - p.answer) > Math.max(5, p.answer * 0.5);
  if (fast && far) {
    return { errorClass: 'guess', confidence: 0.65, reading: 'Answered without engaging with the quantity.' };
  }

  // 5. Fast and off by a hair — a slip, not a gap.
  //
  // This deliberately does not require high estimated mastery. Requiring it
  // creates a trap: the rusher's slips get filed as knowledge gaps, which
  // drags their mastery estimate down, which keeps the mastery gate shut, so
  // the system never notices the rushing and instead concludes the child is
  // weak. They are not weak. They are fast, and the fix is a completely
  // different one.
  if (fast && Math.abs(given - p.answer) <= 2) {
    return { errorClass: 'careless', confidence: 0.7, reading: 'Had it; moved too quickly.' };
  }

  // 6. Worked at it and still missed it — genuinely new territory.
  return {
    errorClass: 'gap',
    confidence: slow ? 0.75 : 0.55,
    reading: 'Has not built this idea yet.',
  };
}

/* ------------------------------------------------------------------ ingest */

export function recordAttempt(m: LearnerModel, p: Problem, a: Attempt, d: Diagnosis): LearnerModel {
  const next: LearnerModel = {
    ...m,
    concepts: { ...m.concepts },
    misconceptions: { ...m.misconceptions },
    traits: { ...m.traits, repAffinity: { ...m.traits.repAffinity }, genreAffinity: { ...m.traits.genreAffinity } },
    history: [...m.history, a],
    interventionLog: [...m.interventionLog],
  };

  const st: ConceptState = {
    ...m.concepts[p.concept],
    byRep: { ...m.concepts[p.concept].byRep },
  };
  st.byRep[p.representation] = {
    n: st.byRep[p.representation].n + 1,
    correct: st.byRep[p.representation].correct + (a.correct ? 1 : 0),
    totalLatency: st.byRep[p.representation].totalLatency + a.latencyMs,
  };
  st.attempts += 1;
  st.correct += a.correct ? 1 : 0;
  st.lastSeen = a.at;

  // Knowledge only moves on evidence about knowledge. A notation failure, a
  // language failure or an interface failure says nothing about whether the
  // child understands the concept, so we do not penalise mastery for them.
  const informsKnowledge = !['notation', 'language', 'interface'].includes(d.errorClass);
  if (informsKnowledge) st.pKnow = bktUpdate(st.pKnow, a.correct, p.concept);
  next.concepts[p.concept] = st;

  // Misconception register
  if (d.errorClass === 'misconception' && d.misconception) {
    const id = d.misconception;
    const cur = next.misconceptions[id] ?? {
      fires: 0, lastFired: 0, confidence: 0, status: 'suspected' as const, interventions: [],
    };
    const fires = cur.fires + 1;
    // One firing is a coincidence. Two is a rule — unless the bug is one whose
    // prediction sits right next to the correct answer, in which case two
    // sightings are still within what chance produces, and we want a third.
    const needed = MISCONCEPTIONS[id].specificity === 'high' ? 2 : 3;
    next.misconceptions[id] = {
      ...cur,
      fires,
      lastFired: a.at,
      confidence: clamp((MISCONCEPTIONS[id].specificity === 'high' ? 0.4 : 0.22) + fires * 0.22),
      status: fires >= needed ? 'confirmed' : 'suspected',
      interventions: cur.interventions,
    };
  }

  // A correct answer on a concept a bug touches is evidence the bug is fading.
  if (a.correct) {
    for (const [id, s] of Object.entries(next.misconceptions)) {
      if (!s || s.status === 'resolved') continue;
      if (!bugTouchesConcept(id as MisconceptionId, p.concept)) continue;
      const conf = s.confidence - 0.3;
      next.misconceptions[id as MisconceptionId] = {
        ...s,
        confidence: Math.max(0, conf),
        status: conf <= 0.05 ? 'resolved' : 'resolving',
      };
      const last = s.interventions[s.interventions.length - 1];
      if (last && last.outcome === 'pending') last.outcome = 'better';
    }
  }

  updateTraits(next, p, a, d);
  return next;
}

/**
 * Probability of success given mastery and item difficulty. Shared with the
 * struggle controller so the model's prediction and the controller's target
 * are the same function — if they drift apart the controller ends up steering
 * against a curve the model does not believe in.
 */
export function expectedSuccess(pKnow: number, difficulty: number): number {
  return 1 / (1 + Math.exp(-(((pKnow - 0.5) * 6) - ((difficulty - 0.5) * 5))));
}

/** Centre a set of per-surface scores on their own mean and blend them in. */
function applyAffinity(
  t: LearnerModel['traits'],
  rates: (number | null)[],
  alpha: number,
  recentre = true,
) {
  const seen = rates.filter((r): r is number => r !== null);
  if (seen.length < 2) return;
  const mean = recentre ? seen.reduce((s, x) => s + x, 0) / seen.length : 0;
  (['manipulative', 'symbolic', 'story'] as Representation[]).forEach((r, i) => {
    const v = rates[i];
    if (v === null) return;
    t.repAffinity[r] = clamp(EWMA(t.repAffinity[r], v - mean, alpha), -1, 1);
  });
}

function updateTraits(m: LearnerModel, p: Problem, a: Attempt, d: Diagnosis) {
  const t = m.traits;

  // Representation affinity — the north-star diagnostic, and the one estimate
  // in this file that is easy to get subtly, invisibly wrong.
  //
  // The naive version compares raw success rate per surface. That is a
  // confound, because the surfaces do not see the same items: the exploration
  // budget serves unfamiliar surfaces at *lower* difficulty, so the surface a
  // child is worst at can come out looking like their strongest. We shipped
  // that version first and it confidently told us the child who freezes on
  // word problems preferred word problems.
  //
  // So compare residuals instead: for each attempt, how did the child do
  // relative to what mastery and difficulty predicted? Averaging that per
  // surface removes the difficulty confound and leaves the thing we actually
  // want — does this surface help this child, holding the maths constant.
  const residuals: Record<Representation, { sum: number; n: number }> = {
    manipulative: { sum: 0, n: 0 }, symbolic: { sum: 0, n: 0 }, story: { sum: 0, n: 0 },
  };
  for (const h of m.history.slice(-40)) {
    const expected = expectedSuccess(m.concepts[h.concept].pKnow, h.difficulty ?? 0.4);
    residuals[h.representation].sum += (h.correct ? 1 : 0) - expected;
    residuals[h.representation].n += 1;
  }
  const rates = (['manipulative', 'symbolic', 'story'] as Representation[]).map((r) =>
    residuals[r].n >= 2 ? residuals[r].sum / residuals[r].n : null,
  );
  applyAffinity(t, rates, 0.35);

  // Latency vs operand size: a steep slope means the child is still counting.
  const magnitude = Math.max(p.a, p.b, 1);
  if (a.correct && magnitude > 0) {
    const perUnit = a.latencyMs / magnitude;
    t.latencySlope = EWMA(t.latencySlope, perUnit, 0.25);
    t.strategy = t.latencySlope > 420 ? 'counting' : t.latencySlope < 180 ? 'retrieval' : 'mixed';
  }

  t.impulsivity = EWMA(t.impulsivity, d.errorClass === 'guess' || d.errorClass === 'careless' ? 1 : 0, 0.2);
  t.hintReliance = EWMA(t.hintReliance, Math.min(1, a.hintsUsed / 2), 0.2);
  t.perseverance = EWMA(t.perseverance, a.abandoned ? 0 : 1, 0.25);

  // Confidence also moves passively. The challenge door is the cleanest read
  // on it, but it is only offered after a miss, so on its own it updates a few
  // times a session — far too slow to steer tone or hint timing. Working
  // unaided on hard items and not abandoning are the same disposition showing
  // up in ordinary play, so they contribute too, at a lower weight.
  const passive = a.correct
    ? (a.hintsUsed === 0 ? 1 : 0.55)
    : (a.abandoned ? 0 : 0.3);
  t.confidence = clamp(EWMA(t.confidence, passive, 0.12));

  // Frustration is a leaky integrator, not a counter. Without the leak it
  // ratchets to the ceiling on a bad run and stays there for the rest of the
  // session, so the game reads a child who has recovered as still drowning and
  // keeps handing them baby problems — which is its own kind of insult.
  // Frustration should fade on its own the way it does in a real child.
  const bump = a.correct ? -0.24 : d.errorClass === 'gap' ? 0.22 : 0.13;
  t.frustration = clamp(t.frustration * 0.88 + bump + 0.02);

  // Stamina: where in the session accuracy starts to fall off.
  const recent = m.history.slice(-20);
  if (recent.length >= 12) {
    const half = Math.floor(recent.length / 2);
    const early = recent.slice(0, half).filter((h) => h.correct).length / half;
    const late = recent.slice(half).filter((h) => h.correct).length / (recent.length - half);
    if (early - late > 0.25) t.staminaEstimate = Math.max(6, t.staminaEstimate - 1);
    else if (late >= early) t.staminaEstimate = Math.min(24, t.staminaEstimate + 0.5);
  }
}

/** Record whether the child chose the harder door after a failure. */
export function recordChallengeDoor(m: LearnerModel, tookHarder: boolean): LearnerModel {
  const t = { ...m.traits };
  t.confidence = clamp(EWMA(t.confidence, tookHarder ? 1 : 0, 0.3));
  return {
    ...m,
    traits: t,
    challengeDoor: {
      offered: m.challengeDoor.offered + 1,
      tookHarder: m.challengeDoor.tookHarder + (tookHarder ? 1 : 0),
    },
  };
}

export function recordWorldEngagement(m: LearnerModel, w: WorldId, delight: number): LearnerModel {
  const g = { ...m.traits.genreAffinity };
  g[w] = clamp(EWMA(g[w], delight, 0.3), -1, 1);
  return { ...m, traits: { ...m.traits, genreAffinity: g } };
}

export const bestRepresentation = (m: LearnerModel): Representation =>
  (['manipulative', 'symbolic', 'story'] as Representation[])
    .sort((a, b) => m.traits.repAffinity[b] - m.traits.repAffinity[a])[0];

export const weakestRepresentation = (m: LearnerModel): Representation =>
  (['manipulative', 'symbolic', 'story'] as Representation[])
    .sort((a, b) => m.traits.repAffinity[a] - m.traits.repAffinity[b])[0];
