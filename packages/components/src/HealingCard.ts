import { signal, effect, h } from '@nexoraaidrishti/runtime';
import { HealingMonitor } from '@nexoraaidrishti/runtime';
import type { HealConfig } from '@nexoraaidrishti/runtime';

export interface HealingCardProps {
  title: string;
  load: () => Promise<HTMLElement | string>;
  heal?: HealConfig;
  skeleton?: boolean;
}

export function HealingCard(props: HealingCardProps): HTMLElement {
  const cfg: HealConfig = props.heal ?? { mode: 'retry', retries: 3 };
  const status = signal<'loading' | 'ready' | 'healing' | 'failed'>('loading');

  const card = h('div', {
    style: {
      borderRadius: 'var(--dr-border-radius,6px)',
      boxShadow: 'var(--dr-shadow,0 2px 8px rgba(0,0,0,.12))',
      background: '#fff',
      overflow: 'hidden',
      position: 'relative',
      minHeight: '120px',
      fontFamily: 'var(--dr-font-family,system-ui)',
    },
  });

  const header = h('div', {
    style: {
      padding: '12px 16px',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  });
  const titleEl = document.createElement('span');
  titleEl.textContent = props.title;
  titleEl.style.cssText = 'font-weight:600;font-size:.9375rem;color:#111827;';
  header.appendChild(titleEl);

  const statusBadge = h('span', {
    style: {
      fontSize: '.7rem',
      padding: '2px 8px',
      borderRadius: '9999px',
      fontWeight: '600',
      transition: 'all var(--dr-transition-speed,200ms)',
    },
  });
  header.appendChild(statusBadge);

  const body = h('div', { style: { padding: '16px', minHeight: '80px' } });

  if (props.skeleton !== false) {
    const skeletonLines = [80, 60, 90].map(w => {
      const line = document.createElement('div');
      line.style.cssText = `height:12px;background:linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);background-size:200% 100%;border-radius:4px;margin-bottom:8px;width:${w}%;animation:dr-shimmer 1.4s infinite;`;
      return line;
    });
    skeletonLines.forEach(l => body.appendChild(l));
  }

  const healer = new HealingMonitor(cfg, card);

  healer.on(ev => {
    if (ev.type === 'error') status.set('healing');
    if (ev.type === 'recovered') status.set('ready');
    if (ev.type === 'failed') status.set('failed');
  });

  const doLoad = async () => {
    try {
      const content = await props.load();
      body.innerHTML = '';
      if (typeof content === 'string') {
        const p = document.createElement('p');
        p.style.cssText = 'margin:0;color:#374151;line-height:1.6;';
        p.textContent = content;
        body.appendChild(p);
      } else {
        body.appendChild(content);
      }
      status.set('ready');
    } catch (e) {
      await healer.handle(e, doLoad);
    }
  };

  effect(() => {
    const s = status();
    switch (s) {
      case 'loading':
        statusBadge.textContent = '⟳ Loading';
        statusBadge.style.cssText += 'background:#e0e7ff;color:#3730a3;';
        break;
      case 'ready':
        statusBadge.textContent = '✓ Ready';
        statusBadge.style.cssText = 'background:#dcfce7;color:#15803d;font-size:.7rem;padding:2px 8px;border-radius:9999px;font-weight:600;transition:all var(--dr-transition-speed,200ms);';
        break;
      case 'healing':
        statusBadge.textContent = '⟳ Healing…';
        statusBadge.style.cssText = 'background:#fef3c7;color:#92400e;font-size:.7rem;padding:2px 8px;border-radius:9999px;font-weight:600;transition:all var(--dr-transition-speed,200ms);';
        break;
      case 'failed':
        statusBadge.textContent = '✗ Failed';
        statusBadge.style.cssText = 'background:#fee2e2;color:#991b1b;font-size:.7rem;padding:2px 8px;border-radius:9999px;font-weight:600;transition:all var(--dr-transition-speed,200ms);';
        break;
    }
  });

  card.appendChild(header);
  card.appendChild(body);

  void doLoad();

  return card;
}
