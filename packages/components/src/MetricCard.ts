import { signal, effect, h, text } from '@drishti/runtime';
import type { EmotionState } from '@drishti/runtime';

export interface MetricCardProps {
  label: string;
  value: () => number | string;
  unit?: string;
  trend?: () => number;
  format?: (v: number | string) => string;
  emotion?: () => EmotionState;
}

export function MetricCard(props: MetricCardProps): HTMLElement {
  const fmt = props.format ?? (v => String(v));
  const celebrateSignal = signal(false);

  const card = h('div', {
    class: 'dr-metric-card',
    style: {
      padding: 'var(--dr-spacing-unit, 8px) calc(var(--dr-spacing-unit, 8px) * 2)',
      background: '#fff',
      borderRadius: 'var(--dr-border-radius, 6px)',
      boxShadow: 'var(--dr-shadow, 0 2px 8px rgba(0,0,0,.12))',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform var(--dr-transition-speed, 200ms) var(--dr-transition-ease, ease)',
    },
  });

  const label = h('p', {
    style: {
      margin: '0 0 4px',
      fontSize: '0.75rem',
      fontWeight: '500',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#666',
      fontFamily: 'var(--dr-font-family, system-ui)',
    },
  });
  label.textContent = props.label;

  const valueEl = h('p', {
    style: {
      margin: '0',
      fontSize: '2rem',
      fontWeight: '700',
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--dr-color-primary, #2D6BE4)',
      fontFamily: 'var(--dr-font-family, system-ui)',
      transition: 'color var(--dr-transition-speed, 200ms)',
    },
  });

  const unitEl = props.unit ? h('span', { style: { fontSize: '0.875rem', fontWeight: '400', marginLeft: '2px', color: '#888' } }) : null;
  if (unitEl) unitEl.textContent = props.unit ?? '';

  const trendEl = h('div', {
    style: {
      marginTop: '6px',
      fontSize: '0.8rem',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    },
  });

  const shimmer = h('div', {
    style: {
      position: 'absolute',
      inset: '0',
      background: 'linear-gradient(135deg, transparent 40%, rgba(255,255,255,.4) 50%, transparent 60%)',
      transform: 'translateX(-100%)',
      transition: 'transform 0.6s ease',
      pointerEvents: 'none',
    },
  });

  effect(() => {
    const v = props.value();
    valueEl.textContent = fmt(v);
    if (unitEl) valueEl.appendChild(unitEl);
  });

  if (props.trend) {
    effect(() => {
      const t = props.trend!();
      trendEl.innerHTML = '';
      const arrow = t > 0 ? '↑' : t < 0 ? '↓' : '→';
      const color = t > 0 ? '#22c55e' : t < 0 ? '#ef4444' : '#888';
      const span = document.createElement('span');
      span.style.color = color;
      span.style.fontWeight = '600';
      span.textContent = `${arrow} ${Math.abs(t).toFixed(1)}%`;
      trendEl.appendChild(span);

      if (t > 0) {
        celebrateSignal.set(true);
        shimmer.style.transform = 'translateX(100%)';
        setTimeout(() => {
          shimmer.style.transform = 'translateX(-100%)';
          celebrateSignal.set(false);
        }, 800);
      }
    });
  }

  if (props.emotion) {
    effect(() => {
      const e = props.emotion!();
      if (e === 'frustrated') {
        card.style.fontSize = 'calc(var(--dr-font-size-base, 16px) * 1.1)';
        valueEl.style.color = 'var(--dr-color-accent, #E94560)';
      } else {
        card.style.fontSize = '';
        valueEl.style.color = 'var(--dr-color-primary, #2D6BE4)';
      }
    });
  }

  card.appendChild(label);
  card.appendChild(valueEl);
  if (props.trend) card.appendChild(trendEl);
  card.appendChild(shimmer);

  return card;
}
