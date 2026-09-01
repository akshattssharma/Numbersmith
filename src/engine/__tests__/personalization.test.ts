import { describe, expect, it } from 'vitest';
import {
  chooseContext, containsCastName, defaultProfile, engagementScore,
  normaliseName, scrubNames, type PersonalProfile,
} from '../cast';
import { CHARACTERS } from '../avatars';
import { intensityForSurface, renderProblem } from '../storyTemplates';
import { derivePolicy } from '../struggle';
import { createLearner } from '../learnerModel';
import { makeRng } from '../problemGen';
import { runAllJourneys } from '../simulate';
import type { Attempt, Problem } from '../types';

const profile = (): PersonalProfile => ({
  ...defaultProfile(),
  cast: [
    { id: 'p_jack', name: 'Jack', relation: 'friend', characterId: 'c03' },
    { id: 'p_amara', name: 'Amara', relation: 'family', characterId: 'c11' },
  ],
  childName: 'Maya',
});

const prob = (over: Partial<Problem> = {}): Problem => ({
  id: 'x', concept: 'add-within-20', kind: 'combine', representation: 'story',
  a: 2, b: 3, answer: 5, difficulty: 0.3, regroup: false, ...over,
});

describe('problem text stays unambiguous', () => {
  const rng = makeRng(5);

  it('subtraction always states who gives and who receives', () => {
    // "Jack takes 3 apples" leaves open whether he took them from this pile or
    // another one. The child then has to guess what happened before they can do
    // any arithmetic, and a wrong guess is logged as a subtraction error.
    for (let i = 0; i < 40; i++) {
      const r = renderProblem(prob({ concept: 'sub-within-20', kind: 'ship', a: 9, b: 4, answer: 5 }), profile(), 'full', i, rng);
      if (r.isControl) continue;
      expect(r.text).toMatch(/You have \d+/);
      expect(r.text).toMatch(/You give/);
      // never a named person as the one holding the answer
      expect(r.text).not.toMatch(/Jack has|Amara has/);
    }
  });

  it('addition names an explicit recipient, never just a bringer', () => {
    for (let i = 0; i < 40; i++) {
      const r = renderProblem(prob(), profile(), 'full', i, rng);
      if (r.isControl || !r.person) continue;
      expect(r.text).toMatch(/gives you/);
    }
  });

  it('keeps a word budget so a story item does not become a reading test', () => {
    for (let i = 0; i < 60; i++) {
      const r = renderProblem(prob({ a: 47, b: 25, answer: 72 }), profile(), 'full', i, rng);
      expect(r.text.trim().split(/\s+/).length).toBeLessThanOrEqual(30);
    }
  });

  it('never counts a place — settings are scenery, not quantities', () => {
    for (let i = 0; i < 60; i++) {
      const r = renderProblem(prob(), profile(), 'full', i, rng);
      expect(r.text).not.toMatch(/\d+ the park|\d+ the beach|\d+ the librar/);
    }
  });
});

describe('personalization is gated by the learner model, not by preference', () => {
  it('switches off for the child whose difficulty is the sentence', () => {
    const m = createLearner('t', 'Nia');
    m.traits.repAffinity = { manipulative: 0.1, symbolic: 0.15, story: -0.3 };
    const policy = derivePolicy(m, 0.4);
    expect(policy.personalization).toBe('off');
  });

  it('switches off for a frustrated child regardless of their story affinity', () => {
    const m = createLearner('t', 'Sam');
    m.traits.repAffinity = { manipulative: 0, symbolic: 0, story: 0.4 };
    m.traits.frustration = 0.7;
    expect(derivePolicy(m, 0.4).personalization).toBe('off');
  });

  it('runs full for a settled child who does well with narrative', () => {
    const m = createLearner('t', 'Alex');
    m.traits.repAffinity = { manipulative: 0, symbolic: 0, story: 0.25 };
    m.traits.frustration = 0.15;
    expect(derivePolicy(m, 0.4).personalization).toBe('full');
  });

  it('never decorates a symbolic item', () => {
    // The point of the symbolic surface is the notation. Dressing it defeats
    // the measurement the surface exists to make.
    expect(intensityForSurface('full', 'symbolic')).toBe('off');
    expect(intensityForSurface('light', 'symbolic')).toBe('off');
  });

  it('keeps manipulative items to a light touch at most', () => {
    expect(intensityForSurface('full', 'manipulative')).toBe('light');
  });

  it('the five-children run reaches at least two different intensities', () => {
    const js = runAllJourneys(30);
    expect(new Set(js.map((j) => j.summary.personalization)).size).toBeGreaterThanOrEqual(2);
  });

  it('turns it off for the persona whose gap is language', () => {
    const nia = runAllJourneys(30).find((j) => j.persona.id === 'nia')!;
    expect(['off', 'light']).toContain(nia.summary.personalization);
  });
});

