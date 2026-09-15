import { describe, expect, it } from 'vitest';
import { mastery } from '../learnerModel';
import { Session } from '../session';

/**
 * The session used to be a beat-only loop: play -> observe -> diagnose ->
 * serve the next item, forever, with nothing that ever resolved. These tests
 * are about the wrapper around that loop — a quest with a stated goal and a
 * meter that fills honestly, a designed win reserved for its last item, and
 * a sitting that actually ends instead of running until the child gives up.
 *
 * Responses are scripted ("always answer correctly") rather than a simulated
 * persona — the five-children divergence tests already cover realistic
 * behaviour. What's under test here is the shape around the pedagogy, so a
 * deterministic responder that isolates quest/sitting mechanics from the
 * struggle controller's own moment-to-moment choices is the right tool.
 */

function playCorrectly(s: Session, turns: number) {
  for (let i = 0; i < turns; i++) {
    const turn = s.nextTurn();
    s.submit(turn, turn.selection.problem.answer, { latencyMs: 4000 });
  }
}

describe('the sitting: quests with a designed win, ending on purpose', () => {
  it('never lets the meter exceed its own target, and never regresses within one quest', () => {
    const s = new Session();
    let prevDone = -1;
    let prevQuestId: string | null = null;
    for (let i = 0; i < 60; i++) {
      const turn = s.nextTurn();
      s.submit(turn, turn.selection.problem.answer, { latencyMs: 4000 });
      if (!s.quest) continue; // still in calibration — no quest yet
      expect(s.quest.itemsDone).toBeLessThanOrEqual(s.quest.goal.itemsTarget);
      if (s.quest.goal.id === prevQuestId) {
        expect(s.quest.itemsDone).toBeGreaterThan(prevDone);
      }
      prevDone = s.quest.itemsDone;
      prevQuestId = s.quest.goal.id;
    }
  });

  it("resolves a quest's last item as a designed win when nothing is forcing an emotional rescue", () => {
    const s = new Session();
    let sawAQuestWin = false;
    for (let i = 0; i < 40; i++) {
      const turn = s.nextTurn();
      const wasConcluded = s.quest?.concluded ?? false;
      s.submit(turn, turn.selection.problem.answer, { latencyMs: 4000 });
      const justConcluded = !wasConcluded && (s.quest?.concluded ?? false);
      if (justConcluded) {
        expect(turn.selection.reason).toBe('quest-win');
        sawAQuestWin = true;
      }
    }
    expect(sawAQuestWin).toBe(true);
  });

  it('the sitting only ever ends exactly when the quest just played also concluded', () => {
    const s = new Session();
    let sawSittingEnd = false;
    for (let i = 0; i < 80 && !sawSittingEnd; i++) {
      const turn = s.nextTurn();
      s.submit(turn, turn.selection.problem.answer, { latencyMs: 4000 });
      if (s.sittingEnded) {
        expect(s.quest?.concluded).toBe(true);
        sawSittingEnd = true;
      }
    }
    expect(sawSittingEnd).toBe(true);
  });

  it('calibration runs exactly once, ever — not once per sitting', () => {
    const s = new Session();
    let calibrationItems = 0;
    for (let i = 0; i < 6; i++) {
      const turn = s.nextTurn();
      if (turn.selection.rationale.startsWith('Calibration item')) calibrationItems++;
      s.submit(turn, turn.selection.problem.answer, { latencyMs: 4000 });
    }
    expect(calibrationItems).toBe(6);

    // A fresh sitting must not replay it — gating is on lifetime history,
    // not on this sitting's own item count, which beginSitting() resets.
    s.beginSitting();
    const turn = s.nextTurn();
    expect(turn.selection.rationale.startsWith('Calibration item')).toBe(false);
  });

  it('beginSitting resets the sitting but never touches what the child has actually learned', () => {
    const s = new Session();
    playCorrectly(s, 20);
    const modelBefore = s.model;
    expect(s.index).toBeGreaterThan(0);

    s.beginSitting();
    expect(s.index).toBe(0);
    expect(s.quest).toBeNull();
    expect(s.questNumber).toBe(0);
    expect(s.sittingEnded).toBe(false);
    expect(s.model).toBe(modelBefore);
  });

  it('a frustration-forced early conclusion still ends the quest, and marks it as early', () => {
    const s = new Session();
    let sawEarlyEnd = false;
    for (let i = 0; i < 60 && !sawEarlyEnd; i++) {
      const turn = s.nextTurn();
      // Deliberately wrong regardless of the problem — a stress test of the
      // safety valve, not a simulated child.
      s.submit(turn, turn.selection.problem.answer + 1, { latencyMs: 4000 });
      if (s.quest?.endedEarly) sawEarlyEnd = true;
    }
    expect(sawEarlyEnd).toBe(true);
  });

  it('a save/restore round trip carries the quest and sitting state exactly', () => {
    const s = new Session();
    playCorrectly(s, 10);
    const save = s.exportSave();
    const restored = new Session(
      save.model, 555, save.profile, save.struggle,
      save.index, save.quest, save.questNumber, save.sittingEnded,
    );
    expect(restored.index).toBe(s.index);
    expect(restored.questNumber).toBe(s.questNumber);
    expect(restored.quest).toEqual(s.quest);
    expect(restored.sittingEnded).toBe(s.sittingEnded);
  });

  it('never produces a turn with no answer to give — nextTurn always has something to serve', () => {
    // The old failure mode: an infinite, shapeless stream. It should still be
    // infinite in the sense of never crashing or stalling — the fix is that
    // it now has *shape*, signalled via quest/sittingEnded, not that it stops.
    const s = new Session();
    for (let i = 0; i < 120; i++) {
      const turn = s.nextTurn();
      expect(turn.selection.problem).toBeTruthy();
      s.submit(turn, turn.selection.problem.answer, { latencyMs: 4000 });
    }
  });
});

