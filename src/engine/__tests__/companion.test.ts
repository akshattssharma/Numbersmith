import { describe, expect, it } from 'vitest';
import { companionLine } from '../companion';
import { createLearner } from '../learnerModel';

/**
 * The companion used to have a single line pool position shared across every
 * beat, every tone and every child (a module-level counter) — so a bucket's
 * next line depended on how many *other* lines had fired since the page
 * loaded, not on itself. These tests are about the replacement: rotation
 * keyed off the child's own lifetime history, so it's deterministic and
 * actually cycles through a bucket's own lines.
 */

function withHistoryLength(n: number) {
  const m = createLearner('t', 'Test');
  m.history = Array.from({ length: n }, (_, i) => ({
    problemId: `p${i}`, concept: 'number-sense' as const, representation: 'symbolic' as const,
    given: 1, correct: true, difficulty: 0.3, latencyMs: 1000, hintsUsed: 0,
    churn: 0, abandoned: false, at: Date.now(),
  }));
  return m;
}

describe('companionLine rotation', () => {
  it('cycles through more than two distinct lines for a high-frequency beat', () => {
    const seen = new Set<string>();
    for (let n = 0; n < 20; n++) {
      const m = withHistoryLength(n);
      m.policy.companionTone = 'challenger';
      seen.add(companionLine(m, 'correct').text);
    }
    // With 15 lines in the bucket and 20 draws at increasing history length,
    // a real rotation shows well more than the old failure mode's 2.
    expect(seen.size).toBeGreaterThan(5);
  });

  it('is deterministic — the same model state always says the same thing', () => {
    const m = withHistoryLength(7);
    m.policy.companionTone = 'coach';
    const a = companionLine(m, 'greet').text;
    const b = companionLine(m, 'greet').text;
    expect(a).toBe(b);
  });

  it('does not advance two different beats in lockstep', () => {
    // If both buckets were read from the same shared position, a beat with a
    // pool the same length as another would always land on the same index.
    const m = withHistoryLength(3);
    m.policy.companionTone = 'peer';
    const correctLine = companionLine(m, 'correct').text;
    const greetLine = companionLine(m, 'greet').text;
    // Not a strict guarantee for every history length, but true here, and
    // the point is the two beats are keyed independently, not off one shared
    // counter that both would otherwise have advanced together.
    expect(correctLine).not.toBe(greetLine);
  });

  it('never returns an empty or undefined line for any tone on the expanded beats', () => {
    const tones = ['coach', 'peer', 'cheerleader', 'challenger'] as const;
    const beats = ['greet', 'correct', 'correct-hard', 'wrong-gap', 'wrong-careless'] as const;
    for (const tone of tones) {
      for (const beat of beats) {
        const m = withHistoryLength(0);
        m.policy.companionTone = tone;
        const line = companionLine(m, beat);
        expect(line.text).toBeTruthy();
      }
    }
  });
});
