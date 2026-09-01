import { describe, expect, it } from 'vitest';
import { MISCONCEPTIONS, matchMisconceptions } from '../misconceptions';
import type { Problem } from '../types';

const p = (over: Partial<Problem>): Problem => ({
  id: 't', concept: 'add-2digit-carry', kind: 'combine', representation: 'symbolic',
  a: 47, b: 25, answer: 72, difficulty: 0.5, regroup: true, ...over,
});

describe('misconception signatures reproduce the classic bugs', () => {
  it('dropped carry: 47 + 25 -> 62', () => {
    const prob = p({ a: 47, b: 25, answer: 72 });
    expect(MISCONCEPTIONS['add-dropped-carry'].predict(prob)).toBe(62);
    expect(matchMisconceptions(prob, 62)).toContain('add-dropped-carry');
  });

  it('carry appended: 47 + 25 -> 612', () => {
    const prob = p({ a: 47, b: 25, answer: 72 });
    expect(MISCONCEPTIONS['add-carry-appended'].predict(prob)).toBe(612);
  });

  it('smaller-from-larger: 62 - 38 -> 36', () => {
    const prob = p({ concept: 'sub-2digit-borrow', kind: 'ship', a: 62, b: 38, answer: 24 });
    expect(MISCONCEPTIONS['sub-smaller-from-larger'].predict(prob)).toBe(36);
    expect(matchMisconceptions(prob, 36)).toContain('sub-smaller-from-larger');
  });

  it('smaller-from-larger also explains the zero case: 40 - 7 -> 47', () => {
    const prob = p({ concept: 'sub-2digit-borrow', kind: 'ship', a: 40, b: 7, answer: 33 });
    expect(MISCONCEPTIONS['sub-smaller-from-larger'].predict(prob)).toBe(47);
  });

  it('borrow without decrement: 62 - 38 -> 34', () => {
    const prob = p({ concept: 'sub-2digit-borrow', kind: 'ship', a: 62, b: 38, answer: 24 });
    expect(MISCONCEPTIONS['sub-borrow-not-decremented'].predict(prob)).toBe(34);
  });

  it('the two borrow bugs are distinguishable on the same item', () => {
    const prob = p({ concept: 'sub-2digit-borrow', kind: 'ship', a: 62, b: 38, answer: 24 });
    const a = MISCONCEPTIONS['sub-smaller-from-larger'].predict(prob);
    const b = MISCONCEPTIONS['sub-borrow-not-decremented'].predict(prob);
    expect(a).not.toBe(b);
  });

  it('place misalignment only fires on a single-digit second operand', () => {
    expect(MISCONCEPTIONS['add-place-misaligned'].predict(p({ a: 47, b: 5, answer: 52 }))).toBe(97);
    expect(MISCONCEPTIONS['add-place-misaligned'].predict(p({ a: 47, b: 25, answer: 72 }))).toBeNull();
  });

  it('counting on off-by-one: 7 + 5 -> 11', () => {
    const prob = p({ concept: 'add-within-20', a: 7, b: 5, answer: 12, regroup: false });
    expect(MISCONCEPTIONS['count-on-off-by-one'].predict(prob)).toBe(11);
  });

  it('added instead of multiplied: 3 groups of 4 -> 7', () => {
    const prob = p({ concept: 'equal-groups', kind: 'groups', a: 4, b: 3, answer: 12 });
    expect(MISCONCEPTIONS['mult-added-instead'].predict(prob)).toBe(7);
  });

  it('a bug that cannot apply returns null rather than a wrong guess', () => {
    // No carry needed, so the dropped-carry bug is invisible here.
    expect(MISCONCEPTIONS['add-dropped-carry'].predict(p({ a: 42, b: 13, answer: 55, regroup: false }))).toBeNull();
  });

  it('a correct answer never matches any misconception', () => {
    const prob = p({ a: 47, b: 25, answer: 72 });
    expect(matchMisconceptions(prob, 72)).toHaveLength(0);
  });
});
