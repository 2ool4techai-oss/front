import { signal, computed, effect } from '@drishti/runtime';
import type { Signal } from '@drishti/runtime';

// ── Types ──────────────────────────────────────────────────────────────

export interface Command {
  id:          string;
  label:       string;
  description?: string;
  group?:      string;
  shortcut?:   string;
  icon?:       string | HTMLElement;
  keywords?:   string[];
  disabled?:   boolean;
  action():    void;
}

export interface CommandPaletteOptions {
  commands:     Signal<Command[]> | Command[];
  placeholder?: string;
  shortcut?:    string;           // default 'mod+k'
  maxResults?:  number;
  onOpen?:      () => void;
  onClose?:     () => void;
}

export interface CommandPaletteHandle {
  open():    void;
  close():   void;
  toggle():  void;
  destroy(): void;
}

// ── Fuzzy score ────────────────────────────────────────────────────────
function fuzzyScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return q.length / t.length + 1; // exact substring scores higher
  let qi = 0, score = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) { score++; qi++; }
  }
  return qi === q.length ? score / t.length : 0;
}

function filterCommands(commands: Command[], query: string, max: number): Command[] {
  if (!query.trim()) return commands.slice(0, max);
  return commands
    .map(cmd => {
      const labelScore    = fuzzyScore(query, cmd.label);
      const keywordScore  = Math.max(0, ...(cmd.keywords ?? []).map(k => fuzzyScore(query, k)));
      const groupScore    = fuzzyScore(query, cmd.group ?? '');
      const score         = Math.max(labelScore, keywordScore * 0.8, groupScore * 0.5);
      return { cmd, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(({ cmd }) => cmd);
}

// ── Styles ─────────────────────────────────────────────────────────────
const injectStyles = (() => {
  let done = false;
  return () => {
    if (done || typeof document === 'undefined') return;
    done = true;
    const s = document.createElement('style');
    s.textContent = `
.dr-cmd-backdrop{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.4);backdrop-filter:blur(2px);display:flex;align-items:flex-start;justify-content:center;padding-top:15vh;animation:dr-cmd-bd .15s ease;}
@keyframes dr-cmd-bd{from{opacity:0}to{opacity:1}}
.dr-cmd-panel{background:var(--dr-surface,#fff);border:1px solid var(--dr-border-color,#e2e8f0);border-radius:var(--dr-border-radius,14px);box-shadow:0 24px 80px rgba(0,0,0,.25);width:min(560px,90vw);max-height:60vh;display:flex;flex-direction:column;animation:dr-cmd-in .15s cubic-bezier(.34,1.56,.64,1);overflow:hidden;}
@keyframes dr-cmd-in{from{opacity:0;transform:scale(.95)translateY(-10px)}to{opacity:1;transform:none}}
.dr-cmd-input-row{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--dr-border-color,#e2e8f0);}
.dr-cmd-search-icon{color:var(--dr-text-muted,#94a3b8);flex-shrink:0;}
.dr-cmd-input{flex:1;border:none;outline:none;font-size:16px;background:transparent;color:inherit;}
.dr-cmd-input::placeholder{color:var(--dr-text-muted,#94a3b8);}
.dr-cmd-shortcut-hint{font-size:11px;color:var(--dr-text-muted,#94a3b8);white-space:nowrap;}
.dr-cmd-results{overflow-y:auto;padding:6px;max-height:calc(60vh - 60px);}
.dr-cmd-group{padding:6px 10px 3px;font-size:11px;font-weight:600;color:var(--dr-text-muted,#94a3b8);text-transform:uppercase;letter-spacing:.06em;}
.dr-cmd-item{display:flex;align-items:center;gap:10px;padding:10px 10px;border-radius:var(--dr-border-radius,8px);cursor:pointer;transition:background .1s;user-select:none;}
.dr-cmd-item:hover,.dr-cmd-item.focused{background:var(--dr-surface-high,#f1f5f9);}
.dr-cmd-item.focused{outline:2px solid var(--dr-primary,#6366f1);outline-offset:-2px;}
.dr-cmd-item.disabled{opacity:.4;cursor:not-allowed;}
.dr-cmd-icon{width:20px;height:20px;display:flex;align-items:center;justify-content:center;color:var(--dr-text-muted,#94a3b8);flex-shrink:0;font-size:14px;}
.dr-cmd-text{flex:1;min-width:0;}
.dr-cmd-label{font-size:14px;font-weight:500;}
.dr-cmd-desc{font-size:12px;color:var(--dr-text-muted,#94a3b8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dr-cmd-shortcut{display:flex;gap:3px;flex-shrink:0;}
.dr-cmd-kbd{font-size:11px;padding:1px 5px;background:var(--dr-surface-high,#f1f5f9);border:1px solid var(--dr-border-color,#e2e8f0);border-radius:4px;font-family:monospace;color:var(--dr-text-muted,#64748b);}
.dr-cmd-empty{text-align:center;padding:24px;color:var(--dr-text-muted,#94a3b8);font-size:14px;}
.dr-cmd-footer{padding:8px 14px;border-top:1px solid var(--dr-border-color,#e2e8f0);display:flex;gap:12px;font-size:11px;color:var(--dr-text-muted,#94a3b8);}
.dr-cmd-footer kbd{padding:1px 4px;background:var(--dr-surface-high,#f1f5f9);border:1px solid var(--dr-border-color,#e2e8f0);border-radius:3px;font-size:10px;}
    `;
    document.head.appendChild(s);
  };
})();

// ── CommandPalette ─────────────────────────────────────────────────────
export function CommandPalette(opts: CommandPaletteOptions): CommandPaletteHandle {
  injectStyles();

  const commandsSignal = typeof opts.commands === 'function'
    ? opts.commands as Signal<Command[]>
    : signal(opts.commands as Command[]);

  const query$    = signal('');
  const focused$  = signal(0);
  const isOpen$   = signal(false);
  const maxResults = opts.maxResults ?? 20;

  const filtered$ = computed(() => {
    return filterCommands(commandsSignal(), query$(), maxResults);
  });

  let backdrop: HTMLElement | null = null;
  let disposers: Array<() => void> = [];

  // ── Build UI ──────────────────────────────────────────────────────────
  const buildUI = () => {
    const bd = document.createElement('div');
    bd.className = 'dr-cmd-backdrop';

    const panel = document.createElement('div');
    panel.className = 'dr-cmd-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Command palette');

    // Input row
    const inputRow = document.createElement('div');
    inputRow.className = 'dr-cmd-input-row';

    const searchIcon = document.createElement('span');
    searchIcon.className = 'dr-cmd-search-icon';
    searchIcon.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;

    const input = document.createElement('input');
    input.className = 'dr-cmd-input';
    input.placeholder = opts.placeholder ?? 'Type a command…';
    input.setAttribute('aria-label', 'Search commands');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');

    input.addEventListener('input', () => {
      query$.set(input.value);
      focused$.set(0);
    });

    const hint = document.createElement('span');
    hint.className = 'dr-cmd-shortcut-hint';
    hint.textContent = 'ESC to close';

    inputRow.append(searchIcon, input, hint);
    panel.appendChild(inputRow);

    // Results
    const results = document.createElement('div');
    results.className = 'dr-cmd-results';
    results.setAttribute('role', 'listbox');
    panel.appendChild(results);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'dr-cmd-footer';
    footer.innerHTML = '<kbd>↑↓</kbd> Navigate &nbsp; <kbd>↵</kbd> Select &nbsp; <kbd>ESC</kbd> Close';
    panel.appendChild(footer);

    bd.appendChild(panel);

    // ── Render results ────────────────────────────────────────────────
    const renderResults = () => {
      results.innerHTML = '';
      const cmds = filtered$();
      const fi   = focused$();

      if (cmds.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'dr-cmd-empty';
        empty.textContent = query$.peek() ? `No results for "${query$.peek()}"` : 'No commands available';
        results.appendChild(empty);
        return;
      }

      let lastGroup = '';
      cmds.forEach((cmd, idx) => {
        if (cmd.group && cmd.group !== lastGroup) {
          const grp = document.createElement('div');
          grp.className = 'dr-cmd-group';
          grp.textContent = cmd.group;
          results.appendChild(grp);
          lastGroup = cmd.group;
        }

        const item = document.createElement('div');
        item.className = ['dr-cmd-item', idx === fi ? 'focused' : '', cmd.disabled ? 'disabled' : ''].filter(Boolean).join(' ');
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(idx === fi));

        if (cmd.icon) {
          const iconEl = document.createElement('div');
          iconEl.className = 'dr-cmd-icon';
          if (typeof cmd.icon === 'string') iconEl.textContent = cmd.icon;
          else iconEl.appendChild(cmd.icon);
          item.appendChild(iconEl);
        }

        const text = document.createElement('div');
        text.className = 'dr-cmd-text';
        const lbl = document.createElement('div');
        lbl.className = 'dr-cmd-label';
        lbl.textContent = cmd.label;
        text.appendChild(lbl);
        if (cmd.description) {
          const desc = document.createElement('div');
          desc.className = 'dr-cmd-desc';
          desc.textContent = cmd.description;
          text.appendChild(desc);
        }
        item.appendChild(text);

        if (cmd.shortcut) {
          const sc = document.createElement('div');
          sc.className = 'dr-cmd-shortcut';
          for (const part of cmd.shortcut.split('+')) {
            const kbd = document.createElement('span');
            kbd.className = 'dr-cmd-kbd';
            kbd.textContent = part === 'mod' ? (navigator.platform.includes('Mac') ? '⌘' : 'Ctrl') : part;
            sc.appendChild(kbd);
          }
          item.appendChild(sc);
        }

        if (!cmd.disabled) {
          item.addEventListener('mouseenter', () => focused$.set(idx));
          item.addEventListener('click', () => execute(cmd));
        }

        results.appendChild(item);
      });

      // Scroll focused item into view
      const focusedEl = results.querySelector('.focused') as HTMLElement | null;
      focusedEl?.scrollIntoView({ block: 'nearest' });
    };

    const execute = (cmd: Command) => {
      if (cmd.disabled) return;
      close();
      requestAnimationFrame(() => cmd.action());
    };

    disposers.push(effect(() => { filtered$(); focused$(); renderResults(); }));

    // Keyboard navigation
    const onKey = (e: KeyboardEvent) => {
      const cmds = filtered$.peek();
      switch (e.key) {
        case 'Escape': close(); break;
        case 'ArrowDown':
          e.preventDefault();
          focused$.set(Math.min(focused$.peek() + 1, cmds.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          focused$.set(Math.max(focused$.peek() - 1, 0));
          break;
        case 'Enter': {
          const cmd = cmds[focused$.peek()];
          if (cmd) execute(cmd);
          break;
        }
      }
    };
    document.addEventListener('keydown', onKey);
    disposers.push(() => document.removeEventListener('keydown', onKey));

    requestAnimationFrame(() => input.focus());
    return bd;
  };

  const open = () => {
    if (backdrop) return;
    query$.set('');
    focused$.set(0);
    backdrop = buildUI();
    document.body.appendChild(backdrop);
    opts.onOpen?.();

    const onBdClick = (e: MouseEvent) => {
      if (e.target === backdrop) close();
    };
    backdrop.addEventListener('mousedown', onBdClick);
    disposers.push(() => backdrop?.removeEventListener('mousedown', onBdClick));

    isOpen$.set(true);
  };

  const close = () => {
    if (!backdrop) return;
    for (const d of disposers.splice(0)) d();
    backdrop.remove();
    backdrop = null;
    isOpen$.set(false);
    opts.onClose?.();
  };

  // ── Global shortcut ───────────────────────────────────────────────────
  const shortcut = (opts.shortcut ?? 'mod+k').toLowerCase();
  const parts    = shortcut.split('+');
  const key      = parts[parts.length - 1]!;
  const needMod  = parts.includes('mod');
  const needShift = parts.includes('shift');

  const onGlobalKey = (e: KeyboardEvent) => {
    const modPressed = e.ctrlKey || e.metaKey;
    if (e.key.toLowerCase() === key && modPressed === needMod && e.shiftKey === needShift) {
      e.preventDefault();
      isOpen$.peek() ? close() : open();
    }
  };
  window.addEventListener('keydown', onGlobalKey);

  return {
    open,
    close,
    toggle: () => isOpen$.peek() ? close() : open(),
    destroy: () => {
      close();
      window.removeEventListener('keydown', onGlobalKey);
    },
  };
}

// ── installCommandPalette ──────────────────────────────────────────────
// Module-level singleton — installs the palette globally.
export function installCommandPalette(
  commands: Command[] | Signal<Command[]>,
  opts: Omit<CommandPaletteOptions, 'commands'> = {},
): CommandPaletteHandle {
  return CommandPalette({ commands, ...opts });
}
