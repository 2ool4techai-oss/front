import { _enableDevMode } from '@nexoraaidrishti/runtime';
import { createPanel } from './panel.js';
import type { DevToolsOptions, DevToolsHandle } from './panel.js';
import type { TimeTravelHandle } from '@nexoraaidrishti/runtime';

export type { DevToolsOptions, DevToolsHandle, TimeTravelHandle };
export { createPanel };

// ── installDevtools ────────────────────────────────────────────────────
// Call this as the very first thing in your app entry point.
//
// Usage:
//   import { installDevtools } from '@nexoraaidrishti/devtools';
//   const dt = installDevtools({ emotion: myEmotionProcessor });
//   // Ctrl+Shift+D toggles the panel

export function installDevtools(opts: DevToolsOptions = {}): DevToolsHandle {
  _enableDevMode();

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    // SSR / non-browser — return no-op handle
    return { show: () => {}, hide: () => {}, toggle: () => {}, destroy: () => {} };
  }

  const handle = createPanel(opts);

  const shortcut = (opts.shortcut ?? 'ctrl+shift+d').toLowerCase();
  const parts    = shortcut.split('+');
  const key      = parts[parts.length - 1];
  const needCtrl = parts.includes('ctrl');
  const needShift = parts.includes('shift');
  const needAlt   = parts.includes('alt');
  const needMeta  = parts.includes('meta');

  const onKey = (e: KeyboardEvent) => {
    const match =
      e.key.toLowerCase() === key &&
      e.ctrlKey  === needCtrl  &&
      e.shiftKey === needShift &&
      e.altKey   === needAlt   &&
      e.metaKey  === needMeta;
    if (match) { e.preventDefault(); handle.toggle(); }
  };

  window.addEventListener('keydown', onKey);

  const origDestroy = handle.destroy.bind(handle);
  handle.destroy = () => {
    window.removeEventListener('keydown', onKey);
    origDestroy();
  };

  return handle;
}
