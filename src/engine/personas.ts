import { CONCEPTS } from './conceptGraph';
import { MISCONCEPTIONS } from './misconceptions';
import { makeRng } from './problemGen';
import type { ConceptId, MisconceptionId, Problem, Representation, WorldId } from './types';

/**
 * Five simulated children.
 *
 * This exists to answer the one question the prototype has to answer:
 * *give five children the same opening and does the system actually produce
 * five different journeys, for reasons you can point at?*
 *
 * Simulated learners are not a substitute for real ones and they are not
 * evidence that the teaching works. What they are is a regression test for the
 * intelligence layer: a persona with a planted bug must get diagnosed, a
 * persona with a representation gap must get moved onto the surface they are
 * good at, and a bored persona must get pushed. If the engine cannot separate
 * five children whose differences we *designed in*, it will certainly not
 * separate real ones, and we would rather find that out in CI than in a class.
 *
 * Each persona is a response function, not a script: they react to whatever the
 * engine serves. Nobody is following a predetermined path.
 */

export interface Persona {
  id: string;
  name: string;
  blurb: string;
  /** what a teacher would say about them, for the demo write-up */
  teacherNote: string;
  ability: number;                                   // 0..1 general level
  conceptBias: Partial<Record<ConceptId, number>>;    // per-concept offset
  repMultiplier: Record<Representation, number>;      // the representation delta
  bugs: { id: MisconceptionId; rate: number }[];      // wrong rules they actually hold
  baseLatencyMs: number;
  latencyPerUnitMs: number;                           // >400 reads as counting
  carelessRate: number;
  hintRate: number;
  churnRate: number;
  abandonAfterFails: number;
  doorBravery: number;                                // p(take the harder door)
  worldDelight: Record<WorldId, number>;
}

export const PERSONAS: Persona[] = [
  {
    id: 'riley',
    name: 'Riley',
    blurb: 'Fast. Often right. Occasionally right about the wrong thing.',
    teacherNote:
      'Finishes first every time and then gets three wrong that he obviously knows. His book looks worse than he is.',
    ability: 0.72,
    conceptBias: {},
    repMultiplier: { manipulative: 1.0, symbolic: 1.0, story: 0.92 },
    bugs: [],
    baseLatencyMs: 1100,
    latencyPerUnitMs: 35,
    carelessRate: 0.3,
    hintRate: 0.02,
    churnRate: 0.4,
    abandonAfterFails: 6,
    doorBravery: 0.75,
    worldDelight: { starship: 0.8, grove: 0.1, vault: 0.3 },
  },
  {
    id: 'maya',
    name: 'Maya',
    blurb: 'Builds the answer perfectly. Freezes when it is written down.',
    teacherNote:
      'With the blocks out she is one of my strongest. On a worksheet she looks average. I have never been able to explain the gap.',
    ability: 0.68,
    conceptBias: {},
    repMultiplier: { manipulative: 1.25, symbolic: 0.45, story: 0.95 },
    bugs: [],
    baseLatencyMs: 4200,
    latencyPerUnitMs: 180,
    carelessRate: 0.06,
    hintRate: 0.18,
    churnRate: 1.6,
    abandonAfterFails: 4,
    doorBravery: 0.45,
    worldDelight: { starship: 0.2, grove: 0.85, vault: 0.2 },
  },
  {
    id: 'sam',
    name: 'Sam',
    blurb: 'Careful, quiet, and confidently applying a rule that does not work.',
    teacherNote:
      'Very neat work. Always subtracts the small number from the big one, in every column. I have corrected it four times.',
    ability: 0.55,
    conceptBias: { 'sub-2digit-borrow': -0.35, 'place-value-2digit': -0.15 },
    repMultiplier: { manipulative: 1.1, symbolic: 0.85, story: 0.9 },
    bugs: [
      { id: 'sub-smaller-from-larger', rate: 0.85 },
      { id: 'add-dropped-carry', rate: 0.35 },
    ],
    baseLatencyMs: 7200,
    latencyPerUnitMs: 460,
    carelessRate: 0.04,
    hintRate: 0.35,
    churnRate: 0.9,
    abandonAfterFails: 2,
    doorBravery: 0.12,
    worldDelight: { starship: 0.15, grove: 0.4, vault: 0.75 },
  },
  {
    id: 'alex',
    name: 'Alex',
    blurb: 'Has already finished the curriculum and is quietly bored.',
    teacherNote:
      'Gets everything right in about four seconds and then stares out of the window. I am running out of things to give her.',
    ability: 0.92,
    conceptBias: {},
    repMultiplier: { manipulative: 0.95, symbolic: 1.1, story: 1.05 },
    bugs: [],
    baseLatencyMs: 1600,
    latencyPerUnitMs: 40,
    carelessRate: 0.05,
    hintRate: 0.0,
    churnRate: 0.2,
    abandonAfterFails: 8,
    doorBravery: 0.95,
    worldDelight: { starship: 0.4, grove: 0.2, vault: 0.9 },
  },
  {
    id: 'nia',
    name: 'Nia',
    blurb: 'The arithmetic is not the problem. The sentence is.',
    teacherNote:
      'Give her the sum and she is fine. Give her a word problem and she stops. English is her third language.',
    ability: 0.7,
    conceptBias: {},
    repMultiplier: { manipulative: 1.05, symbolic: 1.1, story: 0.38 },
    bugs: [],
    baseLatencyMs: 3000,
    latencyPerUnitMs: 120,
    carelessRate: 0.07,
    hintRate: 0.2,
    churnRate: 0.5,
    abandonAfterFails: 3,
    doorBravery: 0.5,
    worldDelight: { starship: 0.5, grove: 0.7, vault: 0.4 },
  },
];