describe('no pre-answer companion line', () => {
  it('a turn never carries a line before it has been answered', () => {
    // There used to be one, and it was a real bug, not a cosmetic one: its
    // beat always resolved to 'correct' for every non-opening item, so
    // Lumie complimented an item the child hadn't attempted yet. The fix
    // wasn't to pick a better beat — it was to remove the pre-answer line
    // entirely. This guards against it quietly coming back.
    const s = new Session();
    for (let i = 0; i < 20; i++) {
      const turn = s.nextTurn();
      expect('line' in turn).toBe(false);
      s.submit(turn, turn.selection.problem.answer, { latencyMs: 3000 });
    }
  });
});

describe('the reward tiers: stars, world collection, mastery/ready transitions', () => {
  it('every correct answer adds one lifetime star, and starsEarned always matches it', () => {
    const s = new Session();
    let expected = 0;
    for (let i = 0; i < 40; i++) {
      const turn = s.nextTurn();
      const res = s.submit(turn, turn.selection.problem.answer, { latencyMs: 4000 });
      expect(res.starsEarned).toBe(1);
      expected += 1;
      expect(s.stars).toBe(expected);
    }
    // Lifetime, not per-sitting — a fresh sitting must not zero it.
    s.beginSitting();
    expect(s.stars).toBe(expected);
  });

  it('a wrong answer earns no star and leaves the lifetime total untouched', () => {
    const s = new Session();
    const turn = s.nextTurn();
    const before = s.stars;
    const res = s.submit(turn, turn.selection.problem.answer + 1, { latencyMs: 4000 });
    expect(res.starsEarned).toBe(0);
    expect(s.stars).toBe(before);
  });

  it('collectionGained fires exactly on the item that concludes a quest, crediting that quest\'s own world', () => {
    const s = new Session();
    let gains = 0;
    for (let i = 0; i < 80; i++) {
      const turn = s.nextTurn();
      const worldInFlight = s.quest?.goal.worldId;
      const res = s.submit(turn, turn.selection.problem.answer, { latencyMs: 4000 });
      if (res.collectionGained) {
        gains += 1;
        expect(res.collectionGained).toBe(worldInFlight);
      }
    }
    expect(gains).toBeGreaterThan(0);
    // Every gain landed somewhere — the collection total matches the gain count exactly.
    const total = Object.values(s.collection).reduce((a, b) => a + b, 0);
    expect(total).toBe(gains);
  });

  it('newlyMastered fires at most once per concept, and only once mastery has actually crossed 0.85', () => {
    const s = new Session();
    const seen = new Set<string>();
    for (let i = 0; i < 150; i++) {
      const turn = s.nextTurn();
      const res = s.submit(turn, turn.selection.problem.answer, { latencyMs: 4000 });
      if (res.newlyMastered) {
        expect(seen.has(res.newlyMastered)).toBe(false);
        seen.add(res.newlyMastered);
        expect(mastery(s.model, res.newlyMastered)).toBeGreaterThanOrEqual(0.85);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it('newlyReady names a concept only at the moment it first becomes reachable', () => {
    const s = new Session();
    const seen = new Set<string>();
    for (let i = 0; i < 150; i++) {
      const turn = s.nextTurn();
      const res = s.submit(turn, turn.selection.problem.answer, { latencyMs: 4000 });
      for (const c of res.newlyReady) {
        expect(seen.has(c)).toBe(false);
        seen.add(c);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it('a save/restore round trip carries stars and the world collection exactly', () => {
    const s = new Session();
    playCorrectly(s, 60);
    const save = s.exportSave();
    expect(save.stars).toBeGreaterThan(0);
    expect(Object.values(save.collection).some((n) => n > 0)).toBe(true);

    const restored = new Session(
      save.model, 555, save.profile, save.struggle,
      save.index, save.quest, save.questNumber, save.sittingEnded,
      save.stars, save.collection,
    );
    expect(restored.stars).toBe(save.stars);
    expect(restored.collection).toEqual(save.collection);
  });

  it('defaults soundOn to true, and a save/restore round trip carries an explicit false through', () => {
    const onByDefault = new Session();
    expect(onByDefault.soundOn).toBe(true);
    expect(onByDefault.exportSave().soundOn).toBe(true);

    const s = new Session();
    s.soundOn = false;
    const save = s.exportSave();
    expect(save.soundOn).toBe(false);

    const restored = new Session(
      save.model, 555, save.profile, save.struggle,
      save.index, save.quest, save.questNumber, save.sittingEnded,
      save.stars, save.collection, save.soundOn,
    );
    expect(restored.soundOn).toBe(false);
  });
});
