import { signal, computed, effect } from './signal.js';

// ── Types ──────────────────────────────────────────────────────────────

export type InputModality = 'touch' | 'mouse' | 'keyboard' | 'voice' | 'pen';

export interface MultiModalOptions {
  preferred?: InputModality;
  fallback?: InputModality;
  autoDetect?: boolean;
}

export interface MultiModalInput {
  modality: () => InputModality;       // current active modality (reactive)
  setModality: (m: InputModality) => void;
  isTouch: () => boolean;
  isVoice: () => boolean;
  isKeyboard: () => boolean;
  onModalityChange: (fn: (m: InputModality) => void) => () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────

function detectInitialModality(preferred?: InputModality): InputModality {
  if (preferred) return preferred;
  if (typeof window === 'undefined') return 'keyboard';

  // Coarse pointer = touch device
  if (window.matchMedia?.('(pointer: coarse)').matches) return 'touch';
  if (window.matchMedia?.('(pointer: fine)').matches) return 'mouse';

  return 'mouse';
}

// ── createMultiModalInput ──────────────────────────────────────────────

export function createMultiModalInput(opts?: MultiModalOptions): MultiModalInput {
  const autoDetect = opts?.autoDetect ?? true;
  const initial = detectInitialModality(opts?.preferred);

  const _modality = signal<InputModality>(initial);
  const _subscribers = new Set<(m: InputModality) => void>();

  const setModality = (m: InputModality): void => {
    if (_modality.peek() === m) return;
    _modality.set(m);
    for (const fn of _subscribers) {
      try { fn(m); } catch { /* swallow */ }
    }
  };

  // DOM event listeners for auto-detection
  const _listeners: Array<() => void> = [];

  if (autoDetect && typeof window !== 'undefined') {
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') setModality('touch');
      else if (e.pointerType === 'pen') setModality('pen');
      else if (e.pointerType === 'mouse') setModality('mouse');
    };

    const onKeyDown = () => setModality('keyboard');

    // Voice is not auto-detected from DOM — requires explicit call to setModality('voice')

    window.addEventListener('pointerdown', onPointerDown as EventListener);
    window.addEventListener('keydown', onKeyDown);

    _listeners.push(
      () => window.removeEventListener('pointerdown', onPointerDown as EventListener),
      () => window.removeEventListener('keydown', onKeyDown),
    );
  }

  const input: MultiModalInput = {
    modality: () => _modality(),
    setModality,
    isTouch: () => _modality() === 'touch',
    isVoice: () => _modality() === 'voice',
    isKeyboard: () => _modality() === 'keyboard',
    onModalityChange: (fn: (m: InputModality) => void): (() => void) => {
      _subscribers.add(fn);
      return () => _subscribers.delete(fn);
    },
  };

  return input;
}

// ── adaptToModality ────────────────────────────────────────────────────

export function adaptToModality<T>(
  input: MultiModalInput,
  values: Partial<Record<InputModality, T>>,
  fallback?: T,
): () => T {
  return computed(() => {
    const current = input.modality();
    if (values[current] !== undefined) return values[current] as T;
    return fallback as T;
  });
}
