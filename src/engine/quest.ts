import { WORLDS } from './worlds';
import type { LearnerModel, WorldId } from './types';

/**
 * The quest layer.
 *
 * The engine already ran a complete tutoring loop — observe, diagnose,
 * adapt, serve the next best item — and that loop has no exit and no shape:
 * "what's the optimal next item" always has an answer, so left alone it
 * serves items until the child stops, with nothing that ever resolves. A
 * quest is the wrapper that gives a run of items a beginning, a stated goal,
 * a meter that visibly moves, and an ending that arrives on purpose.
 *
 * Progress is driven by items completed, never by correctness. A struggling
 * child still fills the meter — effort is what a quest rewards. What
 * correctness buys is depth elsewhere (mastery, the concept graph, what gets
 * taught next); it never decides whether this quest resolves. Punishing a
 * struggling child twice — once on the maths, once on the story — is exactly
 * the failure this exists to avoid.
 */

export interface QuestGoal {
  id: string;
  worldId: WorldId;
  /** child-facing goal line, e.g. "Load 7 fuel cells before the jump" */
  label: string;
  /** what completing it adds — the same line the world already uses */
  reward: string;
  itemsTarget: number;
}

export interface QuestState {
  goal: QuestGoal;
  itemsDone: number;
  correctDone: number;
  concluded: boolean;
  /** closed early by the frustration safety valve rather than reaching itemsTarget */
  endedEarly: boolean;
}

/**
 * How many items make up one quest.
 *
 * Derived from the child's own stamina estimate (`sessionTarget`) so a
 * sitting naturally holds one to three quests — never a lone twenty-item
 * slog, and never a string of one-item "quests" that would cheapen the word.
 * 6-10 items is the target band; the ±1 either side keeps the arithmetic
 * simple rather than chasing an exact fit.
 */
export function questLength(sessionTarget: number): number {
  const questsPerSitting = Math.min(3, Math.max(1, Math.round(sessionTarget / 7)));
  return Math.max(5, Math.min(9, Math.round(sessionTarget / questsPerSitting)));
}

export function startQuest(model: LearnerModel, questNumber: number, rng: () => number): QuestState {
  const worldId = model.policy.world;
  const world = WORLDS[worldId];
  const itemsTarget = questLength(model.policy.sessionTarget);
  return {
    goal: {
      id: `q${questNumber}-${Math.floor(rng() * 1e6)}`,
      worldId,
      label: world.quest(itemsTarget),
      reward: world.reward,
      itemsTarget,
    },
    itemsDone: 0,
    correctDone: 0,
    concluded: false,
    endedEarly: false,
  };
}

/** True when the item about to be served is the quest's last one. */
export function isLastQuestItem(q: QuestState): boolean {
  return !q.concluded && q.itemsDone === q.goal.itemsTarget - 1;
}

export function advanceQuest(
  q: QuestState,
  correct: boolean,
  opts: { forceConclude?: boolean } = {},
): QuestState {
  const itemsDone = q.itemsDone + 1;
  const reachedTarget = itemsDone >= q.goal.itemsTarget;
  const concluded = reachedTarget || !!opts.forceConclude;
  return {
    ...q,
    itemsDone,
    correctDone: q.correctDone + (correct ? 1 : 0),
    concluded,
    endedEarly: q.endedEarly || (!!opts.forceConclude && !reachedTarget),
  };
}