describe('the control holdout', () => {
  it('keeps the same sentence structure, changing only whose world it is', () => {
    // The control has to differ from the treatment in exactly one variable.
    // An early version dropped controls to bare notation, which meant the
    // comparison was measuring surface *and* personalization at once and could
    // not have answered the question the holdout exists for.
    const rng = makeRng(19);
    const rs = Array.from({ length: 300 }, (_, i) =>
      renderProblem(prob({ concept: 'equal-groups', kind: 'groups', a: 4, b: 3, answer: 12 }), profile(), 'full', i, rng));
    const controls = rs.filter((r) => r.isControl);
    const treated = rs.filter((r) => !r.isControl);
    expect(controls.length).toBeGreaterThan(10);
    controls.forEach((c) => {
      expect(c.text).toMatch(/boxes/);          // same template, not notation
      expect(c.text).toMatch(/your friend/);    // a stand-in, not a name
      expect(c.text).toMatch(/blocks/);         // a neutral noun
    });
    // and comparable in length, or the comparison is about reading load
    const words = (xs: { text: string }[]) =>
      xs.reduce((s2, x) => s2 + x.text.split(/\s+/).length, 0) / xs.length;
    expect(Math.abs(words(controls) - words(treated))).toBeLessThan(3);
  });

  it('never renders bare notation on a prose surface', () => {
    // Personalization 'off' means "not about their world", never "no words".
    // Rendering 13 − 5 on the story surface would silently disable the language
    // probe for exactly the children it was built to identify.
    const rng = makeRng(23);
    for (let i = 0; i < 60; i++) {
      const r = renderProblem(prob({ representation: 'story' }), profile(), 'off', i, rng);
      expect(r.text).toMatch(/[a-z]{3,}/);
      expect(r.text).not.toMatch(/^\d+\s*[+−×]\s*\d+$/);
    }
  });

  it('produces genuinely generic items with no context logged', () => {
    const rng = makeRng(11);
    const rs = Array.from({ length: 200 }, (_, i) => renderProblem(prob(), profile(), 'full', i, rng));
    const controls = rs.filter((r) => r.isControl);
    expect(controls.length).toBeGreaterThan(10);
    controls.forEach((c) => {
      expect(c.contextIds).toHaveLength(0);
      expect(c.person).toBeUndefined();
      expect(containsCastName(c.text, profile())).toBe(false);
    });
  });

  it('reports itself as underpowered within a single session', () => {
    // This is the honest part. One session yields a handful of control items,
    // and the effect is smaller than the item-to-item noise. The number exists
    // to be accumulated, not to be read after one sitting.
    const js = runAllJourneys(36);
    js.forEach((j) => {
      const lift = j.summary.personalizationLift;
      if (lift) expect(lift.adequate).toBe(false);
    });
  });
});

describe('novelty', () => {
  it('does not serve the same context three items running', () => {
    const rng = makeRng(3);
    const p = profile();
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      const picked = chooseContext(p, i, rng, { needCountable: true, wantPerson: false });
      if (picked.item) {
        p.lastUsed[picked.item.id] = i;
        seen.push(picked.item.id);
      }
    }
    for (let i = 2; i < seen.length; i++) {
      expect(seen[i] === seen[i - 1] && seen[i] === seen[i - 2]).toBe(false);
    }
  });
});

describe('engagement is measured without accuracy', () => {
  const base = (over: Partial<Attempt> = {}): Attempt => ({
    problemId: 'x', concept: 'add-within-20', representation: 'story',
    given: 5, correct: true, latencyMs: 4000, hintsUsed: 0, churn: 0,
    abandoned: false, at: 0, ...over,
  });

  it('scores a right and a wrong answer identically when the behaviour matches', () => {
    // If engagement tracked correctness, the game would conclude that apples
    // make a child better at arithmetic, and would bias item selection toward
    // contexts where they already do well — corrupting the mastery estimate
    // the rest of the engine depends on.
    const right = engagementScore(base({ correct: true }), 4000);
    const wrong = engagementScore(base({ correct: false }), 4000);
    expect(right).toBe(wrong);
  });

  it('penalises abandoning, hint-leaning and slow starts', () => {
    const engaged = engagementScore(base(), 4000);
    expect(engagementScore(base({ abandoned: true }), 4000)).toBeLessThan(engaged);
    expect(engagementScore(base({ hintsUsed: 2 }), 4000)).toBeLessThan(engaged);
    expect(engagementScore(base({ latencyMs: 20000 }), 4000)).toBeLessThan(engaged);
  });
});

describe('privacy holds by construction', () => {
  it('strips every cast name before text could reach a model', () => {
    const p = profile();
    const line = 'Tell Jack and Amara that Maya did well today.';
    const out = scrubNames(line, p);
    expect(containsCastName(out, p)).toBe(false);
    expect(out).not.toMatch(/Jack|Amara|Maya/);
  });

  it('accepts a first name only and discards the rest', () => {
    expect(normaliseName('Jack Robinson-Smith')).toBe('Jack');
    expect(normaliseName('  amara  ')).toBe('Amara');
    expect(normaliseName('!!!')).toBe('');
    expect(normaliseName('Bartholomewlongname')).toHaveLength(14);
  });
});

describe('the model can never be handed a real name', () => {
  it('scrubs the payload as part of building it, not as a later step', async () => {
    const { rephraseRequest, companionLine } = await import('../companion');
    const m = createLearner('t', 'Maya');
    const p = profile();
    const line = { ...companionLine(m, 'correct'), text: 'Nice one, Maya — Jack would be impressed.' };
    const req = rephraseRequest(m, line, 'grove', p);
    expect(containsCastName(req.baseline, p)).toBe(false);
  });
});

describe('the character library', () => {
  it('has sixty distinct, stable characters', () => {
    expect(CHARACTERS).toHaveLength(60);
    expect(new Set(CHARACTERS.map((c) => c.id)).size).toBe(60);
    // Two characters that differ only in id would read as the same creature.
    const shapes = CHARACTERS.map((c) => `${c.shape}|${c.ears}|${c.eyes}|${c.mouth}|${c.pattern}|${c.palette[0]}`);
    expect(new Set(shapes).size).toBe(60);
  });

  it('character ids are positional, so a child\'s Jack never changes creature', () => {
    expect(CHARACTERS[0].id).toBe('c00');
    expect(CHARACTERS[59].id).toBe('c59');
  });
});
