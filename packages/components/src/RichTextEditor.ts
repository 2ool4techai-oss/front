import { signal } from '@nexoraaidrishti/runtime';
import type { Signal } from '@nexoraaidrishti/runtime';

// ── Types ──────────────────────────────────────────────────────────────

export type RTEToolbarItem = 'bold' | 'italic' | 'underline' | 'h1' | 'h2' | 'link' | 'ul' | 'ol' | 'code' | 'blockquote';

export interface RTEOptions {
  initialValue?: string;
  placeholder?:  string;
  toolbar?:      RTEToolbarItem[];
  onChange?:     (html: string) => void;
  minHeight?:    string;
  maxHeight?:    string;
  readonly?:     boolean;
}

export interface RTEHandle {
  readonly value: Signal<string>;
  getValue(): string;
  setValue(html: string): void;
  focus(): void;
  blur(): void;
  insertText(text: string): void;
  destroy(): void;
  mount(container: HTMLElement): void;
}

// ── CSS injection ──────────────────────────────────────────────────────

let _rteStylesInjected = false;
function injectRTEStyles(): void {
  if (_rteStylesInjected || typeof document === 'undefined') return;
  _rteStylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
.dr-rte{display:flex;flex-direction:column;border:1px solid var(--dr-color-border,rgba(255,255,255,.1));border-radius:8px;overflow:hidden;background:var(--dr-color-surface,#0d0d1a)}
.dr-rte__toolbar{display:flex;flex-wrap:wrap;gap:2px;padding:6px 8px;border-bottom:1px solid var(--dr-color-border,rgba(255,255,255,.1));background:rgba(255,255,255,.03)}
.dr-rte__btn{padding:4px 8px;border:1px solid transparent;border-radius:4px;background:transparent;color:inherit;font-size:13px;cursor:pointer;line-height:1}
.dr-rte__btn:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.15)}
.dr-rte__content{flex:1;padding:12px;outline:none;overflow-y:auto;font-size:14px;line-height:1.6}
.dr-rte__content:empty::before{content:attr(data-placeholder);color:var(--dr-color-text-muted,#64748b);pointer-events:none}
`;
  document.head.appendChild(style);
}

// ── createRTE ─────────────────────────────────────────────────────────

const DEFAULT_TOOLBAR: RTEToolbarItem[] = ['bold', 'italic', 'underline', 'h1', 'h2', 'link', 'ul', 'ol', 'code', 'blockquote'];

export function createRTE(opts?: RTEOptions): RTEHandle {
  injectRTEStyles();

  const initialValue = opts?.initialValue ?? '';
  const value = signal<string>(initialValue);

  let wrapEl:   HTMLElement | null = null;
  let editorEl: HTMLElement | null = null;
  let parentEl: HTMLElement | null = null;

  function execCmd(cmd: string, arg?: string): void {
    if (typeof document === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand(cmd, false, arg);
    editorEl?.focus();
  }

  function handleToolbarAction(item: RTEToolbarItem): void {
    switch (item) {
      case 'bold':       execCmd('bold');                      break;
      case 'italic':     execCmd('italic');                    break;
      case 'underline':  execCmd('underline');                 break;
      case 'h1':         execCmd('formatBlock', '<h1>');       break;
      case 'h2':         execCmd('formatBlock', '<h2>');       break;
      case 'ul':         execCmd('insertUnorderedList');       break;
      case 'ol':         execCmd('insertOrderedList');         break;
      case 'code':       execCmd('formatBlock', '<pre>');      break;
      case 'blockquote': execCmd('formatBlock', '<blockquote>'); break;
      case 'link': {
        const url = prompt('Enter URL:');
        if (url) execCmd('createLink', url);
        break;
      }
    }
  }

  const TOOLBAR_LABELS: Record<RTEToolbarItem, string> = {
    bold:       'B',
    italic:     'I',
    underline:  'U',
    h1:         'H1',
    h2:         'H2',
    link:       '🔗',
    ul:         '• List',
    ol:         '1. List',
    code:       '</>',
    blockquote: '"',
  };

  function mount(container: HTMLElement): void {
    parentEl = container;

    wrapEl = document.createElement('div');
    wrapEl.className = 'dr-rte';

    const toolbarItems = opts?.toolbar ?? DEFAULT_TOOLBAR;

    if (toolbarItems.length > 0) {
      const toolbarEl = document.createElement('div');
      toolbarEl.className = 'dr-rte__toolbar';

      toolbarItems.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dr-rte__btn';
        btn.textContent = TOOLBAR_LABELS[item];
        btn.setAttribute('data-cmd', item);
        btn.title = item;
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault(); // prevent blur
          handleToolbarAction(item);
        });
        toolbarEl.appendChild(btn);
      });

      wrapEl.appendChild(toolbarEl);
    }

    editorEl = document.createElement('div');
    editorEl.className = 'dr-rte__content';
    editorEl.setAttribute('contenteditable', opts?.readonly ? 'false' : 'true');

    if (opts?.placeholder !== undefined) {
      editorEl.setAttribute('data-placeholder', opts.placeholder);
    }

    if (opts?.minHeight !== undefined) {
      editorEl.style.minHeight = opts.minHeight;
    }
    if (opts?.maxHeight !== undefined) {
      editorEl.style.maxHeight = opts.maxHeight;
    }

    editorEl.innerHTML = initialValue;

    editorEl.addEventListener('input', () => {
      const html = editorEl!.innerHTML;
      value.set(html);
      if (opts?.onChange !== undefined) opts.onChange(html);
    });

    wrapEl.appendChild(editorEl);
    container.appendChild(wrapEl);
  }

  function getValue(): string {
    return editorEl ? editorEl.innerHTML : value();
  }

  function setValue(html: string): void {
    if (editorEl) {
      editorEl.innerHTML = html;
    }
    value.set(html);
    if (opts?.onChange !== undefined) opts.onChange(html);
  }

  function focus(): void {
    editorEl?.focus();
  }

  function blur(): void {
    editorEl?.blur();
  }

  function insertText(text: string): void {
    if (typeof document === 'undefined') return;
    editorEl?.focus();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand('insertText', false, text);
  }

  function destroy(): void {
    if (wrapEl && parentEl) {
      parentEl.removeChild(wrapEl);
    }
    wrapEl   = null;
    editorEl = null;
    parentEl = null;
  }

  return { value, getValue, setValue, focus, blur, insertText, destroy, mount };
}
