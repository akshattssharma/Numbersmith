import type { Problem } from './types';
import type { World } from './worlds';

/**
 * Dynamic, per-problem hints.
 *
 * The old hint was one fixed line per tone, the same words no matter what
 * was actually on screen — "Ones column, that's all you get" whether the
 * child was adding, subtracting, or building a pile of forty. A hint that
 * doesn't reference the numbers in front of a child isn't really a hint,
 * it's a mood.
 *
 * This generates one from the actual problem — its operation, its operands,
 * whether it needs regrouping — and from how many times the child has
 * already asked (a second click gets more concrete than the first, never
 * the answer itself).
 */
export function generateHint(p: Problem, world: World, level: 1 | 2 = 1): string {
  switch (p.kind) {
    case 'load': return loadHint(p, world, level);
    case 'combine': return combineHint(p, world, level);
    case 'ship': return shipHint(p, world, level);
    case 'groups': return groupsHint(p, world, level);
    case 'catch': return catchHint(level);
  }
}

function loadHint(p: Problem, world: World, level: 1 | 2): string {
  const [unit, bundle] = world.units;
  const tens = Math.floor(p.answer / 10);
  const ones = p.answer % 10;
  if (level === 1) {
    return p.representation === 'manipulative'
      ? `Build the ${bundle}s first, ten at a time — then add whatever ${unit}s are left over.`
      : `Think in tens first: how many whole tens fit inside ${p.answer}?`;
  }
  if (tens === 0) return `It's all loose ${unit}s this time — no bundle needed, just ${ones}.`;
  return `You need ${tens} ${bundle}${tens === 1 ? '' : 's'} of ten, and ${ones} loose ${unit}${ones === 1 ? '' : 's'} left over.`;
}

function combineHint(p: Problem, world: World, level: 1 | 2): string {
  const [unit, bundle] = world.units;
  const big = Math.max(p.a, p.b);
  const small = Math.min(p.a, p.b);
  if (level === 1) {
    return p.representation === 'manipulative'
      ? `Put both piles of ${unit}s together, then turn any ten loose ones into a ${bundle}.`
      : `Start from the bigger number, ${big}, and count up from there.`;
  }
  return `Start at ${big} and count up ${small} more, one at a time if that helps.`;
}

function shipHint(p: Problem, world: World, level: 1 | 2): string {
  const [unit, bundle] = world.units;
  if (level === 1) {
    if (p.regroup) return `You don't have enough loose ${unit}s for this — you'll need to break a ${bundle} open first.`;
    return p.representation === 'manipulative'
      ? `Take away ${unit}s first, then ${bundle}s if you still need to.`
      : `Start at ${p.a} and count backward.`;
  }
  if (p.regroup) return `Break open one ${bundle} into ten loose ${unit}s, then take ${p.b} away.`;
  return `Start at ${p.a} and count back ${p.b}.`;
}

function groupsHint(p: Problem, world: World, level: 1 | 2): string {
  const [unit] = world.units;
  if (level === 1) return `Try counting in groups of ${p.a} ${unit}s — that's ${p.b} jumps in total.`;
  // Shows all but the last jump, so the final total still takes a step of
  // their own — a nudge toward the method, not the answer.
  const shown = Math.max(1, Math.min(p.b - 1, 3));
  const steps = Array.from({ length: shown }, (_, i) => p.a * (i + 1));
  const remaining = p.b - shown;
  const tail = remaining > 0 ? `, ... (${remaining} more jump${remaining === 1 ? '' : 's'} of ${p.a} to go)` : '';
  return `Count by ${p.a}s: ${steps.join(', ')}${tail}.`;
}

function catchHint(level: 1 | 2): string {
  return level === 1
    ? 'Work it out your own way first, then compare it to what they did.'
    : 'Check it one column at a time — ones first, then tens.';
}
