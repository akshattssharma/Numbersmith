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
    coach: [
      'Right. Where did we get to?', 'Back at it. Same station as yesterday.',
      'Good, you are here. Let us pick this up.', 'Alright. Let us get moving.',
      'Here we go again.', 'Good timing. I was just setting things up.',
      'Let us see what is next.', 'You are back. Let us keep the streak going.',
      'Okay. Same place, same plan.', 'Good. Let us get started.',
      'Right then. On we go.', 'You made it back. Let us begin.',
      'Alright, settle in. Here is the next one.', 'Good — let us pick up where we left off.',
      'Ready when you are.',
    ],
    peer: [
      'Oh good, you.', 'I saved you the good one.',
      'Took you long enough.', 'Was wondering when you would show up.',
      'You again. Good.', 'Perfect timing, as always.',
      'Back for more, huh?', 'Knew you would come back.',
      'Alright, let us do this.', 'Missed you. Do not tell anyone I said that.',
      'You are just in time.', 'Ready to lose again? Kidding. Mostly.',
      'Good, I was getting bored.', 'Let us see what you have got today.',
      'Here we go, same as always.',
    ],
    cheerleader: [
      'There you are!', 'I was hoping you would come back!',
      'Yay, you are here!', 'This is going to be a good one!',
      'I have been waiting for you!', 'Let us have some fun!',
      'So happy you are back!', 'Ready for another great round?',
      'You picked a great time to play!', 'Let us go, I am excited!',
      'Here we go — I love this part!', 'You are going to do great today!',
      'Woo! Let us get started!', 'I saved the best one for you!',
      'Let us make today a good one!',
    ],
    challenger: [
      'I set something up for you. It is not easy.', 'Ready? Because I made it worse.',
      'Hope you practiced.', 'This one might actually get you.',
      'Do not get comfortable.', 'I upped the difficulty. You are welcome.',
      'Let us see if you remember anything.', 'Back again? Bold of you.',
      'I was not going easy today.', 'This round bites back.',
      'You will need to focus today.', 'I made this one on purpose.',
      'Let us find out what you forgot.', 'No warm-up today.',
      'Try to keep up.',
    ],
  },
  correct: {
    coach: [
      'That is it.', 'Clean.', 'Yes — straight through.',
      'Correct.', 'Right on target.', 'That is exactly it.',
      'Good. Next.', 'You have got this down.', 'Solid work.',
      'That is the one.', 'Nice and steady.', 'Right first time.',
      'That is how it is done.', 'Good instinct there.', 'Yes. Keep that up.',
    ],
    peer: [
      'Nice.', 'Told you.', 'Easy for you apparently.',
      'Yep, that is it.', 'See, you knew it.', 'Called it.',
      'Look at you.', 'Not bad.', 'You make that look easy.',
      'There it is.', 'Yeah, that is right.', 'Knew you had it.',
      'Show-off.', 'You are on a roll.', 'That works.',
    ],
    cheerleader: [
      'Yes! Look at that.', 'Perfect. Again?',
      'Yes! You got it!', 'That is exactly right!', 'Amazing! Next one!',
      'You are on fire!', 'Woo! Nailed it!', 'Fantastic work!',
      'Yes yes yes!', 'You are so good at this!', 'Perfect! Keep going!',
      'That was brilliant!', 'You did it!', 'Incredible! Onward!',
      'Yes! You are unstoppable today!',
    ],
    challenger: [
      'Fine. That one was warm-up.', 'Good. Now the real one.',
      'Correct. Do not get used to it.', 'Fine. Lucky guess?',
      'Not bad. Next.', 'Alright, that one counted.',
      'Hm. You are paying attention today.', 'Acceptable.',
      'Fine, that was right.', 'You got it. Onward.',
      'Correct. Barely impressed.', 'Good. Do it again.',
      'That one was easy for you, apparently.', 'Fine. Next one is harder.',
      'Right. Let us keep going.',
    ],
  },
  'correct-hard': {
    coach: [
      'That one had teeth. You handled it.', 'That is the hard version. Done.',
      'That was the tough one. You got it.', 'That is not the easy version. Well done.',
      'That takes real focus. Nice work.', 'You earned that one.',
      'That was genuinely hard. You did it.', 'Not many get that one first try.',
      'That is the one that trips people up. Not you.', 'Good — that was the real test.',
      'You worked for that one.', 'That one meant something.',
      'Solid. That was the hard version.', 'You stayed with it. It showed.',
      'That is a hard-earned right answer.',
    ],
    peer: [
      'Okay that was actually tough.', 'I would have needed a minute on that.',
      'Okay, that one was legit hard.', 'I am a little impressed, not gonna lie.',
      'That was not the easy one. Nice.', 'Whoa, okay.',
      'You just did the hard version like it was nothing.', 'That would have taken me longer.',
      'Okay, show-off.', 'That one had some bite. You handled it.',
      'Respect. That was not simple.', 'You are better at this than you let on.',
      'That was the tricky one, right? Nice.', 'Okay, I see you.',
      'That was genuinely tough. Nicely done.',
    ],
    cheerleader: [
      'That was the hard one and you got it!', 'You just did the tricky kind!',
      'That was the hard version and you crushed it!', 'Wow, that one was tough — amazing job!',
      'You just tackled the hardest kind there is!', 'That takes real skill — you have it!',
      'Incredible! That was not the easy one!', 'You should be so proud of that one!',
      'That was a big one and you got it!', 'Yes! The hard ones are your specialty now!',
      'That was seriously impressive!', 'You just leveled up, I can tell!',
      'That one is hard for anyone — not for you!', 'Wow wow wow, that was the tough one!',
      'You are getting so strong at this!',
    ],
    challenger: [
      'Hm. I will have to try harder.', 'Noted. Raising it.',
      'Alright. That one was supposed to be harder than that.', 'Impressive. I will fix that next time.',
      'You were not supposed to get that so fast.', 'Hm. Recalculating.',
      'Fine. You earned a harder one.', 'That was the difficult version. You made it look easy. Rude.',
      'Okay, that actually surprised me.', 'Noted. You are getting good.',
      'That was not supposed to be that easy for you.', 'I will need a new plan.',
      'Alright, you have my attention now.', 'That one was meant to slow you down.',
      'Hm. You are improving faster than I planned for.',
    ],
  },
  'wrong-misconception': {
    coach: ['I see the move you made. Watch this.', 'That rule works sometimes. Here is where it bends.'],
    peer: ['Ohh, I do that one too. Look.', 'Wait — I want to show you something.'],
    cheerleader: ['Good try, and I know exactly what happened. Come see.', 'That is a really common one. Watch.'],
    challenger: ['Nearly. But the method has a hole in it.', 'Close. The method is what I would fix.'],
  },
  'wrong-gap': {
    coach: [
      'This one is new. Let us build it.', 'Not learned yet — that is all that is.',
      'You have not seen this kind before. That is fine.', 'New territory. Let us work through it together.',
      'This is a first-time problem. No pressure.', 'You have not been taught this bit yet — now you are.',
      'That is a brand new idea. Let us take it slow.', 'Nobody knows a new thing before they learn it.',
      'This is where the learning happens. Let us look.', 'That was not a mistake — it was just new.',
      'You have not built this skill yet. We are starting now.', 'This is unfamiliar, and that is completely normal.',
      'Let us take this one apart together.', 'That is a new kind of problem. Let us meet it.',
      'Everyone starts here on this one. You too.',
    ],
    peer: [
      'New thing. Want to poke at it together?', 'Neither of us has done this one.',
      'Yeah, that one is new. Let us figure it out.', 'Honestly I would not have known that either.',
      'That is not something you have done before. Fair.', 'New one. Let us look at it together.',
      'That is a first-timer. No big deal.', 'We have not hit this before. Let us see.',
      'That is fresh territory for both of us.', 'Nobody taught you that yet. Now someone is.',
      'That one is new — let us poke at it.', 'Fair, that is not something you have met yet.',
      'New kind of problem. Let us take a look.', 'That is uncharted. Let us go together.',
      'You have not seen this shape before. Now you have.',
    ],
    cheerleader: [
      'This is a brand new kind! Let us look at it slowly.', 'First time seeing this. That is allowed.',
      'A brand new kind of problem — how exciting!', 'You get to learn something new right now!',
      'First time meeting this one — that is exactly how learning works!', 'New things are supposed to feel new. Let us explore it!',
      'This is a great chance to learn something!', 'You have not seen this before, and that is okay!',
      'Ooh, a new kind of problem! Let us dig in!', 'This is brand new — no wonder it felt tricky!',
      'Everyone meets a new idea for the first time once!', 'This is exciting — a new thing to learn!',
      'You are about to learn something completely new!', 'New ground! Let us explore it together!',
      'This is what learning something new looks like!',
    ],
    challenger: [
      'Unknown territory. Good.', 'You have not met this one yet. Now you have.',
      'New kind. Nobody gets this one free.', 'You have not earned this skill yet. Let us fix that.',
      'That was not a loss — it was uncharted ground.', 'This one was never going to be free.',
      'New problem. Everyone starts at zero on it.', 'That is not a weakness. It is just new.',
      'You have not trained for this one yet.', 'First contact with this kind. Now it begins.',
      'Nobody walks in knowing this one.', 'That was uncharted, not wrong.',
      'New skill unlocked: knowing you do not know it yet.', 'That one was never on the table before. Now it is.',
      'You just found the edge of what you know. Good.',
    ],
  },
  'wrong-careless': {
    coach: [
      'You know this one. Look again.', 'Too quick. Re-read it.',
      'You have got this — slow down a touch.', 'That was a rush, not a gap. Try again.',
      'You know how to do this. Take your time.', 'Close — just slow down for a second.',
      'You have done this before. Give it a proper look.', 'That was quick. Give it one more careful pass.',
      'You know this. Read it once more.', 'Just a speed slip. Try that again slowly.',
      'You have the skill. Just take a breath first.', 'That is not a knowledge gap — just a rushed one.',
      'You know this cold. Slow down and it is yours.', 'One more look, no rush this time.',
      'You have got the idea — just take your time landing it.',
    ],
    peer: [
      'You blinked.', 'You know that one, come on.',
      'You went too fast there.', 'Slow down, you know this.',
      'That was quick. Try it again properly.', 'Come on, you know better than that.',
      'You rushed it. Give it another shot.', 'That was a speed thing, not a you-do-not-know-it thing.',
      'You know this one. Just slow down.', 'Whoa, slow your roll for a sec.',
      'You blinked and missed it. Try again.', 'You have got this, just not that fast.',
      'Come on, take an extra second.', 'You know it. You just went too quick.',
      'That was careless, not clueless. Again.',
    ],
    cheerleader: [
      'So close! Just have another look.', 'You have got this one — one more look.',
      'So close! Just slow down a little!', 'You know this one, I promise! Try again!',
      'Almost! Take one more careful look!', 'You have got the skill — just take your time!',
      'That was just a quick slip! You know this!', 'One more try, nice and slow!',
      'You are so close — just breathe and try again!', 'You know this backwards! Just slow down!',
      'Nearly there — one more careful look!', 'You have got this in you, just take a beat!',
      'So close! A calmer look will get it!', 'You know it, you just zoomed past it!',
      'Almost perfect — just slow down a touch!',
    ],
    challenger: [
      'Speed is not the same as skill. Again.', 'You rushed. Try it properly.',
      'Slow is smooth. Try again.', 'You know this. Rushing is not an excuse.',
      'That was carelessness, not difficulty. Fix it.', 'You do not get credit for fast and wrong.',
      'Again. Properly this time.', 'You know better than that answer.',
      'That was beneath you. Slow down.', 'Speed will not save you here. Focus.',
      'You rushed a skill you already have. Again.', 'That was not hard — you were just quick. Redo it.',
      'You know this. Prove it slowly.', 'Careless is not the same as incapable. Again.',
      'You had it and threw it away by rushing. Again.',
    ],
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

/**
 * A stable, cheap string hash — just enough to give each (beat, tone) bucket
 * its own phase, so two buckets don't advance in lockstep when read against
 * the same growing counter.
 */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function companionLine(
  m: LearnerModel,
  beat: Beat,
  ctx: { diagnosis?: Diagnosis; world?: WorldId } = {},
): Line {
  const tone = m.policy.companionTone;
  const options = BANK[beat][tone];
  // Rotates through this bucket's own lines as the child plays, rather than
  // a single counter shared across every beat, every tone and every child on
  // the device — the old version meant a bucket's position depended on how
  // many *other* lines had fired since the app loaded, not on itself, which
  // is why more lines didn't actually feel like more variety. Keyed off
  // lifetime attempts so it's deterministic (and testable) rather than a
  // module-global that never resets.
  const idx = (m.history.length + hashStr(beat + tone)) % options.length;
  const text = options[idx];

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
