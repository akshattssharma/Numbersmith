import { describe, expect, it } from 'vitest';
import { createLearner } from '../learnerModel';
import { makeRng } from '../problemGen';
import { pickFrontier, selectNext } from '../selector';
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
