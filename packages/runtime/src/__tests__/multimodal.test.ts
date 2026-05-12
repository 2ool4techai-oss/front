import { describe, it, expect, vi } from 'vitest';
import { createMultiModalInput, adaptToModality } from '../multimodal.js';

describe('createMultiModalInput', () => {
  it('returns MultiModalInput with modality, setModality, isTouch, isVoice, isKeyboard', () => {
    const m = createMultiModalInput();
    expect(typeof m.modality).toBe('function');
    expect(typeof m.setModality).toBe('function');
    expect(typeof m.isTouch).toBe('function');
    expect(typeof m.isVoice).toBe('function');
    expect(typeof m.isKeyboard).toBe('function');
  });

  it('respects preferred modality option', () => {
    const m = createMultiModalInput({ preferred: 'touch', autoDetect: false });
    expect(m.modality()).toBe('touch');
    expect(m.isTouch()).toBe(true);
  });

  it('setModality changes the active modality', () => {
    const m = createMultiModalInput({ preferred: 'mouse', autoDetect: false });
    m.setModality('keyboard');
    expect(m.modality()).toBe('keyboard');
    expect(m.isKeyboard()).toBe(true);
  });

  it('isVoice returns true when modality is voice', () => {
    const m = createMultiModalInput({ preferred: 'mouse', autoDetect: false });
    m.setModality('voice');
    expect(m.isVoice()).toBe(true);
  });

  it('onModalityChange fires on change', () => {
    const m = createMultiModalInput({ preferred: 'mouse', autoDetect: false });
    const spy = vi.fn();
    m.onModalityChange(spy);
    m.setModality('touch');
    expect(spy).toHaveBeenCalledWith('touch');
  });

  it('onModalityChange returns an unsubscribe function', () => {
    const m = createMultiModalInput({ preferred: 'mouse', autoDetect: false });
    const spy = vi.fn();
    const unsub = m.onModalityChange(spy);
    unsub();
    m.setModality('keyboard');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('adaptToModality', () => {
  it('returns value for current modality', () => {
    const m = createMultiModalInput({ preferred: 'touch', autoDetect: false });
    const adapted = adaptToModality(m, {
      touch: 'large',
      mouse: 'small',
      keyboard: 'medium',
    });
    expect(adapted()).toBe('large');
  });

  it('uses fallback when modality not in map', () => {
    const m = createMultiModalInput({ preferred: 'voice', autoDetect: false });
    const adapted = adaptToModality(m, { touch: 'big' }, 'default-value');
    expect(adapted()).toBe('default-value');
  });
});
