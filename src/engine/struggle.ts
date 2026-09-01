import { expectedSuccess, mastery } from './learnerModel';
import type { ConceptId, LearnerModel, Policy } from './types';

/**
 * The productive-struggle controller.
 *
 * The question this answers, every single item, is not "did they get it right"
 * but "is this child struggling in a way that is building something, or in a
 * way that is costing them?"
 *
 * Target success rate is 0.80. That number is not a guess: difficulty at which
 * a learner is right roughly 80–85% of the time is where practice moves the
 * needle fastest, and it is well above the 50% that game designers instinctively
 * reach for. Below ~0.6 children stop attributing failure to the problem and
 * start attributing it to themselves, which is the expensive kind of damage.
 *
 * Two overrides sit on top of the controller, and they matter more than the
 * controller itself:
 *
 *   - Frustration override. When frustration crosses threshold, difficulty is
 *     not merely lowered — the *surface* changes to the child's strongest
 *     representation and the next item is one they will almost certainly get.
 *     Recovering the feeling of competence comes before the next increment.
 *
 *   - Boredom override. Three fast correct answers in a row is not success, it
 *     is a child being under-served. Push, and offer the choice explicitly.
 */

export const TARGET_SUCCESS = 0.8;
const KP = 0.35;   // proportional gain
const KI = 0.06;   // integral gain — corrects slow drift

export interface StruggleState {
  integral: number;
  streakCorrect: number;
  streakWrong: number;
  fastCorrectStreak: number;
  /**
   * Running (predicted − actual) error. The controller steers on its own
   * estimate of how likely the child is to succeed, so if that estimate is
   * biased the controller confidently holds them at the wrong place — and the
   * bias is guaranteed to exist early, because mastery starts at a prior and
   * takes many items to catch up with a real child. Measuring the bias and
   * subtracting it is the difference between a target of 80% and an *achieved*
   * 80%; without it the first version of this ran every simulated child at
   * around 45%, which is squarely in the range where children conclude the
   * problem is them.
   */
  bias: number;
  observations: number;
}

export const initStruggle = (): StruggleState => ({
  integral: 0, streakCorrect: 0, streakWrong: 0, fastCorrectStreak: 0, bias: 0, observations: 0,
});

/** Feed the controller what actually happened, so it can correct its aim. */
export function observeOutcome(
  s: StruggleState,
  predicted: number,
  correct: boolean,
): StruggleState {
  const err = predicted - (correct ? 1 : 0);
  const n = s.observations + 1;
  // Wide window early (learn fast), narrow later (stay stable).
  const alpha = Math.max(0.05, 1 / Math.min(n, 20));
  return { ...s, bias: s.bias * (1 - alpha) + err * alpha, observations: n };
}

/** Predicted probability the child gets an item of this difficulty right. */
export function predictSuccess(m: LearnerModel, c: ConceptId, difficulty: number): number {
  return expectedSuccess(mastery(m, c), difficulty);
}

/** Share of the concept graph this child has demonstrably mastered. */
export function masteredFraction(m: LearnerModel): number {
  const ids = Object.keys(m.concepts) as ConceptId[];
  return ids.filter((c) => mastery(m, c) >= 0.7).length / ids.length;
}

export type Override = 'none' | 'frustration' | 'boredom' | 'misconception-repair';

export interface StruggleDecision {
  difficulty: number;
  override: Override;
  /** offer the two-door choice after this item */
  offerChallengeDoor: boolean;
  /** guarantee a win on the next item */
  forceWin: boolean;
  notes: string;
}

