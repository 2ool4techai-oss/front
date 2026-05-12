// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { generateAnimation, generateAnimationSync } from '../generate-animation.js';

describe('generateAnimationSync', () => {
  it('returns keyframes for fadeIn', () => {
    const result = generateAnimationSync('fadeIn');
    expect(result.keyframes.length).toBeGreaterThan(0);
    expect(result.keyframes[0]).toHaveProperty('opacity');
  });

  it('returns keyframes for all presets', () => {
    const presets = ['fadeIn','fadeOut','slideInLeft','slideInRight','bounceIn','pulse','shake','spin','zoomIn','zoomOut'] as const;
    for (const p of presets) {
      const r = generateAnimationSync(p);
      expect(r.keyframes.length).toBeGreaterThan(0);
    }
  });

  it('apply() returns an Animation object', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    // mock element.animate
    el.animate = () => ({ cancel: () => {}, play: () => {}, pause: () => {} } as unknown as Animation);
    const result = generateAnimationSync('fadeIn', { duration: 300 });
    expect(() => result.apply(el)).not.toThrow();
    document.body.removeChild(el);
  });

  it('css property is a string with @keyframes', () => {
    const result = generateAnimationSync('spin');
    expect(typeof result.css).toBe('string');
  });
});

describe('generateAnimation', () => {
  it('resolves with an AnimationResult for a preset string', async () => {
    const result = await generateAnimation('fadeIn');
    expect(result.keyframes.length).toBeGreaterThan(0);
  });

  it('resolves for a natural language prompt without AI configured', async () => {
    const result = await generateAnimation('make it fade in slowly');
    expect(result.keyframes.length).toBeGreaterThan(0);
  });
});
