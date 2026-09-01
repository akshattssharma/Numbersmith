/**
 * Numbersmith — core type definitions.
 *
 * Design note: everything the engine needs to make a decision lives in the
 * LearnerModel. The UI is a renderer for whatever the engine decides. That
 * separation is what makes the product AI-native rather than "a game with a
 * chatbot bolted on" — swap the renderer and the intelligence still holds.
 */

export type ConceptId =
  | 'number-sense'
  | 'counting-on'
  | 'number-bonds-10'
  | 'place-value-2digit'
  | 'add-within-20'
  | 'add-2digit-nocarry'
  | 'add-2digit-carry'
  | 'sub-within-20'
  | 'sub-2digit-noborrow'
  | 'sub-2digit-borrow'
  | 'skip-counting'
  | 'equal-groups'
  | 'arrays'
  | 'mult-facts-2-5-10';

/**
 * The three surfaces a single concept can be presented on. Measuring the
 * accuracy delta BETWEEN these on the SAME concept is the north-star
 * diagnostic: it is how the system learns "understands the idea, struggles
 * with the notation" instead of just "bad at subtraction".
 */
export type Representation = 'manipulative' | 'symbolic' | 'story';

export type WorldId = 'starship' | 'grove' | 'vault';

export type ChallengeKind =
  | 'load'          // compose a target quantity          -> place value
  | 'combine'       // merge two quantities               -> addition (+ regrouping)
  | 'ship'          // remove a quantity                  -> subtraction (+ unbundling)
  | 'groups'        // fill N containers with M each      -> multiplication foundations
  | 'catch';        // companion solves it wrong on purpose -> error detection

export type MisconceptionId =
  | 'add-dropped-carry'
  | 'add-carry-appended'
  | 'add-place-misaligned'
  | 'sub-smaller-from-larger'
  | 'sub-borrow-not-decremented'
  | 'sub-reversed'
  | 'count-on-off-by-one'
  | 'mult-added-instead'
  | 'mult-one-group-off'
  | 'pv-digits-reversed';

/** What kind of wrong this was. "Wrong" is not a diagnosis. */
export type ErrorClass =
  | 'correct'
  | 'careless'      // knows it, went too fast
  | 'guess'         // no engagement with the quantity
  | 'gap'           // hasn't learned it yet
  | 'misconception' // has learned a *wrong rule* — the expensive one
  | 'notation'      // fine on manipulative, fails on symbolic
  | 'language'      // fine on symbolic, fails on story
  | 'interface';    // knew the answer, fought the UI

export interface Problem {
  id: string;
  concept: ConceptId;
  kind: ChallengeKind;
  representation: Representation;
  /** operands, meaning depends on kind */
  a: number;
  b: number;
  answer: number;
  /** difficulty this item was generated at, 0..1 */
  difficulty: number;
  /** requires regrouping (carry/borrow) */
  regroup: boolean;
  /** for 'catch' items: the misconception the companion deliberately performs */
  plantedBug?: MisconceptionId;
  plantedAnswer?: number;
}

export interface Attempt {
  problemId: string;
  concept: ConceptId;
  representation: Representation;
  given: number;
  correct: boolean;
  /** difficulty the item was generated at — needed to de-confound the
   *  representation-affinity estimate, which compares residuals rather than
   *  raw success rates. Optional so older logs still load. */
  difficulty?: number;
  latencyMs: number;
  hintsUsed: number;
  /** UI churn: drags/undos/resets — high churn + right answer = interface friction */
  churn: number;
  abandoned: boolean;
  at: number;
}

export interface Diagnosis {
  errorClass: ErrorClass;
  misconception?: MisconceptionId;
  /** 0..1 — how sure we are. One firing is a hypothesis, three is a finding. */
  confidence: number;
  /** plain-language, child-safe, never "you are wrong" */
  reading: string;
}

export interface ConceptState {
  pKnow: number;
  attempts: number;
  correct: number;
  lastSeen: number;
  byRep: Record<Representation, { n: number; correct: number; totalLatency: number }>;
}

export interface MisconceptionState {
  fires: number;
  lastFired: number;
  confidence: number;
  status: 'suspected' | 'confirmed' | 'resolving' | 'resolved';
  interventions: { id: string; at: number; outcome: 'pending' | 'better' | 'same' | 'worse' }[];
}

export interface Traits {
  /** relative advantage per surface, -1..1, centred on 0 */
  repAffinity: Record<Representation, number>;
  /** ms of extra latency per unit of operand size — high slope = counting, flat = retrieval */
  latencySlope: number;
  strategy: 'counting' | 'mixed' | 'retrieval';
  impulsivity: number;   // 0..1 fast-and-wrong rate
  perseverance: number;  // 0..1 retries after failure vs abandons
  hintReliance: number;  // 0..1
  frustration: number;   // 0..1 EWMA — the safety valve
  confidence: number;    // 0..1 willingness to take the harder door
  genreAffinity: Record<WorldId, number>;
  /** problems before accuracy decays — drives session length */
  staminaEstimate: number;
}

/** The *derived* personalization. This is what the game actually reads. */
export interface Policy {
  world: WorldId;
  representation: Representation;
  difficulty: number;        // 0..1
  hintTiming: 'early' | 'onRequest' | 'late';
  timePressure: boolean;
  companionTone: 'coach' | 'peer' | 'cheerleader' | 'challenger';
  rewardStyle: 'collection' | 'mastery' | 'narrative' | 'speed';
  reviewIntervalDays: number;
  sessionTarget: number;
}

export interface LearnerModel {
  id: string;
  name: string;
  createdAt: number;
  concepts: Record<ConceptId, ConceptState>;
  misconceptions: Partial<Record<MisconceptionId, MisconceptionState>>;
  traits: Traits;
  policy: Policy;
  history: Attempt[];
  /** every (misconception, intervention, outcome) tuple — the moat, logged from day one */
  interventionLog: {
    misconception: MisconceptionId;
    intervention: string;
    representation: Representation;
    at: number;
    outcome: 'pending' | 'better' | 'same' | 'worse';
  }[];
  /** north-star metric instrumentation */
  challengeDoor: { offered: number; tookHarder: number };
}