export function nextDifficulty(
  m: LearnerModel,
  s: StruggleState,
  concept: ConceptId,
  lastCorrect: boolean | null,
  lastWasFast: boolean,
  hasActiveMisconception: boolean,
): { decision: StruggleDecision; state: StruggleState } {
  const st: StruggleState = { ...s };

  if (lastCorrect !== null) {
    st.streakCorrect = lastCorrect ? st.streakCorrect + 1 : 0;
    st.streakWrong = lastCorrect ? 0 : st.streakWrong + 1;
    st.fastCorrectStreak = lastCorrect && lastWasFast ? st.fastCorrectStreak + 1 : 0;
  }

  let d = m.policy.difficulty;
  const raw = predictSuccess(m, concept, d);
  const predicted = Math.max(0.02, Math.min(0.98, raw - st.bias));
  const err = predicted - TARGET_SUCCESS;   // positive = too easy
  st.integral = Math.max(-2, Math.min(2, st.integral + err));
  d = d + KP * err + KI * st.integral;

  let override: Override = 'none';
  let forceWin = false;
  let notes = `predicted ${(predicted * 100).toFixed(0)}% vs target ${TARGET_SUCCESS * 100}%`;

  // Repairing a wrong rule takes priority over pacing. There is no point
  // tuning difficulty on a child who is confidently applying the wrong method.
  if (hasActiveMisconception) {
    override = 'misconception-repair';
    d = Math.min(d, 0.45);
    notes = 'holding difficulty low while a wrong rule is being repaired';
  }

  if (m.traits.frustration > 0.62 || st.streakWrong >= 2) {
    override = 'frustration';
    d = Math.max(0.08, d - 0.25);
    forceWin = st.streakWrong >= 2;
    notes = 'frustration high — dropping demand, switching surface, engineering a win';
  } else if (st.fastCorrectStreak >= 3 || m.traits.frustration < 0.12) {
    override = 'boredom';
    d = Math.min(0.98, d + 0.16);
    notes = 'answering fast and correctly — this child is under-served';
  }

  // The challenge door: only ever offered *after* a failure, because the thing
  // worth measuring is whether a child will voluntarily reach for something
  // hard right after something hard went badly. That single behaviour predicts
  // more about a learner than any accuracy figure.
  const offerChallengeDoor =
    lastCorrect === false && st.streakWrong === 1 && m.traits.frustration < 0.7;

  // Floor the difficulty against what the child has already demonstrated.
  //
  // Without this, every time a strong learner reaches a genuinely new concept
  // their mastery on it is low, the controller reads that as "too hard" and
  // resets them to the easiest possible items — so the child who is furthest
  // ahead ends the session on the babyish end of the range. Difficulty should
  // track the learner, not just the current node.
  const demonstrated = masteredFraction(m);
  const floor = 0.05 + 0.45 * demonstrated;

  return {
    decision: {
      difficulty: Math.max(override === 'frustration' ? 0.05 : floor, Math.min(0.98, d)),
      override,
      offerChallengeDoor,
      forceWin,
      notes,
    },
    state: st,
  };
}

/**
 * Recompute the whole personalization policy, not just difficulty. This is the
 * "personalize beyond difficulty" step — genre, surface, tone, hints, pacing
 * and reward style all move independently, which is what makes two children on
 * the same curriculum end up in visibly different games.
 */
export function derivePolicy(m: LearnerModel, difficulty: number): Policy {
  const t = m.traits;

  const world = (Object.entries(t.genreAffinity).sort((a, b) => b[1] - a[1])[0][0]) as Policy['world'];

  const rep = (['manipulative', 'symbolic', 'story'] as const)
    .slice()
    .sort((a, b) => t.repAffinity[b] - t.repAffinity[a])[0];

  // Tone is checked in this order deliberately. A frustrated child needs warmth
  // before anything else, and a child who is rushing needs steadying before
  // they are congratulated — reading "nice!" after your fourth careless slip
  // teaches you that the game is not paying attention.
  const tone: Policy['companionTone'] =
    t.frustration > 0.5 ? 'cheerleader'
      : t.impulsivity > 0.3 ? 'coach'
        : t.confidence > 0.6 && t.frustration < 0.35 ? 'challenger'
          : 'peer';

  const rewardStyle: Policy['rewardStyle'] =
    t.confidence > 0.7 ? 'mastery'
      : t.repAffinity.story > 0.15 ? 'narrative'
        : t.strategy === 'retrieval' && t.impulsivity < 0.3 ? 'speed'
          : 'collection';

  return {
    world,
    representation: rep,
    difficulty,
    // Anxious learners get help before they ask; confident ones get to struggle.
    hintTiming: t.frustration > 0.5 ? 'early' : t.confidence > 0.65 ? 'late' : 'onRequest',
    // Timing pressure is opt-in by behaviour, never by default. It is the
    // fastest way to convert a nervous child into a child who hates maths.
    timePressure: t.confidence > 0.72 && t.impulsivity < 0.35 && t.frustration < 0.25,
    companionTone: tone,
    rewardStyle,
    // Personalization intensity, derived from what the model knows about how
    // this child copes with language.
    //
    // The obvious implementation is "on for everyone, because kids like seeing
    // their friends' names". That is wrong for a specific and predictable
    // child: the one whose story-surface performance trails their symbolic
    // performance is telling us that unpacking a sentence is the hard part, and
    // the response to that is a shorter sentence, not a warmer one. Dressing
    // their problems in more narrative is a kindness that costs them accuracy.
    //
    // Frustration pulls it down for everyone, on the same logic — a child near
    // the end of their patience does not want more to read.
    // Thresholds set so the *neutral* child gets the full treatment. The first
    // version required a positive story signal before naming anyone, which
    // meant almost every child sat at 'light' forever and the feature never
    // actually appeared — an over-cautious prior that silently disabled the
    // thing it was guarding. The right prior is: help most children, and back
    // off only on evidence that this particular child is worse off for it.
    personalization:
      t.frustration > 0.55 || t.repAffinity.story < -0.12 ? 'off'
        : t.repAffinity.story < -0.04 || t.frustration > 0.35 ? 'light'
          : 'full',
    reviewIntervalDays: t.strategy === 'retrieval' ? 4 : 2,
    sessionTarget: Math.round(t.staminaEstimate),
  };
}
