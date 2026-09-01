import { topoOrder } from './conceptGraph';
import { generateInsights, progressFraming } from './parentInsights';
import { mastery } from './learnerModel';
import { PERSONAS, personaRng, respond, type Persona } from './personas';
import { Session } from './session';
import { derivePolicy } from './struggle';
import type { ConceptId, LearnerModel, MisconceptionId, Representation, WorldId } from './types';
import { WORLD_IDS } from './worlds';

/**
 * Run a persona through the real engine — the same code the playable game
 * uses, with a simulated pair of hands on the other end. Nothing here is
 * scripted: the engine chooses every item, and the persona reacts.
 */

export interface JourneyStep {
  index: number;
  concept: ConceptId;
  representation: Representation;
  difficulty: number;
  reason: string;
  rationale: string;
  correct: boolean;
  errorClass: string;
  world: WorldId;
  tone: string;
  companion: string;
  intervention?: string;
}

export interface Journey {
  persona: Persona;
  steps: JourneyStep[];
  model: LearnerModel;
  summary: {
    world: WorldId;
    representationMix: Record<Representation, number>;
    conceptsTouched: ConceptId[];
    misconceptionsFound: { id: MisconceptionId; fires: number; status: string }[];
    interventions: string[];
    finalDifficulty: number;
    meanDifficulty: number;
    frontierDepth: number;
    tone: string;
    accuracy: number;
    challengeDoor: { offered: number; tookHarder: number };
    timePressure: boolean;
    hintTiming: string;
    sessionTarget: number;
  };
  insights: ReturnType<typeof generateInsights>;
  framing: string;
}

export function runJourney(persona: Persona, turns = 28): Journey {
  const rng = personaRng(persona);
  const s = new Session(undefined, 991);
  s.model = { ...s.model, name: persona.name };

  // The opening shows a glimpse of each world and watches what the child
  // lingers on. No "choose your theme" screen — the choice is inferred from
  // behaviour, which is both faster and more accurate than asking a seven-year
  // old to predict what they will enjoy.
  WORLD_IDS.forEach((w) => s.observeWorldEngagement(w, persona.worldDelight[w]));

  const steps: JourneyStep[] = [];
  let consecutiveFails = 0;

  for (let i = 0; i < turns; i++) {
    const turn = s.nextTurn();
    // An intervention or a catch item is a scaffolded item: the buggy move is
    // not available. Anything else, the child is on their own.
    const scaffolded = Boolean(turn.intervention) || turn.selection.reason === 'catch-the-mistake';
    const r = respond(persona, turn.selection.problem, rng, consecutiveFails, scaffolded);
    const res = s.submit(turn, r.given, {
      latencyMs: r.latencyMs,
      hintsUsed: r.hintsUsed,
      churn: r.churn,
      abandoned: r.abandoned,
    });

    consecutiveFails = res.attempt.correct ? 0 : consecutiveFails + 1;

    if (turn.challengeDoorOffered) {
      s.answerChallengeDoor(rng() < persona.doorBravery);
    }

    steps.push({
      index: i,
      concept: turn.selection.problem.concept,
      representation: turn.selection.problem.representation,
      difficulty: Number(turn.selection.problem.difficulty.toFixed(2)),
      reason: turn.selection.reason,
      rationale: turn.selection.rationale,
      correct: res.attempt.correct,
      errorClass: res.diagnosis.errorClass,
      world: s.model.policy.world,
      tone: s.model.policy.companionTone,
      companion: s.model.policy.world,
      intervention: turn.intervention?.id,
    });
  }

  // Re-derive the policy from the final model. Without this the summary shows
  // the policy chosen *before* the last item was answered, which understates
  // how far the engine had actually moved by the end of the session.
  s.model = { ...s.model, policy: derivePolicy(s.model, s.model.policy.difficulty) };

  const m = s.model;
  const mix: Record<Representation, number> = { manipulative: 0, symbolic: 0, story: 0 };
  steps.forEach((st) => (mix[st.representation] += 1));

  return {
    persona,
    steps,
    model: m,
    summary: {
      world: m.policy.world,
      representationMix: mix,
      conceptsTouched: [...new Set(steps.map((s2) => s2.concept))],
      misconceptionsFound: Object.entries(m.misconceptions)
        .filter(([, v]) => v)
        .map(([id, v]) => ({ id: id as MisconceptionId, fires: v!.fires, status: v!.status })),
      interventions: [...new Set(m.interventionLog.map((l) => l.intervention))],
      finalDifficulty: Number(m.policy.difficulty.toFixed(2)),
      // The honest measures of "how hard was this child pushed". The final
      // difficulty scalar alone is misleading: a strong learner who has just
      // reached a brand-new concept correctly gets easy items on it, and would
      // read as under-challenged when in fact they are further through the
      // graph than anyone else.
      meanDifficulty: Number((steps.reduce((s2, x) => s2 + x.difficulty, 0) / steps.length).toFixed(2)),
      frontierDepth: Math.max(...steps.map((x) => topoOrder().indexOf(x.concept))),
      tone: m.policy.companionTone,
      accuracy: steps.filter((x) => x.correct).length / steps.length,
      challengeDoor: m.challengeDoor,
      timePressure: m.policy.timePressure,
      hintTiming: m.policy.hintTiming,
      sessionTarget: m.policy.sessionTarget,
    },
    insights: generateInsights(m),
    framing: progressFraming(m),
  };
}

