import { engagementScore, recordEngagement, defaultProfile, type PersonalProfile } from './cast';
import { companionLine, type Line } from './companion';
import { chooseIntervention, logIntervention, type Intervention } from './interventions';
import { createLearner, diagnose, recordAttempt, recordChallengeDoor, recordWorldEngagement } from './learnerModel';
import { generate, makeRng } from './problemGen';
import { selectNext, type Selection } from './selector';
import { derivePolicy, initStruggle, nextDifficulty, observeOutcome, predictSuccess, type StruggleState } from './struggle';
import type { Attempt, ConceptId, Diagnosis, LearnerModel, MisconceptionId, Problem, Representation, WorldId } from './types';
import { intensityForSurface, renderProblem, type RenderedProblem } from './storyTemplates';
import { WORLD_IDS } from './worlds';

/**
 * The learning loop, in one place:
 *
 *     play -> observe -> diagnose -> update the model -> re-derive the policy
 *          -> choose the next thing -> teach if needed -> repeat
 *
 * Everything above this file is a component; this is the loop the MVP has to
 * prove. If this loop works, more content scales it. If it does not, no amount
 * of content saves it.
 */

export interface Turn {
  index: number;
  /** what the controller expected of this item, so the outcome can score it */
  predicted?: number;
  /** the problem as the child actually reads it, with their world woven in */
  rendered?: RenderedProblem;
  selection: Selection;
  line: Line;
  intervention?: Intervention;
  challengeDoorOffered: boolean;
}

export interface TurnResult {
  attempt: Attempt;
  diagnosis: Diagnosis;
  model: LearnerModel;
  line: Line;
}

export class Session {
  model: LearnerModel;
  profile: PersonalProfile;
  struggle: StruggleState = initStruggle();
  rng: () => number;
  /**
   * A second, independent random stream, used only for presentation.
   *
   * Sharing one stream between "which problem is taught next" and "how is it
   * dressed" quietly couples them: adding a personalization feature shifted the
   * draws and changed the actual teaching sequence, which broke two pedagogical
   * tests that had nothing to do with the feature. Presentation must never be
   * able to alter what a child is taught, so it gets its own entropy.
   */
  presentationRng: () => number;
  index = 0;
  /** running mean engagement, the baseline every context is scored against */
  private engagementMean = 0.7;
  private engagementN = 0;
  private pendingBug: MisconceptionId | null = null;
  /** engine-facing trace — powers the Brain view and the divergence demo */
  trace: {
    index: number; concept: string; representation: string; difficulty: number;
    reason: string; rationale: string; correct: boolean; errorClass: string;
    override: string; world: WorldId; tone: string;
  }[] = [];
  /** personalized-vs-control engagement log — proves or disproves the feature */
  contextTrace: { index: number; isControl: boolean; score: number; ids: string[] }[] = [];

  constructor(
    model?: LearnerModel,
    seed = 1234,
    profile?: PersonalProfile,
    struggle?: StruggleState,
    index = 0,
  ) {
    this.model = model ?? createLearner('local', 'Player');
    this.profile = profile ?? defaultProfile();
    this.rng = makeRng(seed);
    this.presentationRng = makeRng(seed ^ 0x5f3a);
    this.struggle = struggle ?? initStruggle();
    this.index = index;
  }

  /**
   * Everything about this child that needs to survive a reload: their model,
   * the struggle controller's running state, their cast/favourites, and where
   * they are in the item sequence. The random streams are deliberately not
   * part of this — they exist to vary what an item looks like, not to encode
   * anything about the child, so re-seeding them fresh each load is a feature
   * (today's session does not open on yesterday's exact numbers).
   */
  exportSave(): { model: LearnerModel; struggle: StruggleState; profile: PersonalProfile; index: number } {
    return { model: this.model, struggle: this.struggle, profile: this.profile, index: this.index };
  }

  /**
   * Render a problem in the child's own world, at the intensity the learner
   * model allows. Kept in one place so no screen can accidentally decorate an
   * item the model wanted plain.
   */
  private render(problem: Problem): RenderedProblem {
    // Calibration items are never personalized beyond a light touch.
    //
    // Item 4 of the opening is the language probe: the same concept on the
    // story surface, there to measure whether unpacking a sentence is what this
    // child finds hard. Dressing it in a friend's name and a favourite fruit
    // makes that sentence longer and more interesting at exactly the moment we
    // are measuring how well they cope with sentences — so the probe would be
    // measuring the decoration. You do not personalize the instrument.
    const cap = this.index < this.calibrationPlan().length
      ? 'light' as const
      : this.model.policy.personalization;
    const intensity = intensityForSurface(cap, problem.representation, problem.kind);
    return renderProblem(problem, this.profile, intensity, this.index, this.presentationRng);
  }

