import { describe, expect, it } from 'vitest';
import { createLearner } from '../learnerModel';
import { generateInsights } from '../parentInsights';
import { Session } from '../session';
import type { Attempt } from '../types';

/**
 * The Gather board's whole point is a signal a typed answer cannot produce.
 * These tests check the two ends of that wire: session.submit() actually
 * records it on the Attempt, and the parent view actually says something
 * about it — not just that the classifier function works in isolation
 * (dragStrategy.test.ts covers that).
 */

describe('dragStrategy reaches the model', () => {
  it('is recorded on the attempt exactly as passed, and defaults to absent', () => {
    const s = new Session();
    const turn = s.nextTurn();
    const res = s.submit(turn, turn.selection.problem.answer, { latencyMs: 3000, dragStrategy: 'grouped' });
    expect(res.attempt.dragStrategy).toBe('grouped');
    expect(s.model.history[s.model.history.length - 1].dragStrategy).toBe('grouped');
  });

  it('stays undefined for an ordinary item — absence is not a signal', () => {
    const s = new Session();
    const turn = s.nextTurn();
    const res = s.submit(turn, turn.selection.problem.answer, { latencyMs: 3000 });
    expect(res.attempt.dragStrategy).toBeUndefined();
  });
});

describe('parent insight: grouping vs. counting', () => {
  function withDragHistory(pattern: Array<Attempt['dragStrategy']>) {
    const m = createLearner('t', 'Riley');
    m.history = pattern.map((dragStrategy, i): Attempt => ({
      problemId: `p${i}`, concept: 'equal-groups', representation: 'manipulative',
      given: 10, correct: true, difficulty: 0.3, latencyMs: 3000, hintsUsed: 0,
      churn: 0, abandoned: false, at: Date.now(), dragStrategy,
    }));
    return m;
  }

  it('names grouping as a strength when most recent Gather play was grouped', () => {
    const m = withDragHistory(['grouped', 'grouped', 'grouped', 'counted']);
    const insights = generateInsights(m);
    expect(insights.some((i) => i.headline.includes('thinks in groups'))).toBe(true);
  });

  it('flags one-at-a-time counting as something to watch, not a failure', () => {
    const m = withDragHistory(['counted', 'counted', 'counted', 'grouped']);
    const insights = generateInsights(m);
    const found = insights.find((i) => i.headline.includes('counting groups one item at a time'));
    expect(found).toBeTruthy();
    expect(found!.kind).toBe('watch');
  });

  it('says nothing about it with too little Gather play to mean anything', () => {
    const m = withDragHistory(['grouped', 'counted']);
    const insights = generateInsights(m);
    expect(insights.some((i) => i.headline.includes('thinks in groups'))).toBe(false);
    expect(insights.some((i) => i.headline.includes('counting groups one item at a time'))).toBe(false);
  });
});
