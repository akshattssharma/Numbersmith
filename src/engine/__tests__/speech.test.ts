import { describe, expect, it } from 'vitest';
import {
  celebrate, isSpeechSupported, setSpeechEnabled, speakSequence, stopSpeaking,
} from '../speech';

/**
 * The test environment is 'node' — there is no `window`, `speechSynthesis`
 * or `AudioContext` here, which is exactly the case every export has to
 * survive without throwing: a browser API this thin can't be asserted on
 * for actual sound, but it can be asserted on for never crashing the
 * screen that calls it when the platform doesn't have the capability.
 */
describe('speech: safe without a browser', () => {
  it('reports unsupported where there is no window.speechSynthesis', () => {
    expect(isSpeechSupported()).toBe(false);
  });

  it('every export no-ops instead of throwing', () => {
    expect(() => speakSequence(['hello', undefined, 'world'])).not.toThrow();
    expect(() => celebrate('nice work')).not.toThrow();
    expect(() => celebrate(undefined)).not.toThrow();
    expect(() => stopSpeaking()).not.toThrow();
    expect(() => setSpeechEnabled(false)).not.toThrow();
    expect(() => setSpeechEnabled(true)).not.toThrow();
  });
});
