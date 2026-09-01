import { scrubNames, type PersonalProfile } from './cast';
import { MISCONCEPTIONS } from './misconceptions';
import type { Diagnosis, LearnerModel, Policy, WorldId } from './types';
import { WORLDS } from './worlds';

/**
 * The companion.
 *
 * Design constraint that shapes everything below: the companion never has an
 * open-ended conversation with a child. Not because the model could not hold
 * one, but because an open channel to a seven-year-old is a channel you cannot
 * fully supervise, and "we could not have said something harmful even if the
 * model tried" is a stronger promise to a parent than "we filter it".
 *
 * So the architecture is: the *engine* decides the intent and the content of
 * every line — which is deterministic, auditable and testable. A model may
 * only rephrase a chosen line, within a fixed intent, a length cap and a
 * vocabulary ceiling, and any failure or timeout falls back to the written
 * line. The child gets variety; the product never gets an unbounded generator
 * pointed at a child.
 *
 * The second constraint: the companion never evaluates the child, only the
 * work. "That answer used the smaller-from-larger move" — never "you got it
 * wrong again". Children take the second one personally, and a child who has
 * decided they are bad at maths is a child no difficulty curve can reach.
 */

export type Beat =
  | 'greet'
  | 'correct'
  | 'correct-hard'
  | 'wrong-misconception'
  | 'wrong-gap'
  | 'wrong-careless'
  | 'wrong-notation'
  | 'wrong-language'
  | 'hint'
  | 'catch-setup'
  | 'catch-success'
  | 'catch-miss'
  | 'challenge-door'
  | 'session-end';

type Tone = Policy['companionTone'];

const BANK: Record<Beat, Record<Tone, string[]>> = {
  greet: {
    coach: ['Right. Where did we get to?', 'Back at it. Same station as yesterday.'],
    peer: ['Oh good, you.', 'I saved you the good one.'],
    cheerleader: ['There you are!', 'I was hoping you would come back.'],
    challenger: ['I set something up for you. It is not easy.', 'Ready? Because I made it worse.'],
  },
  correct: {
    coach: ['That is it.', 'Clean.', 'Yes — straight through.'],
    peer: ['Nice.', 'Told you.', 'Easy for you apparently.'],
    cheerleader: ['Yes! Look at that.', 'Perfect. Again?'],
    challenger: ['Fine. That one was warm-up.', 'Good. Now the real one.'],
  },
  'correct-hard': {
    coach: ['That one had teeth. You handled it.', 'That is the hard version. Done.'],
    peer: ['Okay that was actually tough.', 'I would have needed a minute on that.'],
    cheerleader: ['That was the hard one and you got it!', 'You just did the tricky kind.'],
    challenger: ['Hm. I will have to try harder.', 'Noted. Raising it.'],
  },
  'wrong-misconception': {
    coach: ['I see the move you made. Watch this.', 'That rule works sometimes. Here is where it bends.'],
    peer: ['Ohh, I do that one too. Look.', 'Wait — I want to show you something.'],
    cheerleader: ['Good try, and I know exactly what happened. Come see.', 'That is a really common one. Watch.'],
    challenger: ['Nearly. But the method has a hole in it.', 'Close. The method is what I would fix.'],
  },
  'wrong-gap': {
    coach: ['This one is new. Let us build it.', 'Not learned yet — that is all that is.'],
    peer: ['New thing. Want to poke at it together?', 'Neither of us has done this one.'],
    cheerleader: ['This is a brand new kind! Let us look at it slowly.', 'First time seeing this. That is allowed.'],
    challenger: ['Unknown territory. Good.', 'You have not met this one yet. Now you have.'],
  },
  'wrong-careless': {
    coach: ['You know this one. Look again.', 'Too quick. Re-read it.'],
    peer: ['You blinked.', 'You know that one, come on.'],
    cheerleader: ['So close! Just have another look.', 'You have got this one — one more look.'],
    challenger: ['Speed is not the same as skill. Again.', 'You rushed. Try it properly.'],
  },
  'wrong-notation': {
    coach: ['You have the idea. The writing is the tricky part.', 'The thinking was right. Let us do it with blocks.'],
    peer: ['You knew that. The symbols are annoying.', 'Blocks version — you will get it instantly.'],
    cheerleader: ['You understand this! The numbers on paper are the hard bit.', 'Let us show it your way.'],
    challenger: ['You can do it. Now do it written down.', 'The idea is yours. The notation is not yet.'],
  },
  'wrong-language': {
    coach: ['The maths is fine. The sentence is doing the work.', 'Let us strip the story out.'],
    peer: ['Too many words. Here it is plain.', 'Ignore the story. Look at the amounts.'],
    cheerleader: ['You can do this sum! The story made it sneaky.', 'Let us take the words away.'],
    challenger: ['Read it again. The numbers are hiding in it.', 'The sentence is the puzzle here.'],
  },
  hint: {
    coach: ['Start with the ones.', 'What happens when the tray is full?'],
    peer: ['I would start over here.', 'Try the bundles first.'],
    cheerleader: ['Here is a nudge — count the loose ones.', 'Little clue: look at the bundles.'],
    challenger: ['One clue. Only one.', 'Ones column. That is all you get.'],
    },
  'catch-setup': {
    coach: ['I did it. Check my work before we send it.', 'Have a look at mine first.'],
    peer: ['I did it fast. Probably fine. Probably.', 'Check mine, I never do.'],
    cheerleader: ['I had a go! Will you check it for me?', 'Tell me if I got it right!'],
    challenger: ['I have made exactly one mistake. Find it.', 'Somewhere in there I am wrong.'],
  },
  'catch-success': {
    coach: ['You caught it. That is the same move you were making.', 'Spotted. Good eye.'],
    peer: ['Ha — you got me.', 'Okay, you are better at this than me.'],
    cheerleader: ['You found it! That is brilliant checking.', 'You caught my mistake!'],
    challenger: ['Correct. I will hide it better next time.', 'Found it. Faster than I expected.'],
  },
  'catch-miss': {
    coach: ['It slipped past both of us. Look at the ones column.', 'We both missed it. Here.'],
    peer: ['We are as bad as each other. Look.', 'Neither of us saw it.'],
    cheerleader: ['It was a sneaky one! Let me show you.', 'That one was hard to spot.'],
    challenger: ['It got past you. Look again — ones column.', 'Missed. It was right there.'],
  },
  'challenge-door': {
    coach: ['Two doors. One like that one, one harder. Your call.', 'Same again, or steeper?'],
    peer: ['Easy one or nasty one?', 'Pick. I do not mind.'],
    cheerleader: ['Want another go at that, or shall we try something bigger?', 'Your choice — either is good.'],
    challenger: ['One of these is harder. You know which one I want you to take.', 'Steeper, or safe?'],
  },
  'session-end': {
    coach: ['Good session. Stop here.', 'That is a solid stopping point.'],
    peer: ['I am tired. Same time tomorrow?', 'Enough for today.'],
    cheerleader: ['What a session! See you next time.', 'You did loads today.'],
    challenger: ['We stop while you are ahead. Barely.', 'Enough. You earned the stop.'],
  },
};

