/**
 * On-device text-to-speech, plus a synthesized encouragement chime — no
 * recorded audio, no network call, nothing leaves the device. TTS is the
 * only workable choice for the prompt and the companion line specifically:
 * both are procedurally generated (numbers change every item; companion.ts
 * alone has 15 lines x 4 tones per beat), so there is no fixed script that
 * could ever be pre-recorded.
 *
 * A browser-capability wrapper, not pedagogy — same category as
 * household.ts's use of localStorage. Every export guards against running
 * where `window` doesn't exist (vitest's environment is 'node') so this
 * file is safe to import from a test.
 */

let speechEnabled = true;
let voice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;

function hasSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Common female-voice names across the platforms this actually has to run
// on — Windows/Edge, macOS/iOS Safari, Android/Chrome. The Web Speech API
// has no standard gender field, so name-matching is the only lever there is.
const FEMALE_NAME_HINTS = [
  'female', 'zira', 'aria', 'jenny', 'samantha', 'karen', 'moira', 'tessa',
  'victoria', 'susan', 'salli', 'joanna', 'ivy', 'kendra', 'kimberly', 'amy',
  'emma', 'fiona', 'serena', 'martha', 'allison', 'ava', 'kate', 'kathy',
  'google us english',
];

function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let score = 0;
  if (v.lang.startsWith('en')) score += 100;
  // Never trade "stays on the device" for a fancier-sounding name — some
  // platforms' better-sounding voices are literally a network call
  // (Edge's "(Natural)"/"Online" voices), which would break the same
  // nothing-leaves-the-device commitment the rest of the engine holds to.
  if (v.localService) score += 50;
  if (FEMALE_NAME_HINTS.some((hint) => name.includes(hint))) score += 20;
  return score;
}

function loadVoice(): void {
  if (!hasSpeechSynthesis()) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  voicesLoaded = true;
  voice = voices.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
}

if (hasSpeechSynthesis()) {
  loadVoice();
  window.speechSynthesis.onvoiceschanged = loadVoice;
}

export function isSpeechSupported(): boolean {
  return hasSpeechSynthesis();
}

export function setSpeechEnabled(on: boolean): void {
  speechEnabled = on;
  if (!on) stopSpeaking();
}

/**
 * Rate/pitch presets, not one fixed setting — the browser voice itself is
 * the biggest lever on "robotic vs. warm" and this engine has no control
 * over that, but the moment still matters: a prompt or a hint should read
 * calm and clear, a correct answer should sound genuinely pleased, and a
 * miss should stay soft rather than falsely cheerful.
 */
export type SpeechTone = 'calm' | 'excited' | 'soft';

const TONE_PRESETS: Record<SpeechTone, { rate: number; pitch: number }> = {
  calm: { rate: 0.93, pitch: 1.08 },
  excited: { rate: 1.02, pitch: 1.2 },
  soft: { rate: 0.88, pitch: 1.0 },
};

/**
 * Cancels anything still queued, then speaks each text in order. The
 * cancel is so a new turn's prompt+line replaces whatever the last turn
 * was still reading; queuing (rather than cancelling) between the texts in
 * one call is what lets a turn's own prompt-then-line pair play back to
 * back without one talking over the other.
 */
export function speakSequence(texts: (string | undefined)[], tone: SpeechTone = 'calm'): void {
  if (!speechEnabled || !hasSpeechSynthesis()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  if (!voicesLoaded) loadVoice();
  const { rate, pitch } = TONE_PRESETS[tone];
  for (const text of texts) {
    if (!text) continue;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = rate;
    utter.pitch = pitch;
    if (voice) utter.voice = voice;
    synth.speak(utter);
  }
}

export function stopSpeaking(): void {
  if (hasSpeechSynthesis()) window.speechSynthesis.cancel();
}

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
  if (!audioCtx) audioCtx = new window.AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}

/** Three quick ascending notes (a bright major triad) — the item-tier
 *  "you got one" sound, synthesized rather than a recorded clip. */
function playChime(): void {
  if (!speechEnabled) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const start = ctx.currentTime;
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t0 = start + i * 0.09;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.24);
  });
}

/**
 * The encouragement moment for a correct answer: the chime, then — once it
 * has finished ringing — the companion's line read aloud. Kept as one call
 * so every caller gets the same gap between them rather than hand-tuning it
 * at each call site.
 */
export function celebrate(text: string | undefined): void {
  playChime();
  if (!text) return;
  setTimeout(() => speakSequence([text], 'excited'), 420);
}
