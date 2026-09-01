import { CONCEPTS } from './conceptGraph';
import { mastery, bugConcepts } from './learnerModel';
import { MISCONCEPTIONS } from './misconceptions';
import { unlockedFrontier, pickFrontier } from './selector';
import type { LearnerModel, MisconceptionId, Representation } from './types';

/**
 * The parent product.
 *
 * A parent cannot act on "Accuracy: 73%". They can act on "she has the idea but
 * is subtracting the smaller digit from the larger one — here is a thing to do
 * at the shop this week." So the rule for this file is: every insight names a
 * behaviour, not a number, and at least one of them is something the parent can
 * do away from the screen.
 *
 * The second rule is restraint. Three insights, not twelve. A parent who opens
 * a dashboard and sees a wall closes it and never comes back, and a parent who
 * does not open it is a parent who cancels.
 */

export interface Insight {
  kind: 'strength' | 'watch' | 'change' | 'progress' | 'activity';
  headline: string;
  body: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function generateInsights(m: LearnerModel): Insight[] {
  const out: Insight[] = [];
  const name = m.name;

  /* --- what changed this week: the thing parents actually want ---------- */
  const gained = Object.entries(m.concepts)
    .filter(([c, s]) => s.attempts >= 3 && mastery(m, c as any) > 0.75)
    .sort((a, b) => b[1].attempts - a[1].attempts)[0];
  if (gained) {
    const c = gained[0] as keyof typeof CONCEPTS;
    out.push({
      kind: 'progress',
      headline: `${name} can now do problems they could not do at the start.`,
      body: `${CONCEPTS[c].label.toLowerCase()} — ${CONCEPTS[c].gist.toLowerCase()} — is holding steady across ${gained[1].attempts} attempts on different kinds of problem, which is the part that tells us it is understood rather than remembered.`,
    });
  }

  /* --- the misconception, in plain words -------------------------------- */
  const bug = (Object.entries(m.misconceptions) as [MisconceptionId, any][])
    .filter(([, s]) => s && s.status !== 'resolved')
    .sort((a, b) => b[1].confidence - a[1].confidence)[0];
  if (bug) {
    const [id, st] = bug;
    const def = MISCONCEPTIONS[id];
    out.push({
      kind: 'watch',
      headline: `Not a careless mistake — a rule that needs changing.`,
      body: `${def.parentGloss} We have seen it ${st.fires} time${st.fires === 1 ? '' : 's'}. It is being worked on inside the game; you do not need to correct it at home, and correcting it mid-problem usually makes children hide the method rather than change it.`,
    });
  }

  /* --- representation delta: the insight nobody else gives -------------- */
  const aff = m.traits.repAffinity;
  const spread = Math.max(aff.manipulative, aff.symbolic, aff.story) - Math.min(aff.manipulative, aff.symbolic, aff.story);
  if (spread > 0.25) {
    const surfaces: Representation[] = ['manipulative', 'symbolic', 'story'];
    const best = [...surfaces].sort((a, b) => aff[b] - aff[a])[0];
    const worst = [...surfaces].sort((a, b) => aff[a] - aff[b])[0];
    const human: Record<Representation, string> = {
      manipulative: 'with objects they can move',
      symbolic: 'written as numbers',
      story: 'told as a story',
    };
    out.push({
      kind: 'change',
      headline: `${name} understands the maths better than the page suggests.`,
      body: `On the same problems, ${name} does noticeably better ${human[best]} than ${human[worst]}. That gap is about the format, not the arithmetic — so we have shifted more of the game onto ${human[best]} while we close it. If schoolwork comes home looking worse than this, that gap is probably why.`,
    });
  }

  /* --- confidence, measured as behaviour not as a survey ---------------- */
  if (m.challengeDoor.offered >= 3) {
    const rate = m.challengeDoor.tookHarder / m.challengeDoor.offered;
    out.push({
      kind: rate >= 0.5 ? 'strength' : 'watch',
      headline:
        rate >= 0.5
          ? `${name} reaches for the harder problem after getting one wrong.`
          : `${name} plays it safe right after a mistake.`,
      body:
        rate >= 0.5
          ? `Offered the choice after a miss, ${name} chose the harder option ${m.challengeDoor.tookHarder} times out of ${m.challengeDoor.offered}. That willingness is a better predictor of where they end up than any score.`
          : `Offered a choice after a miss, ${name} took the easier option most times (${pct(1 - rate)}). That is normal and it moves — the game is currently giving them more guaranteed wins straight after a stumble to rebuild the footing.`,
    });
  }

  /* --- timed pressure, if we turned it off ------------------------------ */
  if (!m.policy.timePressure && m.traits.frustration > 0.4) {
    out.push({
      kind: 'change',
      headline: `We have taken the clock out of ${name}'s game.`,
      body: `Speed-based rounds were pushing accuracy down and frustration up, so they are switched off for now. Nothing about the curriculum has changed; ${name} will not notice the difference beyond feeling less rushed.`,
    });
  }

  /* --- something to do away from the screen -----------------------------
     Trimmed last, never trimmed away. The off-screen activity is the only
     item on this page a parent can act on tonight, and it is the reason they
     come back — so it survives the cut even when everything else is dropped. */
  return [...out.slice(0, 3), realWorldActivity(m)];
}

function realWorldActivity(m: LearnerModel): Insight {
  const bug = (Object.entries(m.misconceptions) as [MisconceptionId, any][])
    .filter(([, s]) => s && s.status !== 'resolved')
    .sort((a, b) => b[1].confidence - a[1].confidence)[0];

  if (bug) {
    const id = bug[0];
    const byBug: Partial<Record<MisconceptionId, string>> = {
      'sub-smaller-from-larger':
        'At the shop, hand over a note and ask what change you should get back. Real money forces the "break a bigger one open" move that this bug avoids.',
      'sub-borrow-not-decremented':
        'Count out change from a jar together and say out loud what leaves the pile. The point is noticing that when you break a note, you no longer have the note.',
      'add-dropped-carry':
        'Ask them to fill egg boxes of ten from a loose pile. When the eleventh egg arrives, the box question answers itself.',
      'add-carry-appended':
        'No activity needed for this one — it usually clears in a week or two on its own.',
      'count-on-off-by-one':
        'Play a jumping game on the stairs: stand on step 7 and jump 5 more. They will feel that step 7 is not one of the jumps.',
      'mult-added-instead':
        'Setting the table is the exact same problem: five places, three items each. Ask them how many before they start.',
      'mult-one-group-off':
        'Count in twos or fives while walking, and hold up a finger for each jump. The fingers hold the count so their memory does not have to.',
      'pv-digits-reversed':
        'When you say a two-digit number, ask them to grab that many things in bundles of ten. Saying and building in the same order is the fix.',
    };
    return {
      kind: 'activity',
      headline: 'Something to try this week, five minutes, no screen.',
      body: byBug[id] ?? 'Count things in tens together — anything at all. Bundling is the whole idea.',
    };
  }

  const front = pickFrontier(m);
  return {
    kind: 'activity',
    headline: 'Something to try this week, five minutes, no screen.',
    body: `They are working on ${CONCEPTS[front].label.toLowerCase()}. ${CONCEPTS[front].gist}. Ask them to explain it to you and get it slightly wrong on purpose — being the one who corrects an adult does more for confidence than a correct answer does.`,
  };
}

/** The one-line answer to "is my child behind?", phrased so it cannot frighten. */
export function progressFraming(m: LearnerModel): string {
  const front = pickFrontier(m);
  const ready = unlockedFrontier(m).length;
  return `${m.name} is working at ${CONCEPTS[front].grade} level on ${CONCEPTS[front].label.toLowerCase()}, with ${ready} skill${ready === 1 ? '' : 's'} currently open to them. Children move through these in very different orders, and the order matters far less than whether each one is understood rather than memorised.`;
}

/** Questions a parent can ask the assistant. Fixed set — never an open chat. */
export const PARENT_QUESTIONS = [
  'What is my child struggling with right now?',
  'How can I help without confusing them?',
  'What should we practise in real life?',
  'What did they learn this week?',
  'Is the game getting harder or easier for them?',
] as const;

export function answerParentQuestion(m: LearnerModel, q: (typeof PARENT_QUESTIONS)[number]): string {
  const insights = generateInsights(m);
  switch (q) {
    case 'What is my child struggling with right now?': {
      const w = insights.find((i) => i.kind === 'watch');
      return w ? `${w.headline} ${w.body}` : `Nothing is stuck at the moment. ${progressFraming(m)}`;
    }
    case 'How can I help without confusing them?':
      return `Two things. Do not teach the written method you were taught — if it differs from the one they are learning, they will end up running two methods and trusting neither. And when they get something wrong, ask "how did you work that out?" rather than "are you sure?". The first gets you the method; the second just gets you a changed answer.`;
    case 'What should we practise in real life?':
      return insights.find((i) => i.kind === 'activity')!.body;
    case 'What did they learn this week?': {
      const p = insights.find((i) => i.kind === 'progress');
      return p ? `${p.headline} ${p.body}` : `Early days — not enough sessions yet to say anything solid. Ask again after a few more.`;
    }
    case 'Is the game getting harder or easier for them?':
      return `Difficulty is currently at ${pct(m.policy.difficulty)} of range and moving to keep them right about 80% of the time. That figure is deliberate: it is high enough to feel achievable and low enough that they are still meeting things they cannot yet do.`;
  }
}