  /**
   * The calibration run. The first six items look like ordinary play but are
   * chosen to measure, not to teach: the same concept is deliberately shown on
   * two different surfaces so the representation delta is measurable inside the
   * first few minutes, and one item is pitched above the child's level to see
   * what they do when something is genuinely too hard.
   *
   * No questionnaire, no "what grade are you in?", no avatar picker. The child
   * thinks they have started playing, because they have.
   */
  calibrationPlan(): { concept: ConceptId; representation: Representation; difficulty: number; probe: string }[] {
    return [
      { concept: 'place-value-2digit', representation: 'manipulative', difficulty: 0.2, probe: 'baseline — is place value there at all' },
      { concept: 'add-within-20', representation: 'manipulative', difficulty: 0.25, probe: 'baseline addition, concrete surface' },
      { concept: 'add-within-20', representation: 'symbolic', difficulty: 0.25, probe: 'SAME concept, written — the notation delta' },
      { concept: 'sub-within-20', representation: 'story', difficulty: 0.3, probe: 'narrative surface — the language delta' },
      { concept: 'add-2digit-carry', representation: 'manipulative', difficulty: 0.62, probe: 'deliberately above level — what do they do when stuck' },
      { concept: 'place-value-2digit', representation: 'symbolic', difficulty: 0.3, probe: 'second notation reading, to confirm the first' },
    ];
  }

  private calibrationTurn(index: number): Turn | null {
    const plan = this.calibrationPlan();
    if (index >= plan.length) return null;
    const step = plan[index];
    const problem = generate({
      concept: step.concept,
      difficulty: step.difficulty,
      representation: step.representation,
      rng: this.rng,
    });
    return {
      index,
      rendered: this.render(problem),
      selection: {
        problem,
        reason: 'frontier',
        concept: step.concept,
        rationale: `Calibration item ${index + 1}/6 — ${step.probe}. To the child this is just the opening of the game; there is no quiz, no grade question and no settings screen.`,
      },
      line: companionLine(this.model, index === 0 ? 'greet' : 'correct'),
      challengeDoorOffered: false,
    };
  }

  nextTurn(): Turn {
    // The first six items are the calibration run. They look like the start of
    // the game because they are the start of the game — the child is playing,
    // and the measuring happens underneath.
    const cal = this.calibrationTurn(this.index);
    if (cal) return cal;

    const hasBug = Object.values(this.model.misconceptions).some((s) => s && s.status !== 'resolved');
    const lastAttempt = this.model.history[this.model.history.length - 1];
    const lastCorrect = lastAttempt ? lastAttempt.correct : null;
    const lastFast = lastAttempt ? lastAttempt.latencyMs < 3500 : false;

    const { decision, state } = nextDifficulty(
      this.model, this.struggle, this.model.policy.representation ? (this.currentConcept()) : 'number-sense',
      lastCorrect, lastFast, hasBug,
    );
    this.struggle = state;
    this.model = { ...this.model, policy: derivePolicy(this.model, decision.difficulty) };

    // Frustration override also changes the *surface*, not just the numbers.
    if (decision.override === 'frustration') {
      const best = (['manipulative', 'symbolic', 'story'] as const)
        .slice().sort((a, b) => this.model.traits.repAffinity[b] - this.model.traits.repAffinity[a])[0];
      this.model = { ...this.model, policy: { ...this.model.policy, representation: best } };
    }

    const recentRepairs = this.trace.slice(-6).filter((t) => t.reason === 'repair-misconception').length;

    const selection = selectNext(this.model, {
      rng: this.rng,
      difficulty: decision.difficulty,
      now: Date.now(),
      itemIndex: this.index,
      forceWin: decision.forceWin,
      allowCatch: true,
      recentRepairs,
    });

    let intervention: Intervention | undefined;
    if (selection.reason === 'repair-misconception' && selection.targetBug) {
      const iv = chooseIntervention(this.model, selection.targetBug, this.index);
      if (iv) {
        intervention = iv;
        this.model = logIntervention(this.model, selection.targetBug, iv, this.index);
        this.pendingBug = selection.targetBug;
      }
    }

    const beat = selection.reason === 'catch-the-mistake' ? 'catch-setup' : this.index === 0 ? 'greet' : 'correct';
    const line = companionLine(this.model, this.index === 0 ? 'greet' : beat === 'catch-setup' ? 'catch-setup' : 'greet');

    return {
      index: this.index,
      predicted: predictSuccess(this.model, selection.problem.concept, selection.problem.difficulty),
      rendered: this.render(selection.problem),
      selection,
      line,
      intervention,
      challengeDoorOffered: decision.offerChallengeDoor,
    };
  }

