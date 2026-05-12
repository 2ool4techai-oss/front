import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVoiceSignal, voiceControl } from '../voice.js';
import { signal } from '../signal.js';

// jsdom doesn't implement SpeechRecognition; mock it
beforeEach(() => {
  (globalThis as any).SpeechRecognition = undefined;
  (globalThis as any).webkitSpeechRecognition = undefined;
});

describe('createVoiceSignal', () => {
  it('returns a VoiceSignal with required interface', () => {
    const v = createVoiceSignal();
    expect(typeof v.transcript).toBe('function');
    expect(typeof v.listening).toBe('function');
    expect(typeof v.start).toBe('function');
    expect(typeof v.stop).toBe('function');
    expect(typeof v.supported).toBe('boolean');
  });

  it('supported is false when SpeechRecognition is unavailable', () => {
    const v = createVoiceSignal();
    expect(v.supported).toBe(false);
  });

  it('transcript starts as empty string', () => {
    const v = createVoiceSignal();
    expect(v.transcript()).toBe('');
  });

  it('listening starts as false', () => {
    const v = createVoiceSignal();
    expect(v.listening()).toBe(false);
  });

  it('stop() does not throw even when not listening', () => {
    const v = createVoiceSignal();
    expect(() => v.stop()).not.toThrow();
  });
});

describe('voiceControl', () => {
  it('returns an object with start and stop', () => {
    const s = signal('idle');
    const vc = voiceControl(s, {
      commands: [{ phrase: 'go home', action: () => s.set('home') }],
    });
    expect(typeof vc.start).toBe('function');
    expect(typeof vc.stop).toBe('function');
  });

  it('does not throw when called without SpeechRecognition', () => {
    const s = signal('');
    const vc = voiceControl(s, { commands: [] });
    expect(() => vc.start()).not.toThrow();
    expect(() => vc.stop()).not.toThrow();
  });
});
