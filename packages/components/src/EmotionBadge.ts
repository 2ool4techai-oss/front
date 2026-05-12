import { effect } from '@nexoraaidrishti/runtime';
import type { EmotionState } from '@nexoraaidrishti/runtime';

const EMOTION_CONFIG: Record<EmotionState, { label: string; color: string; bg: string; emoji: string }> = {
  calm:        { label: 'Calm',        color: '#065f46', bg: '#ecfdf5',         emoji: '😌' },
  engaged:     { label: 'Engaged',     color: '#1e40af', bg: '#eff6ff',         emoji: '🎯' },
  focused:     { label: 'Focused',     color: '#1e3a5f', bg: '#e0f2fe',         emoji: '🔍' },
  frustrated:  { label: 'Frustrated',  color: '#92400e', bg: '#fffbeb',         emoji: '😤' },
  confused:    { label: 'Confused',    color: '#5b21b6', bg: '#f5f3ff',         emoji: '🤔' },
  bored:       { label: 'Bored',       color: '#374151', bg: '#f9fafb',         emoji: '😑' },
  celebrating: { label: 'Celebrating', color: '#be185d', bg: '#fdf2f8',         emoji: '🎉' },
};

export interface EmotionBadgeProps {
  emotion: () => EmotionState;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function EmotionBadge(props: EmotionBadgeProps): HTMLElement {
  const size = props.size ?? 'md';
  const padding = size === 'sm' ? '2px 8px' : size === 'lg' ? '6px 16px' : '4px 12px';
  const fontSize = size === 'sm' ? '.7rem' : size === 'lg' ? '.95rem' : '.8rem';

  const badge = document.createElement('span');
  badge.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: ${padding};
    border-radius: 9999px;
    font-size: ${fontSize};
    font-weight: 600;
    font-family: var(--dr-font-family, system-ui);
    transition: all var(--dr-transition-speed, 200ms) var(--dr-transition-ease, ease);
    user-select: none;
  `;

  effect(() => {
    const state = props.emotion();
    const cfg = EMOTION_CONFIG[state];
    badge.style.color = cfg.color;
    badge.style.background = cfg.bg;
    badge.textContent = props.showLabel !== false
      ? `${cfg.emoji} ${cfg.label}`
      : cfg.emoji;
  });

  return badge;
}

export interface EmotionAdaptiveProps {
  emotion: () => EmotionState;
  children: HTMLElement;
}

export function withEmotionAdaptation(el: HTMLElement, emotion: () => EmotionState): HTMLElement {
  effect(() => {
    const state = emotion();
    el.style.setProperty('--dr-current-emotion', state);

    switch (state) {
      case 'frustrated':
        el.style.setProperty('--dr-anim-speed', '1.6');
        el.style.setProperty('--dr-contrast-boost', '1');
        el.style.setProperty('--dr-font-scale', '1.1');
        break;
      case 'confused':
        el.style.setProperty('--dr-tooltip-opacity', '1');
        el.style.setProperty('--dr-anim-scale', '0.5');
        break;
      case 'engaged':
        el.style.setProperty('--dr-anim-speed', '0.8');
        el.style.setProperty('--dr-anim-scale', '1');
        break;
      case 'celebrating':
        el.style.setProperty('--dr-anim-scale', '1.2');
        break;
      default:
        el.style.setProperty('--dr-anim-speed', '1');
        el.style.setProperty('--dr-anim-scale', '1');
        el.style.setProperty('--dr-font-scale', '1');
        el.style.setProperty('--dr-tooltip-opacity', '0');
        el.style.setProperty('--dr-contrast-boost', '0');
    }
  });

  return el;
}
