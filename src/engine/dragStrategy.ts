/**
 * Grouped, or counted one at a time?
 *
 * A typed answer cannot see this. Two children who both enter "15" for
 * "3 nests, 5 berries each" may have gotten there completely differently —
 * one filled a nest, saw it was a nest's worth, and repeated; the other
 * placed fifteen berries one by one, rebuilding the total from units every
 * time. That difference is exactly what separates "has started to think in
 * groups" from "is still counting" on the equal-groups concept, and it is
 * invisible to every surface except one where grouping is a physical act you
 * can actually do or not do.
 *
 * The proxy used here is timing, deliberately consistent with how the rest
 * of the engine already infers strategy from behaviour rather than asking
 * for it (see `latencySlope` in learnerModel.ts): a child filling a group
 * drops several items in a fast burst: they already know how many belong
 * there and are placing them, not deciding one at a time. A child counting
 * places them steadily, a beat apart, because each one is a decision.
 */

export interface DropEvent {
  cellIndex: number;
  at: number;
}

const GROUPED_MS = 350;
const COUNTED_MS = 900;
/** below this many drops, a burst or a lull is as likely to be noise as a strategy */
const MIN_DROPS = 3;

export function classifyDragStrategy(drops: DropEvent[]): 'grouped' | 'counted' | 'mixed' | undefined {
  if (drops.length < MIN_DROPS) return undefined;
  const gaps: number[] = [];
  for (let i = 1; i < drops.length; i++) gaps.push(drops[i].at - drops[i - 1].at);
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  if (mean <= GROUPED_MS) return 'grouped';
  if (mean >= COUNTED_MS) return 'counted';
  return 'mixed';
}
