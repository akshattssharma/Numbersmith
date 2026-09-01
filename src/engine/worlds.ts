import type { ChallengeKind, Problem, WorldId } from './types';

/**
 * Three worlds, one mechanic.
 *
 * The temptation is to build three games. That would triple the content cost
 * and, worse, make the intelligence layer un-comparable across children —
 * you could never tell whether a child struggled because of the maths or
 * because of the game. So: one mechanic, reskinned.
 *
 * The mechanic is that a number is always a physical thing you can bundle and
 * unbundle. Ten loose units snap into one bundle; a bundle can be broken back
 * apart. That single affordance *is* place value, carrying and borrowing —
 * a child who carries a ten has physically bundled ten ones, not remembered a
 * mark above a column. Which is why the misconception "forgot to carry" is
 * directly observable here: it looks like twelve loose units sitting in a tray
 * that only holds nine, and the child pressing Done anyway.
 */

export interface World {
  id: WorldId;
  name: string;
  companion: string;
  /** unit / bundle-of-ten / bundle-of-hundred */
  units: [string, string, string];
  palette: { bg: string; ink: string; accent: string; unit: string; bundle: string };
  /** narrative framing per challenge kind */
  frame: Record<ChallengeKind, (p: Problem) => string>;
  /** what a completed run adds to */
  reward: string;
}

export const WORLDS: Record<WorldId, World> = {
  starship: {
    id: 'starship',
    name: 'Ferrywright Station',
    companion: 'Bolt',
    units: ['cell', 'pod', 'crate'],
    palette: { bg: '#0d1526', ink: '#e8eefc', accent: '#5eead4', unit: '#7dd3fc', bundle: '#34d399' },
    reward: 'a longer jump on the star map',
    frame: {
      load: (p) => `The tank takes exactly ${p.answer} cells. Load it.`,
      combine: (p) => `Two shipments docked: ${p.a} cells and ${p.b} cells. Merge them into one hold.`,
      ship: (p) => `The colony needs ${p.b} cells from our ${p.a}. Send them out.`,
      groups: (p) => `${p.b} pods, ${p.a} cells in each. How much fuel is that?`,
      catch: () => `Bolt loaded it already. Something looks off.`,
    },
  },
  grove: {
    id: 'grove',
    name: 'The Hushberry Grove',
    companion: 'Fen',
    units: ['berry', 'basket', 'cart'],
    palette: { bg: '#14210f', ink: '#eef7e6', accent: '#a3e635', unit: '#fca5a5', bundle: '#84cc16' },
    reward: 'a new creature at the water hole',
    frame: {
      load: (p) => `The nest needs exactly ${p.answer} berries. Fill it.`,
      combine: (p) => `You picked ${p.a} berries this morning and ${p.b} after lunch. Put them together.`,
      ship: (p) => `The fledglings eat ${p.b} of your ${p.a} berries. Hand them over.`,
      groups: (p) => `${p.b} nests, ${p.a} berries each. How many berries in all?`,
      catch: () => `Fen counted them out. Have a look before you agree.`,
    },
  },
  vault: {
    id: 'vault',
    name: 'The Quietwater Case',
    companion: 'Marlowe',
    units: ['coin', 'roll', 'case'],
    palette: { bg: '#1a1420', ink: '#f4ecff', accent: '#f0abfc', unit: '#fde68a', bundle: '#c084fc' },
    reward: 'another page of the case file',
    frame: {
      load: (p) => `The ledger says the strongbox held exactly ${p.answer} coins. Rebuild it.`,
      combine: (p) => `Two envelopes: ${p.a} coins and ${p.b} coins. What did the thief take in total?`,
      ship: (p) => `${p.b} coins are missing from ${p.a}. What is left in the box?`,
      groups: (p) => `${p.b} envelopes, ${p.a} coins in each. How much was moved?`,
      catch: () => `Marlowe already tallied it. Check the work.`,
    },
  },
};

export const WORLD_IDS = Object.keys(WORLDS) as WorldId[];

/** Split a quantity into hundreds / tens / ones for the bundle board. */
export function decompose(n: number): { hundreds: number; tens: number; ones: number } {
  return { hundreds: Math.floor(n / 100), tens: Math.floor((n % 100) / 10), ones: n % 10 };
}

export function unitLabel(w: WorldId, place: 0 | 1 | 2, plural = false): string {
  const base = WORLDS[w].units[place];
  return plural ? `${base}s` : base;
}
