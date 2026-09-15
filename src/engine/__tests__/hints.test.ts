import { describe, expect, it } from 'vitest';
import { generateHint } from '../hints';
import { WORLDS } from '../worlds';
import type { Problem } from '../types';

/**
 * The old hint was one fixed line, the same words regardless of the problem
 * on screen. These tests check the replacement actually varies with the
 * problem in front of the child, gets more specific on a second ask, and —
 * for equal-groups — never just states the final total.
 */

const base: Problem = {
  id: 'p1', concept: 'add-2digit-carry', kind: 'combine', representation: 'symbolic',
  a: 27, b: 15, answer: 42, difficulty: 0.5, regroup: false,
};

describe('generateHint', () => {
  it('references the actual operands, not a generic line', () => {
    const hint = generateHint(base, WORLDS.starship, 1);
    expect(hint).toContain('27');
  });

  it('changes when the operands change', () => {
    const a = generateHint(base, WORLDS.starship, 1);
    const b = generateHint({ ...base, a: 8, b: 3, answer: 11 }, WORLDS.starship, 1);
    expect(a).not.toBe(b);
  });

  it('gets more specific on the second ask without repeating the first', () => {
    const first = generateHint(base, WORLDS.starship, 1);
    const second = generateHint(base, WORLDS.starship, 2);
    expect(second).not.toBe(first);
  });

  it('a "ship" item that needs borrowing says so explicitly', () => {
    const p: Problem = { ...base, kind: 'ship', a: 32, b: 15, answer: 17, regroup: true };
    const hint = generateHint(p, WORLDS.starship, 1);
    expect(hint.toLowerCase()).toMatch(/break|bundle/);
  });

  it('a "load" item at level 2 states the actual tens/ones split', () => {
    const p: Problem = { ...base, kind: 'load', a: 0, b: 0, answer: 34, regroup: false };
    const hint = generateHint(p, WORLDS.starship, 2);
    expect(hint).toContain('3');
    expect(hint).toContain('4');
  });

  it('an equal-groups hint never states the final total outright', () => {
    const p: Problem = { ...base, kind: 'groups', a: 4, b: 3, answer: 12, regroup: false };
    const level1 = generateHint(p, WORLDS.starship, 1);
    const level2 = generateHint(p, WORLDS.starship, 2);
    expect(level1).not.toContain('12');
    expect(level2).not.toContain('12');
  });

  it('varies its wording across worlds via the world\'s own unit names', () => {
    const p: Problem = { ...base, kind: 'load', representation: 'manipulative', answer: 23 };
    const starship = generateHint(p, WORLDS.starship, 1);
    const grove = generateHint(p, WORLDS.grove, 1);
    expect(starship).not.toBe(grove);
  });
});