export interface SimResponse {
  given: number;
  latencyMs: number;
  hintsUsed: number;
  churn: number;
  abandoned: boolean;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function respond(
  persona: Persona,
  p: Problem,
  rng: () => number,
  consecutiveFails: number,
  /**
   * True when the engine has wrapped this item in an intervention scaffold.
   *
   * This flag encodes the most important thing the prototype taught us. A
   * scaffold is not encouragement — it is a change to what the child is
   * physically able to do. The unbundle ritual works because the tray will not
   * let you take eight from two, so the buggy method is not available to
   * choose. An "intervention" that leaves the buggy move available is just
   * another chance to fail, and serving those repeatedly to the child who is
   * already struggling is how well-meant adaptive systems do harm. When we
   * first ran this simulation without the flag, the persona with a real
   * subtraction bug finished at 23% accuracy — the engine had found his
   * problem and then drilled him on it.
   */
  scaffolded = false,
): SimResponse {
  const conceptDifficulty = 1 - CONCEPTS[p.concept].bkt.init;
  const ability = persona.ability + (persona.conceptBias[p.concept] ?? 0);
  let pCorrect = sigmoid((ability - conceptDifficulty * 0.7 - p.difficulty * 0.9) * 4.5);
  pCorrect *= persona.repMultiplier[p.representation];
  if (scaffolded) pCorrect = pCorrect + (1 - pCorrect) * 0.45;
  pCorrect = Math.max(0.02, Math.min(0.98, pCorrect));

  const magnitude = Math.max(p.a, p.b, 1);
  const latency =
    persona.baseLatencyMs +
    persona.latencyPerUnitMs * magnitude * (p.representation === 'story' ? 1.4 : 1) +
    rng() * 800;

  const hintsUsed = rng() < persona.hintRate ? 1 : 0;
  const churn = Math.round(persona.churnRate * (p.representation === 'manipulative' ? 3 : 1) * rng() * 2);
  const abandoned = consecutiveFails >= persona.abandonAfterFails;

  // 1. A wrong rule they actually hold fires before anything else, because a
  //    bug is not a random failure — it is a consistent, confident method.
  for (const b of persona.bugs) {
    const predicted = MISCONCEPTIONS[b.id].predict(p);
    // A scaffold removes the affordance the bug depends on, so it mostly
    // cannot fire — that is what makes it an intervention rather than a hint.
    const rate = scaffolded ? b.rate * 0.2 : b.rate;
    if (predicted !== null && predicted !== p.answer && rng() < rate) {
      return { given: predicted, latencyMs: latency, hintsUsed, churn, abandoned };
    }
  }

  // 2. Otherwise, do they get it right?
  if (rng() < pCorrect) {
    // 3. Even when they know it, a rusher slips.
    if (rng() < persona.carelessRate) {
      const slip = rng() < 0.5 ? 1 : -1;
      return { given: p.answer + slip, latencyMs: latency * 0.55, hintsUsed, churn, abandoned };
    }
    return { given: p.answer, latencyMs: latency, hintsUsed, churn, abandoned };
  }

  // 4. Genuine miss — plausible but clearly off.
  const spread = Math.max(3, Math.round(p.answer * 0.35));
  const delta = Math.max(1, Math.round(rng() * spread));
  return {
    given: Math.max(0, p.answer + (rng() < 0.5 ? delta : -delta)),
    latencyMs: latency * 1.25,
    hintsUsed,
    churn: churn + 1,
    abandoned,
  };
}

export function personaRng(persona: Persona, seed = 7): () => number {
  let h = seed;
  for (const ch of persona.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return makeRng(h);
}
