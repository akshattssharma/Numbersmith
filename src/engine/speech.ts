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

function loadVoice(): void {
  if (!hasSpeechSynthesis()) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  voicesLoaded = true;
  // A local (on-device) English voice reads numbers and punctuation most
  // reliably, and avoids the extra latency some platforms add for a
  // "network" voice — no quality gain here that would be worth the wait.
  voice = voices.find((v) => v.lang.startsWith('en') && v.localService)
    ?? voices.find((v) => v.lang.startsWith('en'))
    ?? voices[0] ?? null;
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
 * Cancels anything still queued, then speaks each text in order. The
 * cancel is so a new turn's prompt+line replaces whatever the last turn
 * was still reading; queuing (rather than cancelling) between the texts in
 * one call is what lets a turn's own prompt-then-line pair play back to
 * back without one talking over the other.
 */
export function speakSequence(texts: (string | undefined)[]): void {
  if (!speechEnabled || !hasSpeechSynthesis()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  if (!voicesLoaded) loadVoice();
  for (const text of texts) {
    if (!text) continue;
    const utter = new SpeechSynthesisUtterance(text);
    // Slightly slower and a touch higher — clearer for a listener who may
    // not be reading along, without turning cartoonish. A starting point,
    // not a tuned constant.
    utter.rate = 0.95;
    utter.pitch = 1.05;
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
  setTimeout(() => speakSequence([text]), 420);
}
