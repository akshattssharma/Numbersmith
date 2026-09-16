import { describe, expect, it } from 'vitest';
import { createLearner } from '../learnerModel';
import { makeRng } from '../problemGen';
import { pickFrontier, selectNext, strongestConcept } from '../selector';
import type { ChallengeKind, ConceptId } from '../types';

/**
 * Two related fixes, found from an empirical run rather than a hunch: a
 * child who's progressing normally could see the same interaction kind
 * (usually 'load' — "build the pile") repeated 20-30+ times in a row,
 * because (a) adjacent concepts in the graph are often the same kind by
 * design, and (b) once every concept was mastered, pickFrontier silently
 * defaulted to the same single concept forever rather than actually having
 * nothing left to say.
 */

describe('selectNext: kind-repetition guard', () => {
  it('switches away from a kind that has run six items in a row, when an alternative exists', () => {
    const m = createLearner('t', 'Test');
    // Pin the frontier to number-sense ('load') via the hysteresis path, so
    // this test isn't at the mercy of pickFrontier's own topo-order choice.
    m.history = [{
      problemId: 'p0', concept: 'number-sense', representation: 'symbolic',
      given: 1, correct: true, difficulty: 0.3, latencyMs: 1000, hintsUsed: 0,
      churn: 0, abandoned: false, at: Date.now(),
    }];
    m.concepts['number-sense'].attempts = 1;
    // Ready enough for counting-on ('combine') to be a real, not-yet-mastered
    // alternative, but still short of mastered so the hysteresis path holds.
    m.concepts['number-sense'].pKnow = 0.65;
    m.concepts['counting-on'].pKnow = 0.3;

    const recentKinds: ChallengeKind[] = ['load', 'load', 'load', 'load', 'load', 'load'];
    const sel = selectNext(m, {
      rng: makeRng(1), difficulty: 0.3, now: Date.now(), itemIndex: 10,
      recentKinds,
    });
    expect(sel.problem.kind).not.toBe('load');
    expect(sel.reason).toBe('vary-kind');
    expect(sel.concept).toBe('counting-on');
  });

  it('leaves selection alone when the streak has not reached the cap', () => {
    const m = createLearner('t', 'Test');
    const recentKinds: ChallengeKind[] = ['load', 'load', 'combine'];
    const sel = selectNext(m, {
      rng: makeRng(1), difficulty: 0.3, now: Date.now(), itemIndex: 3,
      recentKinds,
    });
    expect(sel.reason).not.toBe('vary-kind');
  });

  it('never overrides an urgent tier (a confirmed misconception repair)', () => {
    const m = createLearner('t', 'Test');
    m.misconceptions['sub-smaller-from-larger'] = {
      fires: 3, lastFired: Date.now(), confidence: 0.9, status: 'confirmed', interventions: [],
    };
    const recentKinds: ChallengeKind[] = ['load', 'load', 'load', 'load', 'load', 'load'];
    const sel = selectNext(m, {
      rng: makeRng(1), difficulty: 0.3, now: Date.now(), itemIndex: 10,
      recentKinds,
    });
    expect(sel.reason).toBe('repair-misconception');
  });
});

describe('pickFrontier: after the whole graph is mastered', () => {
  it('rotates by staleness instead of defaulting to the same concept forever', () => {
    const m = createLearner('t', 'Test');
    const ids = Object.keys(m.concepts) as ConceptId[];
    // Master everything, but give one concept a much older lastSeen.
    const now = Date.now();
    ids.forEach((c, i) => {
      m.concepts[c].pKnow = 0.95;
      m.concepts[c].attempts = 5;
      m.concepts[c].lastSeen = now - i * 1000;
    });
    const stalest = ids[ids.length - 1];
    m.concepts[stalest].lastSeen = now - 999_000;

    expect(pickFrontier(m)).toBe(stalest);
  });
});

/**
 * Found by running the five-children simulation, not by inspection: the
 * "designed win" at a quest's end scored 19% real accuracy against an
 * intended ~88%, because its difficulty was inverted from the engine's own
 * *belief* (pKnow) rather than anything about how a child's real success
 * actually falls off with difficulty — and belief rising toward mastery
 * made it pick a *harder* item, exactly backwards. Confirmed-win and
 * quest-win also shared a second bug: strongestConcept() ranked by raw
 * mastery alone, which could crown a concept attempted once and gotten
 * lucky on, or — worse — one drilled hard because of a live misconception,
 * whose capped-but-still-highest score could still win the ranking.
 */
describe('the quest-win designed win: flat difficulty, not belief-scaled', () => {
  it('stays at the same low difficulty whether mastery is barely there or maxed out', () => {
    const low = createLearner('t', 'Test');
    low.concepts['number-sense'].pKnow = 0.6;
    low.concepts['number-sense'].attempts = 5;
    const selLow = selectNext(low, {
      rng: makeRng(1), difficulty: 0.3, now: Date.now(), itemIndex: 20, questWin: true,
    });

    const high = createLearner('t', 'Test');
    high.concepts['number-sense'].pKnow = 0.99;
    high.concepts['number-sense'].attempts = 5;
    const selHigh = selectNext(high, {
      rng: makeRng(1), difficulty: 0.3, now: Date.now(), itemIndex: 20, questWin: true,
    });

    expect(selLow.reason).toBe('quest-win');
    expect(selHigh.reason).toBe('quest-win');
    // The old bug: a near-mastered concept got a *harder* item to hold a
    // constant predicted-success target. Flat difficulty means these match.
    expect(selHigh.problem.difficulty).toBe(selLow.problem.difficulty);
    expect(selHigh.problem.difficulty).toBeLessThan(0.3);
  });
});

describe('strongestConcept: a real champion, not a lucky or bugged one', () => {
  it('prefers a concept attempted enough times over one with higher pKnow but almost no attempts', () => {
    const m = createLearner('t', 'Test');
    m.concepts['number-sense'].pKnow = 0.95;
    m.concepts['number-sense'].attempts = 1; // one lucky guess
    m.concepts['counting-on'].pKnow = 0.75;
    m.concepts['counting-on'].attempts = 8; // genuinely demonstrated

    expect(strongestConcept(m)).toBe('counting-on');
  });

  it('skips a concept with a live misconception even if nothing else has higher mastery', () => {
    const m = createLearner('t', 'Test');
    m.concepts['sub-2digit-borrow'].pKnow = 0.9;
    m.concepts['sub-2digit-borrow'].attempts = 10;
    m.misconceptions['sub-smaller-from-larger'] = {
      fires: 3, lastFired: Date.now(), confidence: 0.9, status: 'suspected', interventions: [],
    };
    m.concepts['counting-on'].pKnow = 0.7;
    m.concepts['counting-on'].attempts = 8;

    expect(strongestConcept(m)).toBe('counting-on');
  });

  it('still returns a concept for a brand-new learner with no attempts anywhere', () => {
    const m = createLearner('t', 'Test');
    expect(() => strongestConcept(m)).not.toThrow();
    expect(typeof strongestConcept(m)).toBe('string');
  });
});