export function runAllJourneys(turns = 28): Journey[] {
  return PERSONAS.map((p) => runJourney(p, turns));
}

/**
 * How different did the five journeys actually turn out?
 *
 * This is the number the prototype lives or dies by, so it is computed rather
 * than asserted. A high score with five identical inputs would mean the engine
 * is just noisy; the inputs here differ in designed ways, and the score says
 * whether those differences propagated into the experience.
 */
export function divergenceReport(js: Journey[]) {
  const dims = {
    world: new Set(js.map((j) => j.summary.world)).size,
    dominantRepresentation: new Set(
      js.map((j) => (Object.entries(j.summary.representationMix).sort((a, b) => b[1] - a[1])[0][0])),
    ).size,
    tone: new Set(js.map((j) => j.summary.tone)).size,
    hintTiming: new Set(js.map((j) => j.summary.hintTiming)).size,
    timePressure: new Set(js.map((j) => String(j.summary.timePressure))).size,
    misconceptionProfile: new Set(
      js.map((j) => j.summary.misconceptionsFound.map((x) => x.id).sort().join('|')),
    ).size,
    conceptPath: new Set(js.map((j) => j.summary.conceptsTouched.join('>'))).size,
    difficultyBand: new Set(js.map((j) => Math.round(j.summary.meanDifficulty * 5))).size,
    depth: new Set(js.map((j) => j.summary.frontierDepth)).size,
    // The surface *ranking* the engine learned, not just the one it served
    // most. Two children can end up being served the same surface most often
    // while the engine has learned opposite things about them — Maya is weak
    // on notation, Nia is weak on language — and that difference is what
    // drives the parent insight and the intervention choice.
    affinityOrder: new Set(js.map((j) => affinityOrder(j))).size,
    sessionLength: new Set(js.map((j) => j.summary.sessionTarget)).size,
  };

  // Pairwise: on how many of the ten dimensions does each pair differ?
  const pairs: { a: string; b: string; differing: number }[] = [];
  for (let i = 0; i < js.length; i++) {
    for (let k = i + 1; k < js.length; k++) {
      const A = js[i].summary, B = js[k].summary;
      let n = 0;
      if (A.world !== B.world) n++;
      if (domRep(A.representationMix) !== domRep(B.representationMix)) n++;
      if (A.tone !== B.tone) n++;
      if (A.hintTiming !== B.hintTiming) n++;
      if (A.timePressure !== B.timePressure) n++;
      if (A.misconceptionsFound.map((x) => x.id).sort().join() !== B.misconceptionsFound.map((x) => x.id).sort().join()) n++;
      if (A.conceptsTouched.join() !== B.conceptsTouched.join()) n++;
      if (Math.abs(A.meanDifficulty - B.meanDifficulty) > 0.08) n++;
      if (A.sessionTarget !== B.sessionTarget) n++;
      if (affinityOrder(js[i]) !== affinityOrder(js[k])) n++;
      pairs.push({ a: js[i].persona.name, b: js[k].persona.name, differing: n });
    }
  }

  return {
    dims,
    pairs,
    minPairDifference: Math.min(...pairs.map((p) => p.differing)),
    meanPairDifference: pairs.reduce((s, p) => s + p.differing, 0) / pairs.length,
  };
}

/** The order the engine ranks this child's surfaces in, strongest first. */
export const affinityOrder = (j: Journey) =>
  (['manipulative', 'symbolic', 'story'] as Representation[])
    .slice()
    .sort((a, b) => j.model.traits.repAffinity[b] - j.model.traits.repAffinity[a])
    .join('>');

const domRep = (mix: Record<Representation, number>) =>
  Object.entries(mix).sort((a, b) => b[1] - a[1])[0][0];

export { PERSONAS, mastery };
