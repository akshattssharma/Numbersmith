import { describe, expect, it } from 'vitest';
import { classifyDragStrategy, type DropEvent } from '../dragStrategy';

/**
 * The only signal a typed answer can never produce: how a child physically
 * built an equal-groups total. These tests are about the classifier's own
 * logic — the end-to-end wiring (Play.tsx timestamps drops, session.submit
 * records the result on the Attempt) is covered in session.test.ts.
 */

const seq = (gaps: number[]): DropEvent[] => {
  let at = 1_000_000;
  return gaps.reduce<DropEvent[]>((acc, g, i) => {
    at += i === 0 ? 0 : g;
    acc.push({ cellIndex: 0, at });
    return acc;
  }, []);
};

describe('classifyDragStrategy', () => {
  it('is undecided with too little evidence', () => {
    expect(classifyDragStrategy([])).toBeUndefined();
    expect(classifyDragStrategy(seq([0, 200]))).toBeUndefined(); // only 2 drops
  });

  it('reads a fast burst of drops as grouped', () => {
    const drops = seq([0, 120, 90, 150, 100]); // five drops, all well under 350ms apart
    expect(classifyDragStrategy(drops)).toBe('grouped');
  });

  it('reads steadily-paced, deliberate drops as counted', () => {
    const drops = seq([0, 1200, 1400, 1100, 1500]); // all well over 900ms apart
    expect(classifyDragStrategy(drops)).toBe('counted');
  });

  it('calls anything in between mixed rather than forcing a side', () => {
    const drops = seq([0, 500, 600, 550, 500]); // between the two thresholds
    expect(classifyDragStrategy(drops)).toBe('mixed');
  });

  it('does not care which cells the drops landed in, only their timing', () => {
    const fast: DropEvent[] = [
      { cellIndex: 0, at: 1000 }, { cellIndex: 0, at: 1100 },
      { cellIndex: 1, at: 1200 }, { cellIndex: 2, at: 1300 },
    ];
    expect(classifyDragStrategy(fast)).toBe('grouped');
  });
});