  submit(turn: Turn, given: number, meta: { latencyMs: number; hintsUsed?: number; churn?: number; abandoned?: boolean }): TurnResult {
    const p = turn.selection.problem;
    // On a 'catch' item the child is asked whether the companion was right;
    // a correct catch means they entered the true answer, not the planted one.
    const correct = given === p.answer;

    const attempt: Attempt = {
      problemId: p.id,
      concept: p.concept,
      representation: p.representation,
      given,
      correct,
      difficulty: p.difficulty,
      latencyMs: meta.latencyMs,
      hintsUsed: meta.hintsUsed ?? 0,
      churn: meta.churn ?? 0,
      abandoned: meta.abandoned ?? false,
      at: Date.now(),
    };

    const diagnosis = diagnose(this.model, p, given, attempt);
    this.model = recordAttempt(this.model, p, attempt, diagnosis);

    // Close the control loop. Without this the controller never finds out that
    // its own success model is optimistic, and quietly parks the child well
    // below the difficulty it believes it has chosen.
    if (turn.predicted !== undefined) {
      this.struggle = observeOutcome(this.struggle, turn.predicted, correct);
    }

    // Close the loop on the intervention we delivered: did it move the bug?
    if (this.pendingBug && turn.intervention) {
      const outcome = correct ? 'better' : diagnosis.misconception === this.pendingBug ? 'same' : 'better';
      const log = [...this.model.interventionLog];
      for (let i = log.length - 1; i >= 0; i--) {
        if (log[i].intervention === turn.intervention.id && log[i].outcome === 'pending') {
          log[i] = { ...log[i], outcome };
          break;
        }
      }
      this.model = { ...this.model, interventionLog: log };
      this.pendingBug = null;
    }

    const beat =
      correct && p.difficulty > 0.6 ? 'correct-hard'
        : correct ? 'correct'
          : diagnosis.errorClass === 'misconception' ? 'wrong-misconception'
            : diagnosis.errorClass === 'careless' ? 'wrong-careless'
              : diagnosis.errorClass === 'notation' ? 'wrong-notation'
                : diagnosis.errorClass === 'language' ? 'wrong-language'
                  : 'wrong-gap';
    const line = companionLine(this.model, beat, { diagnosis });

    this.trace.push({
      index: this.index,
      concept: p.concept,
      representation: p.representation,
      difficulty: Number(p.difficulty.toFixed(2)),
      reason: turn.selection.reason,
      rationale: turn.selection.rationale,
      correct,
      errorClass: diagnosis.errorClass,
      override: 'none',
      world: this.model.policy.world,
      tone: this.model.policy.companionTone,
    });

    // Score the *context* this item was dressed in, separately from whether the
    // child got it right. Contexts are reweighted by engagement only — a
    // favourite that makes a child keener is the point; a favourite that made
    // them look cleverer would just be a biased sample.
    const ids = turn.rendered?.contextIds ?? [];
    const score = engagementScore(attempt, this.medianLatency());
    this.engagementN += 1;
    this.engagementMean += (score - this.engagementMean) / Math.min(this.engagementN, 30);
    if (ids.length) {
      this.profile = recordEngagement(this.profile, ids, score, this.engagementMean, this.index);
    }
    this.contextTrace.push({
      index: this.index,
      isControl: turn.rendered?.isControl ?? true,
      score,
      ids,
    });

    this.index += 1;
    return { attempt, diagnosis, model: this.model, line };
  }

  answerChallengeDoor(tookHarder: boolean) {
    this.model = recordChallengeDoor(this.model, tookHarder);
    if (tookHarder) {
      this.model = { ...this.model, policy: { ...this.model.policy, difficulty: Math.min(0.98, this.model.policy.difficulty + 0.15) } };
    }
  }

  /** Delight signal from play behaviour, used to settle which world fits. */
  observeWorldEngagement(world: WorldId, delight: number) {
    this.model = recordWorldEngagement(this.model, world, delight);
  }

  /**
   * Personalized vs control engagement, for this child specifically.
   *
   * `adequate` is the important field and it is almost always false. A single
   * session yields perhaps five control items, and the effect being looked for
   * is smaller than the item-to-item noise — so a within-session number here
   * is not evidence of anything, however much it looks like a result. Reporting
   * it as though it were is the exact failure this holdout exists to prevent.
   *
   * The honest reads are: pooled across many children, available within days;
   * or per child across many sessions, available in weeks. Both need the data
   * to be logged from the start, which is why the holdout runs from day one.
   */
  personalizationLift(): {
    personalized: number; control: number; n: number;
    perArm: { personalized: number; control: number }; adequate: boolean;
  } | null {
    const pers = this.contextTrace.filter((c) => !c.isControl && c.ids.length);
    const ctrl = this.contextTrace.filter((c) => c.isControl);
    if (pers.length < 4 || ctrl.length < 2) return null;
    const mean = (xs: { score: number }[]) => xs.reduce((s2, x) => s2 + x.score, 0) / xs.length;
    return {
      personalized: mean(pers),
      control: mean(ctrl),
      n: pers.length + ctrl.length,
      perArm: { personalized: pers.length, control: ctrl.length },
      // 30 per arm is the rough floor for an effect this size against this
      // much noise. Below it, the number is a curiosity, not a finding.
      adequate: pers.length >= 30 && ctrl.length >= 30,
    };
  }

  private medianLatency(): number {
    const xs = this.model.history.map((h) => h.latencyMs).sort((a, b) => a - b);
    return xs.length ? xs[Math.floor(xs.length / 2)] : 6000;
  }

  currentConcept(): any {
    const last = this.model.history[this.model.history.length - 1];
    return last ? last.concept : 'place-value-2digit';
  }

  /** Stop when accuracy decays or the child's own stamina estimate is reached. */
  shouldEnd(): boolean {
    return this.index >= this.model.policy.sessionTarget || this.model.traits.frustration > 0.85;
  }
}

export { WORLD_IDS };
