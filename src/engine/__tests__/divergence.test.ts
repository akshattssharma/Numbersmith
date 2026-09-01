import { describe, expect, it } from 'vitest';
import { divergenceReport, runAllJourneys, runJourney } from '../simulate';
import { PERSONAS } from '../personas';

/**
 * These are the tests that matter. They assert the product thesis:
 * the same opening produces meaningfully different journeys, for reasons that
 * trace back to how each child actually behaved.
 */

describe('the five-children thesis', () => {
  const journeys = runAllJourneys(30);

  it('every pair of children differs on several dimensions at once', () => {
    const rep = divergenceReport(journeys);
    // Difficulty alone diverging would be table stakes, so this counts ten
    // independent personalization dimensions and requires that EVERY pair
    // differ on at least three of them, not just the average pair.
    //
    // Three, not more, because the honest floor is set by the closest pair:
    // Maya and Nia share enough temperament (similar confidence, neither
    // frustrated, same preferred world) that the engine converges on much of
    // their experience. What it does NOT converge on is what it learned about
    // them — Maya's gap is notation, Nia's is language — which is the
    // difference that drives their interventions and their parents' advice.
    expect(rep.minPairDifference).toBeGreaterThanOrEqual(3);
    expect(rep.meanPairDifference).toBeGreaterThan(5);
  });

  it('reaches an accuracy band well short of the 80% target, and we know why', () => {
    // Recorded rather than aspirational. The controller targets 80% and the
    // simulated children land in the 40-65% range. Two causes, both real:
    // roughly a third of every session is deliberately spent on diagnosis and
    // exploration rather than on items chosen to be winnable, and traits like
    // Riley's carelessness produce failures that no difficulty setting can
    // prevent. This test exists to catch the band SHIFTING, not to claim the
    // target is met.
    journeys.forEach((j) => {
      expect(j.summary.accuracy).toBeGreaterThan(0.3);
      expect(j.summary.accuracy).toBeLessThan(0.8);
    });
  });

  it('children end up in different worlds', () => {
    const worlds = new Set(journeys.map((j) => j.summary.world));
    expect(worlds.size).toBeGreaterThanOrEqual(3);
  });

  it('the companion does not talk to every child the same way', () => {
    const tones = new Set(journeys.map((j) => j.summary.tone));
    expect(tones.size).toBeGreaterThanOrEqual(2);
  });

  it("finds Sam's subtraction bug without being told it exists", () => {
    const sam = journeys.find((j) => j.persona.id === 'sam')!;
    const ids = sam.summary.misconceptionsFound.map((x) => x.id);
    expect(ids).toContain('sub-smaller-from-larger');
    const st = sam.model.misconceptions['sub-smaller-from-larger']!;
    expect(['confirmed', 'resolving', 'resolved']).toContain(st.status);
  });

  it('delivers a targeted intervention to the child who has a wrong rule', () => {
    const sam = journeys.find((j) => j.persona.id === 'sam')!;
    expect(sam.summary.interventions.length).toBeGreaterThan(0);
    // and the intervention chosen is one that exists for the bug he has
    const forHisBug = sam.model.interventionLog.filter((l) => l.misconception === 'sub-smaller-from-larger');
    expect(forHisBug.length).toBeGreaterThan(0);
  });

  it('moves Maya toward the surface she is strong on', () => {
    const maya = journeys.find((j) => j.persona.id === 'maya')!;
    const mix = maya.summary.representationMix;
    expect(mix.manipulative).toBeGreaterThan(mix.symbolic);
  });

  it('detects that Nia is weaker on story than on symbolic', () => {
    const nia = journeys.find((j) => j.persona.id === 'nia')!;
    expect(nia.model.traits.repAffinity.story).toBeLessThan(nia.model.traits.repAffinity.symbolic);
  });

  it('lets Alex run further through the concept graph than Sam', () => {
    const alex = journeys.find((j) => j.persona.id === 'alex')!;
    const sam = journeys.find((j) => j.persona.id === 'sam')!;
    // Depth, not the difficulty scalar. A learner who has just reached a new
    // concept correctly gets easy items on it, so the scalar dips exactly when
    // they are doing best — depth is the measure that means what we want.
    expect(alex.summary.frontierDepth).toBeGreaterThan(sam.summary.frontierDepth);
    expect(alex.summary.conceptsTouched.length).toBeGreaterThan(sam.summary.conceptsTouched.length);
  });

  it('does not put the struggling child and the coasting child on the same path', () => {
    const alex = journeys.find((j) => j.persona.id === 'alex')!;
    const sam = journeys.find((j) => j.persona.id === 'sam')!;
    expect(sam.summary.interventions.length).toBeGreaterThan(alex.summary.interventions.length);
  });

  it('never turns the clock on for a frustrated child', () => {
    journeys.forEach((j) => {
      if (j.model.traits.frustration > 0.5) expect(j.summary.timePressure).toBe(false);
    });
  });

  it('never leaves a child failing most of a session', () => {
    // The floor that matters. Whatever else the controller does, nobody should
    // finish having got the large majority of items wrong.
    journeys.forEach((j) => {
      expect(j.summary.accuracy).toBeGreaterThan(0.3);
    });
  });

  it('produces parent insights that name a behaviour, not a percentage', () => {
    journeys.forEach((j) => {
      expect(j.insights.length).toBeGreaterThanOrEqual(2);
      const activity = j.insights.find((i) => i.kind === 'activity');
      expect(activity).toBeTruthy();
    });
  });

  it('is deterministic — the same persona replays identically', () => {
    const a = runJourney(PERSONAS[0], 20);
    const b = runJourney(PERSONAS[0], 20);
    expect(a.steps.map((s) => `${s.concept}:${s.correct}`)).toEqual(
      b.steps.map((s) => `${s.concept}:${s.correct}`),
    );
  });
});
