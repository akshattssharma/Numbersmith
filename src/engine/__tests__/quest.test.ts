import { describe, expect, it } from 'vitest';
import { createLearner } from '../learnerModel';
import { makeRng } from '../problemGen';
import { advanceQuest, isLastQuestItem, questLength, startQuest } from '../quest';

/**
 * The quest layer: the beginning-middle-end wrapper a bare item stream never
 * had. These tests are about the shape, not the pedagogy underneath it —
 * that the meter fills on effort, that a quest actually ends, and that a
 * designed win is reserved for the last item rather than left to chance.
 */

describe('questLength', () => {
  it('stays inside the 5-10 item band across a wide range of stamina estimates', () => {
    for (let target = 5; target <= 30; target++) {
      const n = questLength(target);
      expect(n).toBeGreaterThanOrEqual(5);
      expect(n).toBeLessThanOrEqual(9);
    }
  });

  it('never asks for more items than the sitting itself targets, for a typical child', () => {
    // Not a hard invariant at the extremes (a 5-item sitting still gets a
    // 5-item quest, floor before fit), but for the common case a sitting
    // should hold at least one whole quest without overshooting it by much.
    const n = questLength(12);
    expect(n).toBeLessThanOrEqual(12);
  });
});

describe('startQuest / advanceQuest / isLastQuestItem', () => {
  const rng = makeRng(42);

  it('states a goal with a real target count, tied to the child\'s current world', () => {
    const m = createLearner('t1', 'Test');
    const q = startQuest(m, 1, rng);
    expect(q.goal.worldId).toBe(m.policy.world);
    expect(q.goal.itemsTarget).toBeGreaterThanOrEqual(5);
    expect(q.goal.label).toContain(String(q.goal.itemsTarget));
    expect(q.itemsDone).toBe(0);
    expect(q.concluded).toBe(false);
  });

  it('fills on items completed, not on correctness', () => {
    const m = createLearner('t2', 'Test');
    let q = startQuest(m, 1, rng);
    const target = q.goal.itemsTarget;
    // Every item wrong — the meter still advances, because effort is what a
    // quest measures. Punishing a struggling child twice (the maths AND the
    // story) is exactly the failure this design avoids.
    for (let i = 0; i < target; i++) {
      expect(isLastQuestItem(q)).toBe(i === target - 1);
      q = advanceQuest(q, false);
    }
    expect(q.itemsDone).toBe(target);
    expect(q.correctDone).toBe(0);
    expect(q.concluded).toBe(true);
    expect(q.endedEarly).toBe(false);
  });

  it('never regresses — itemsDone only goes up', () => {
    const m = createLearner('t3', 'Test');
    let q = startQuest(m, 1, rng);
    let last = q.itemsDone;
    for (let i = 0; i < q.goal.itemsTarget; i++) {
      q = advanceQuest(q, i % 2 === 0);
      expect(q.itemsDone).toBeGreaterThan(last);
      last = q.itemsDone;
    }
  });

  it('concludes early, and says so, when forced — the frustration safety valve', () => {
    const m = createLearner('t4', 'Test');
    let q = startQuest(m, 1, rng);
    q = advanceQuest(q, true); // one ordinary item first
    expect(q.concluded).toBe(false);
    q = advanceQuest(q, false, { forceConclude: true });
    expect(q.concluded).toBe(true);
    expect(q.endedEarly).toBe(true);
    expect(q.itemsDone).toBeLessThan(q.goal.itemsTarget);
  });

  it('a forced conclusion that happens to land exactly on the target is not "early"', () => {
    const m = createLearner('t5', 'Test');
    let q = startQuest(m, 1, rng);
    for (let i = 0; i < q.goal.itemsTarget - 1; i++) q = advanceQuest(q, true);
    q = advanceQuest(q, true, { forceConclude: true });
    expect(q.concluded).toBe(true);
    expect(q.endedEarly).toBe(false);
  });
});
