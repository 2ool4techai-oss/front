import { signal } from './signal.js';
import type { Signal } from './types.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface VoiceCommand {
  /** Simple phrase to match (case-insensitive substring) */
  phrase?: string;
  /** RegExp pattern to match (takes precedence over phrase) */
  pattern?: RegExp;
  /** Action to run on match */
  action: (match?: RegExpMatchArray | null) => void;
}

export interface VoiceSignalOptions {
  lang?: string;
  continuous?: boolean;
  /**
   * Commands can be:
   * - an array of VoiceCommand objects (phrase/pattern + action)
   * - OR a legacy Record<patternString, handler> for backward compat
   */
  commands?: VoiceCommand[] | Record<string, (match: RegExpMatchArray) => void>;
  onTranscript?: (text: string) => void;
}

export interface VoiceSignal {
  transcript: () => string;
  listening: () => boolean;
  confidence: () => number;
  /** Whether SpeechRecognition is available in this environment */
  supported: boolean;
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

// ── VoiceControlOptions (for voiceControl helper) ──────────────────────

export interface VoiceControlOptions {
  lang?: string;
  continuous?: boolean;
  commands?: VoiceCommand[];
  onTranscript?: (text: string) => void;
  /** Legacy pattern-transform array for type-safe usage */
  patterns?: Array<{ pattern: RegExp; transform: (match: RegExpMatchArray) => unknown }>;
}

// ── Web Speech API shim types ──────────────────────────────────────────

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionStatic {
  new(): SpeechRecognitionInstance;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onstart: ((ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function getSpeechRecognition(): SpeechRecognitionStatic | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w['SpeechRecognition'] ?? w['webkitSpeechRecognition'] ?? null) as SpeechRecognitionStatic | null;
}

// ── Normalise commands into a unified format ──────────────────────────

function normaliseCommands(
  raw: VoiceCommand[] | Record<string, (match: RegExpMatchArray) => void> | undefined,
): VoiceCommand[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  // Legacy Record format
  return Object.entries(raw).map(([patternStr, handler]) => ({
    pattern: new RegExp(patternStr, 'i'),
    action: (match?: RegExpMatchArray | null) => { if (match) handler(match); },
  }));
}

// ── createVoiceSignal ──────────────────────────────────────────────────

export function createVoiceSignal(opts?: VoiceSignalOptions): VoiceSignal {
  const _transcript = signal('');
  const _listening  = signal(false);
  const _confidence = signal(0);

  const SpeechRecognition = getSpeechRecognition();
  const supported = SpeechRecognition !== null;

  let recognition: SpeechRecognitionInstance | null = null;
  let _disposed = false;
  let _autoRestart = false;

  const commands = normaliseCommands(opts?.commands);

  const processCommands = (text: string): void => {
    for (const cmd of commands) {
      if (cmd.pattern) {
        const match = text.match(cmd.pattern);
        if (match) { cmd.action(match); continue; }
      }
      if (cmd.phrase && text.toLowerCase().includes(cmd.phrase.toLowerCase())) {
        cmd.action(null);
      }
    }
  };

  const createRecognition = (): SpeechRecognitionInstance | null => {
    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    rec.lang = opts?.lang ?? 'en-US';
    rec.continuous = opts?.continuous ?? false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (!_disposed) _listening.set(true);
    };

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      if (_disposed) return;
      let interimTranscript = '';
      let finalTranscript = '';
      let bestConfidence = 0;

      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        if (!result) continue;
        const alt = result[0];
        if (!alt) continue;
        if (result.isFinal) {
          finalTranscript += alt.transcript;
          bestConfidence = Math.max(bestConfidence, alt.confidence ?? 0);
        } else {
          interimTranscript += alt.transcript;
        }
      }

      const text = finalTranscript || interimTranscript;
      if (text) {
        _transcript.set(text);
        _confidence.set(bestConfidence || 0.5);
        opts?.onTranscript?.(text);
        if (finalTranscript) {
          processCommands(finalTranscript);
        }
      }
    };

    rec.onerror = () => {
      if (!_disposed) _listening.set(false);
    };

    rec.onend = () => {
      if (_disposed) return;
      _listening.set(false);
      // Auto-restart for continuous mode
      if (_autoRestart && opts?.continuous && !_disposed) {
        try { rec.start(); } catch { /* ignore */ }
      }
    };

    return rec;
  };

  const vs: VoiceSignal = {
    transcript: _transcript,
    listening: _listening,
    confidence: _confidence,
    supported,

    start(): void {
      if (_disposed) return;
      if (!recognition) {
        recognition = createRecognition();
      }
      if (!recognition) {
        _listening.set(false);
        return;
      }
      _autoRestart = true;
      try {
        recognition.start();
      } catch {
        // Already running — ignore
      }
    },

    stop(): void {
      _autoRestart = false;
      if (recognition) {
        try { recognition.stop(); } catch { /* ignore */ }
      }
      _listening.set(false);
    },

    dispose(): void {
      _disposed = true;
      _autoRestart = false;
      if (recognition) {
        try { recognition.abort(); } catch { /* ignore */ }
        recognition = null;
      }
      _listening.set(false);
    },
  };

  return vs;
}

// ── voiceControl ───────────────────────────────────────────────────────
// Overloads:
//   voiceControl(sig, opts)           — new API (array of commands)
//   voiceControl(sig, patterns, opts) — legacy typed-transform API

export function voiceControl<T>(
  sig: Signal<T>,
  optsOrPatterns:
    | VoiceControlOptions
    | Array<{ pattern: RegExp; transform: (match: RegExpMatchArray) => T }>,
  legacyOpts?: VoiceSignalOptions,
): VoiceSignal {
  let commands: VoiceCommand[] = [];
  let baseOpts: VoiceSignalOptions | undefined;

  if (Array.isArray(optsOrPatterns)) {
    // Legacy: voiceControl(sig, patterns, opts)
    commands = optsOrPatterns.map(({ pattern, transform }) => ({
      pattern,
      action: (match?: RegExpMatchArray | null) => {
        if (match) sig.set(transform(match));
      },
    }));
    baseOpts = legacyOpts;
  } else {
    // New: voiceControl(sig, { commands: [...], ...opts })
    const { commands: rawCmds, patterns, ...rest } = optsOrPatterns as VoiceControlOptions;
    baseOpts = rest as VoiceSignalOptions;

    if (rawCmds) {
      commands = rawCmds.map(cmd => ({
        ...cmd,
        action: (match?: RegExpMatchArray | null) => {
          cmd.action(match);
        },
      }));
    }

    if (patterns) {
      for (const { pattern, transform } of patterns) {
        commands.push({
          pattern,
          action: (match?: RegExpMatchArray | null) => {
            if (match) sig.set(transform(match) as T);
          },
        });
      }
    }
  }

  return createVoiceSignal({
    ...baseOpts,
    commands,
    onTranscript: (text: string) => {
      baseOpts?.onTranscript?.(text);
    },
  });
}