export interface Line {
  text: string;
  beat: Beat;
  /** the engine's reason for saying it — shown in the Brain view, not to the child */
  why: string;
  source: 'template' | 'model';
}

let bankCursor = 0;

export function companionLine(
  m: LearnerModel,
  beat: Beat,
  ctx: { diagnosis?: Diagnosis; world?: WorldId } = {},
): Line {
  const tone = m.policy.companionTone;
  const options = BANK[beat][tone];
  const text = options[(bankCursor++) % options.length];

  let why = `beat=${beat}, tone=${tone}`;
  if (beat === 'wrong-misconception' && ctx.diagnosis?.misconception) {
    why += ` — child appears to believe: "${MISCONCEPTIONS[ctx.diagnosis.misconception].belief}"`;
  }
  return { text, beat, why, source: 'template' };
}

export const companionName = (w: WorldId) => WORLDS[w].companion;

/**
 * The narrow, safe surface a model is allowed to touch. Everything about the
 * response — which beat, what it means, how long it may be — is fixed before
 * the model sees it. The model may only vary the wording.
 */
export interface RephraseRequest {
  beat: Beat;
  tone: Tone;
  baseline: string;
  companion: string;
  maxWords: number;
  /** hard bans, enforced after generation, not just requested in the prompt */
  forbidden: string[];
}

/**
 * Build the only payload in this app that could ever leave the device.
 *
 * `profile` is required rather than optional on purpose: the scrub is not
 * something a caller can forget, because there is no way to construct this
 * request without passing the thing being scrubbed against. Names of the
 * child's friends — other people's children — never reach a third party,
 * and that holds by construction rather than by discipline.
 */
export function rephraseRequest(
  m: LearnerModel,
  line: Line,
  world: WorldId,
  profile: PersonalProfile,
): RephraseRequest {
  return {
    beat: line.beat,
    tone: m.policy.companionTone,
    baseline: scrubNames(line.text, profile),
    companion: companionName(world),
    maxWords: 16,
    forbidden: ['stupid', 'dumb', 'bad at', 'wrong again', 'you always', 'you never', 'failed'],
  };
}

/** Post-generation gate. A model output that fails any check is discarded. */
export function acceptRephrase(req: RephraseRequest, candidate: string): boolean {
  const c = candidate.trim();
  if (!c) return false;
  if (c.split(/\s+/).length > req.maxWords) return false;
  if (/[<>{}[\]]|http/i.test(c)) return false;
  const low = c.toLowerCase();
  if (req.forbidden.some((f) => low.includes(f))) return false;
  // No questions the engine did not intend to ask — an unplanned question is
  // how a scripted companion turns into an open-ended one.
  const questionBeats: Beat[] = ['hint', 'challenge-door', 'catch-setup', 'greet', 'wrong-misconception'];
  if (c.includes('?') && !questionBeats.includes(req.beat)) return false;
  return true;
}
