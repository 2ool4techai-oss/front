import { signal, effect } from '@nexoraaidrishti/runtime';
import type { Signal } from '@nexoraaidrishti/runtime';

export interface AccordionItem {
  key:       string;
  title:     string;
  content:   HTMLElement | string | (() => HTMLElement);
  icon?:     string;
  disabled?: boolean;
  badge?:    string;
}

export interface AccordionProps {
  items:      AccordionItem[];
  multiple?:  boolean;   // allow multiple open at once
  open?:      Signal<string[]>;
  onChange?:  (keys: string[]) => void;
  class?:     string;
  flush?:     boolean;   // no border/radius — plain separator style
}

injectAccordionStyles();

export function Accordion(props: AccordionProps): HTMLDivElement {
  const _open = props.open ?? signal<string[]>([]);
  const rendered = new Set<string>();

  const root = document.createElement('div');
  root.className = `dr-accordion${props.flush ? ' dr-accordion--flush' : ''}${props.class ? ` ${props.class}` : ''}`;

  props.items.forEach((item, i) => {
    const wrap = document.createElement('div');
    wrap.className = `dr-accordion__item${item.disabled ? ' dr-accordion__item--disabled' : ''}`;
    if (i > 0) wrap.classList.add('dr-accordion__item--bordered');

    // ── Header ─────────────────────────────────────────────────────
    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'dr-accordion__header';
    header.setAttribute('aria-expanded', 'false');
    header.setAttribute('aria-controls', `dr-acc-body-${item.key}`);
    header.id = `dr-acc-header-${item.key}`;
    if (item.disabled) header.disabled = true;

    if (item.icon) {
      const ic = document.createElement('span');
      ic.className = 'dr-accordion__icon';
      ic.innerHTML = item.icon;
      header.appendChild(ic);
    }

    const titleSpan = document.createElement('span');
    titleSpan.className = 'dr-accordion__title';
    titleSpan.textContent = item.title;
    header.appendChild(titleSpan);

    if (item.badge) {
      const badge = document.createElement('span');
      badge.className = 'dr-accordion__badge';
      badge.textContent = item.badge;
      header.appendChild(badge);
    }

    const chevron = document.createElement('span');
    chevron.className = 'dr-accordion__chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.innerHTML = `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;
    header.appendChild(chevron);

    // ── Body ───────────────────────────────────────────────────────
    const bodyWrap = document.createElement('div');
    bodyWrap.className = 'dr-accordion__body-wrap';
    bodyWrap.id = `dr-acc-body-${item.key}`;
    bodyWrap.setAttribute('role', 'region');
    bodyWrap.setAttribute('aria-labelledby', `dr-acc-header-${item.key}`);

    const body = document.createElement('div');
    body.className = 'dr-accordion__body';
    bodyWrap.appendChild(body);

    // ── Toggle ─────────────────────────────────────────────────────
    header.addEventListener('click', () => {
      if (item.disabled) return;
      const current = _open.peek();
      const isOpen  = current.includes(item.key);
      let next: string[];

      if (isOpen) {
        next = current.filter(k => k !== item.key);
      } else if (props.multiple) {
        next = [...current, item.key];
      } else {
        next = [item.key];
      }

      _open.set(next);
      props.onChange?.(next);
    });

    // ── Reactive open/close ────────────────────────────────────────
    effect(() => {
      const openKeys = _open();
      const isOpen   = openKeys.includes(item.key);

      header.setAttribute('aria-expanded', String(isOpen));
      wrap.classList.toggle('dr-accordion__item--open', isOpen);

      if (isOpen) {
        // Lazy render content
        if (!rendered.has(item.key)) {
          rendered.add(item.key);
          if (typeof item.content === 'function') {
            body.appendChild(item.content());
          } else if (typeof item.content === 'string') {
            body.innerHTML = item.content;
          } else {
            body.appendChild(item.content);
          }
        }
        bodyWrap.style.maxHeight = `${body.scrollHeight}px`;
      } else {
        bodyWrap.style.maxHeight = '0';
      }
    });

    wrap.appendChild(header);
    wrap.appendChild(bodyWrap);
    root.appendChild(wrap);
  });

  return root;
}

// ── Styles ─────────────────────────────────────────────────────────────
let _stylesInjected = false;
function injectAccordionStyles(): void {
  if (_stylesInjected || typeof document === 'undefined') return;
  _stylesInjected = true;
  const s = document.createElement('style');
  s.dataset['drComponent'] = 'accordion';
  s.textContent = `
.dr-accordion { border:1px solid var(--dr-color-border,rgba(255,255,255,.1)); border-radius:calc(var(--dr-border-radius,8px)*var(--dr-adapt-radius,1)); overflow:hidden; }
.dr-accordion--flush { border:none; border-radius:0; }
.dr-accordion__item { }
.dr-accordion__item--bordered { border-top:1px solid var(--dr-color-border,rgba(255,255,255,.08)); }
.dr-accordion__header {
  width:100%; display:flex; align-items:center; gap:10px; padding:14px 16px;
  background:transparent; border:none; cursor:pointer;
  color:var(--dr-color-text,#e2e8f0); font-family:var(--dr-font-family,system-ui); font-size:.9rem; font-weight:600; text-align:left;
  transition:background calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) ease;
}
.dr-accordion__header:hover:not(:disabled) { background:rgba(255,255,255,.04); }
.dr-accordion__header:focus-visible { outline:2px solid var(--dr-color-primary,#3b82f6); outline-offset:-2px; }
.dr-accordion__item--disabled .dr-accordion__header { opacity:.4; cursor:not-allowed; }
.dr-accordion__icon { display:flex; width:18px; height:18px; flex-shrink:0; color:var(--dr-color-text-muted,#64748b); }
.dr-accordion__icon svg { width:18px; height:18px; }
.dr-accordion__title { flex:1; }
.dr-accordion__badge { font-size:.7rem; font-weight:700; padding:2px 7px; border-radius:9999px; background:var(--dr-color-primary,#3b82f6); color:#fff; }
.dr-accordion__chevron { display:flex; flex-shrink:0; color:var(--dr-color-text-muted,#64748b); transition:transform calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)*.5) cubic-bezier(.4,0,.2,1); }
.dr-accordion__chevron svg { width:16px; height:16px; }
.dr-accordion__item--open .dr-accordion__chevron { transform:rotate(180deg); }
.dr-accordion__body-wrap { overflow:hidden; max-height:0; transition:max-height calc(var(--dr-transition-speed,300ms)*var(--dr-adapt-speed,1)) cubic-bezier(.4,0,.2,1); }
.dr-accordion__body { padding:0 16px 16px; color:var(--dr-color-text-muted,rgba(226,232,240,.75)); font-family:var(--dr-font-family,system-ui); font-size:.875rem; line-height:1.7; }
`;
  document.head.appendChild(s);
}
