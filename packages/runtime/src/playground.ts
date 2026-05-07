import { signal, effect } from './signal.js';
import { getStories } from './story.js';
import type { StoryDefinition } from './story.js';

export interface PlaygroundOptions {
  /** Mount point. Defaults to document.body */
  container?: HTMLElement;
  /** Theme: 'light' | 'dark'. Default: 'dark' */
  theme?: 'light' | 'dark';
  /** Show emotion state selector. Default: true */
  showEmotionSelector?: boolean;
}

const EMOTIONS = ['calm', 'engaged', 'focused', 'frustrated', 'confused', 'bored', 'celebrating'] as const;

const PLAYGROUND_CSS = `
#dr-playground-root {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
  z-index: 999999;
  background: #0d0d0f;
  color: #e2e8f0;
  box-sizing: border-box;
}
#dr-playground-root *, #dr-playground-root *::before, #dr-playground-root *::after {
  box-sizing: inherit;
}
.dr-pg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #111114;
  border-bottom: 1px solid #2d2d3a;
  flex-shrink: 0;
}
.dr-pg-title {
  font-size: 14px;
  font-weight: 700;
  color: #a78bfa;
  letter-spacing: 0.05em;
}
.dr-pg-title span {
  color: #e2e8f0;
}
.dr-pg-header-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dr-pg-emotion-select {
  background: #1e1e2e;
  border: 1px solid #3d3d5c;
  color: #e2e8f0;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dr-pg-close-btn {
  background: transparent;
  border: 1px solid #3d3d5c;
  color: #94a3b8;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}
.dr-pg-close-btn:hover {
  background: #3d3d5c;
  color: #e2e8f0;
}
.dr-pg-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.dr-pg-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #111114;
  border-right: 1px solid #2d2d3a;
  overflow-y: auto;
  padding: 8px 0;
}
.dr-pg-sidebar-section {
  padding: 6px 12px 4px 12px;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.dr-pg-story-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  cursor: pointer;
  color: #94a3b8;
  user-select: none;
  transition: background 0.1s, color 0.1s;
  font-weight: 600;
}
.dr-pg-story-item:hover {
  background: #1e1e2e;
  color: #c4b5fd;
}
.dr-pg-story-item.active {
  color: #a78bfa;
  background: #1e1e2e;
}
.dr-pg-story-arrow {
  display: inline-block;
  font-size: 10px;
  transition: transform 0.15s;
  color: #4a5568;
}
.dr-pg-story-arrow.open {
  transform: rotate(90deg);
  color: #a78bfa;
}
.dr-pg-variant-list {
  display: none;
  padding-left: 0;
}
.dr-pg-variant-list.open {
  display: block;
}
.dr-pg-variant-item {
  padding: 5px 12px 5px 28px;
  cursor: pointer;
  color: #64748b;
  user-select: none;
  transition: background 0.1s, color 0.1s;
  font-size: 12px;
  font-weight: 400;
}
.dr-pg-variant-item:hover {
  background: #1a1a2e;
  color: #a78bfa;
}
.dr-pg-variant-item.active {
  color: #c4b5fd;
  background: #1a1a2e;
}
.dr-pg-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0d0d0f;
}
.dr-pg-canvas-header {
  padding: 10px 16px 6px 16px;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-bottom: 1px solid #1e1e2e;
  flex-shrink: 0;
}
.dr-pg-canvas {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
.dr-pg-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #4a5568;
  font-size: 14px;
}
.dr-pg-variants-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.dr-pg-variant-card {
  background: #111114;
  border: 1px solid #2d2d3a;
  border-radius: 8px;
  padding: 12px;
  min-width: 160px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.dr-pg-variant-card:hover {
  border-color: #4a4a7a;
}
.dr-pg-variant-card.active {
  border-color: #a78bfa;
  box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.15);
}
.dr-pg-variant-label {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  margin-bottom: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.dr-pg-variant-render {
  min-height: 40px;
}
.dr-pg-props-panel {
  flex-shrink: 0;
  border-top: 1px solid #2d2d3a;
  background: #111114;
  max-height: 220px;
  overflow-y: auto;
}
.dr-pg-props-header {
  padding: 8px 16px 4px 16px;
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.dr-pg-props-table {
  padding: 6px 16px 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dr-pg-prop-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dr-pg-prop-name {
  width: 120px;
  flex-shrink: 0;
  color: #7dd3fc;
  font-size: 12px;
  font-weight: 600;
}
.dr-pg-prop-input {
  flex: 1;
  background: #1e1e2e;
  border: 1px solid #3d3d5c;
  color: #e2e8f0;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
}
.dr-pg-prop-input:focus {
  border-color: #a78bfa;
}
.dr-pg-prop-select {
  flex: 1;
  background: #1e1e2e;
  border: 1px solid #3d3d5c;
  color: #e2e8f0;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
}
.dr-pg-prop-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #a78bfa;
}
.dr-pg-no-story {
  color: #4a5568;
  font-size: 13px;
  padding: 12px 16px;
}

/* Light theme overrides */
#dr-playground-root.dr-theme-light {
  background: #f8fafc;
  color: #1e293b;
}
#dr-playground-root.dr-theme-light .dr-pg-header,
#dr-playground-root.dr-theme-light .dr-pg-sidebar,
#dr-playground-root.dr-theme-light .dr-pg-props-panel {
  background: #f1f5f9;
  border-color: #e2e8f0;
}
#dr-playground-root.dr-theme-light .dr-pg-story-item,
#dr-playground-root.dr-theme-light .dr-pg-variant-item {
  color: #475569;
}
#dr-playground-root.dr-theme-light .dr-pg-story-item:hover,
#dr-playground-root.dr-theme-light .dr-pg-variant-item:hover {
  background: #e2e8f0;
  color: #7c3aed;
}
#dr-playground-root.dr-theme-light .dr-pg-story-item.active,
#dr-playground-root.dr-theme-light .dr-pg-variant-item.active {
  color: #7c3aed;
  background: #ede9fe;
}
#dr-playground-root.dr-theme-light .dr-pg-variant-card {
  background: #f8fafc;
  border-color: #e2e8f0;
}
#dr-playground-root.dr-theme-light .dr-pg-variant-card.active {
  border-color: #7c3aed;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.1);
}
#dr-playground-root.dr-theme-light .dr-pg-prop-input,
#dr-playground-root.dr-theme-light .dr-pg-prop-select,
#dr-playground-root.dr-theme-light .dr-pg-emotion-select {
  background: #fff;
  border-color: #cbd5e1;
  color: #1e293b;
}
`;

function injectStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dr-playground-css')) return;
  const style = document.createElement('style');
  style.id = 'dr-playground-css';
  style.textContent = PLAYGROUND_CSS;
  document.head.appendChild(style);
}

function renderComponent(
  def: StoryDefinition<Record<string, unknown>>,
  props: Record<string, unknown>,
  container: HTMLElement,
): void {
  container.innerHTML = '';
  try {
    const result = def.component(props, container);
    if (result instanceof HTMLElement) {
      container.appendChild(result);
    }
  } catch (err) {
    container.textContent = `Error: ${String(err)}`;
  }
}

function buildPropsEditor(
  props: Record<string, unknown>,
  onUpdate: (key: string, value: unknown) => void,
): HTMLElement {
  const table = document.createElement('div');
  table.className = 'dr-pg-props-table';

  for (const [key, val] of Object.entries(props)) {
    if (key === '_name' || key === '_description') continue;

    const row = document.createElement('div');
    row.className = 'dr-pg-prop-row';

    const nameEl = document.createElement('div');
    nameEl.className = 'dr-pg-prop-name';
    nameEl.textContent = key;
    row.appendChild(nameEl);

    if (typeof val === 'boolean') {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'dr-pg-prop-checkbox';
      input.checked = val;
      input.addEventListener('change', () => onUpdate(key, input.checked));
      row.appendChild(input);
    } else if (typeof val === 'string') {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'dr-pg-prop-input';
      input.value = val;
      input.addEventListener('input', () => onUpdate(key, input.value));
      row.appendChild(input);
    } else if (typeof val === 'number') {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'dr-pg-prop-input';
      input.value = String(val);
      input.addEventListener('input', () => onUpdate(key, Number(input.value)));
      row.appendChild(input);
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'dr-pg-prop-input';
      input.value = JSON.stringify(val);
      input.addEventListener('input', () => {
        try { onUpdate(key, JSON.parse(input.value)); } catch { onUpdate(key, input.value); }
      });
      row.appendChild(input);
    }

    table.appendChild(row);
  }

  return table;
}

/**
 * Launch the component playground UI.
 * Renders a full-screen sidebar + canvas layout.
 */
export function launchPlayground(opts: PlaygroundOptions = {}): () => void {
  if (typeof document === 'undefined') {
    return () => { /* no-op in non-browser environments */ };
  }

  injectStyles();

  const theme = opts.theme ?? 'dark';
  const showEmotionSelector = opts.showEmotionSelector !== false;
  const mountTarget = opts.container ?? document.body;

  const stories = getStories();

  // ── State signals ──────────────────────────────────────────────────
  const activeStory   = signal<string | null>(null);
  const activeVariant = signal<string | null>(null);
  // Mutable props for the active variant (copied on selection)
  let liveProps: Record<string, unknown> = {};

  // ── Root element ───────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'dr-playground-root';
  if (theme === 'light') root.classList.add('dr-theme-light');

  // ── Header ─────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'dr-pg-header';

  const title = document.createElement('div');
  title.className = 'dr-pg-title';
  title.innerHTML = '&#127912; DRISHTI <span>Playground</span>';
  header.appendChild(title);

  const headerControls = document.createElement('div');
  headerControls.className = 'dr-pg-header-controls';

  if (showEmotionSelector) {
    const emotionLabel = document.createElement('span');
    emotionLabel.style.cssText = 'color: #64748b; font-size: 12px;';
    emotionLabel.textContent = 'Emotion:';
    headerControls.appendChild(emotionLabel);

    const emotionSelect = document.createElement('select');
    emotionSelect.className = 'dr-pg-emotion-select';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '— none —';
    emotionSelect.appendChild(noneOpt);
    for (const em of EMOTIONS) {
      const opt = document.createElement('option');
      opt.value = em;
      opt.textContent = em;
      emotionSelect.appendChild(opt);
    }
    emotionSelect.addEventListener('change', () => {
      if (emotionSelect.value) {
        canvasArea.dataset['emotion'] = emotionSelect.value;
      } else {
        delete canvasArea.dataset['emotion'];
      }
    });
    headerControls.appendChild(emotionSelect);
  }

  const closeBtn = document.createElement('button');
  closeBtn.className = 'dr-pg-close-btn';
  closeBtn.title = 'Close playground';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => cleanup());
  headerControls.appendChild(closeBtn);

  header.appendChild(headerControls);
  root.appendChild(header);

  // ── Body ───────────────────────────────────────────────────────────
  const body = document.createElement('div');
  body.className = 'dr-pg-body';

  // ── Sidebar ────────────────────────────────────────────────────────
  const sidebar = document.createElement('div');
  sidebar.className = 'dr-pg-sidebar';

  const sidebarSection = document.createElement('div');
  sidebarSection.className = 'dr-pg-sidebar-section';
  sidebarSection.textContent = 'Components';
  sidebar.appendChild(sidebarSection);

  // Track open/closed state per story
  const openStates = new Map<string, boolean>();

  function buildSidebar(): void {
    // Remove all children except the section header
    while (sidebar.childNodes.length > 1) {
      sidebar.removeChild(sidebar.lastChild!);
    }

    if (stories.size === 0) {
      const empty = document.createElement('div');
      empty.className = 'dr-pg-no-story';
      empty.textContent = 'No stories registered.';
      sidebar.appendChild(empty);
      return;
    }

    for (const [storyName, storyDef] of stories) {
      const isOpen = openStates.get(storyName) ?? false;
      const isActive = activeStory() === storyName;

      const storyItem = document.createElement('div');
      storyItem.className = 'dr-pg-story-item' + (isActive ? ' active' : '');

      const arrow = document.createElement('span');
      arrow.className = 'dr-pg-story-arrow' + (isOpen ? ' open' : '');
      arrow.textContent = '▶';
      storyItem.appendChild(arrow);

      const label = document.createElement('span');
      label.textContent = storyName;
      storyItem.appendChild(label);

      storyItem.addEventListener('click', () => {
        const nowOpen = !openStates.get(storyName);
        openStates.set(storyName, nowOpen);
        activeStory.set(storyName);
        if (nowOpen) {
          const variantNames = Object.keys(storyDef.variants);
          if (variantNames.length > 0 && activeVariant() === null) {
            activeVariant.set(variantNames[0]!);
          }
        }
      });

      sidebar.appendChild(storyItem);

      const variantList = document.createElement('div');
      variantList.className = 'dr-pg-variant-list' + (isOpen ? ' open' : '');

      for (const variantName of Object.keys(storyDef.variants)) {
        const variantItem = document.createElement('div');
        const isVActive = isActive && activeVariant() === variantName;
        variantItem.className = 'dr-pg-variant-item' + (isVActive ? ' active' : '');
        variantItem.textContent = variantName;
        variantItem.addEventListener('click', (e) => {
          e.stopPropagation();
          activeStory.set(storyName);
          activeVariant.set(variantName);
          openStates.set(storyName, true);
        });
        variantList.appendChild(variantItem);
      }

      sidebar.appendChild(variantList);
    }
  }

  // ── Main area ──────────────────────────────────────────────────────
  const main = document.createElement('div');
  main.className = 'dr-pg-main';

  const canvasHeader = document.createElement('div');
  canvasHeader.className = 'dr-pg-canvas-header';
  canvasHeader.textContent = 'Canvas';
  main.appendChild(canvasHeader);

  const canvasArea = document.createElement('div');
  canvasArea.className = 'dr-pg-canvas';
  main.appendChild(canvasArea);

  const propsPanel = document.createElement('div');
  propsPanel.className = 'dr-pg-props-panel';

  const propsHeader = document.createElement('div');
  propsHeader.className = 'dr-pg-props-header';
  propsHeader.textContent = 'Props Editor';
  propsPanel.appendChild(propsHeader);

  main.appendChild(propsPanel);

  // ── Render canvas ─────────────────────────────────────────────────
  function renderCanvas(): void {
    canvasArea.innerHTML = '';

    // Remove old props editor content (keep header)
    while (propsPanel.childNodes.length > 1) {
      propsPanel.removeChild(propsPanel.lastChild!);
    }

    const storyName = activeStory();
    if (storyName === null) {
      const empty = document.createElement('div');
      empty.className = 'dr-pg-empty';
      empty.textContent = 'Select a component from the sidebar';
      canvasArea.appendChild(empty);
      return;
    }

    const storyDef = stories.get(storyName);
    if (!storyDef) return;

    const grid = document.createElement('div');
    grid.className = 'dr-pg-variants-grid';

    const variantEntries = Object.entries(storyDef.variants);
    const activeVar = activeVariant();

    // Card render map — keyed by variant name, to re-render on prop change
    const cardRenderMap = new Map<string, HTMLElement>();

    for (const [variantName, variantProps] of variantEntries) {
      const card = document.createElement('div');
      card.className = 'dr-pg-variant-card' + (activeVar === variantName ? ' active' : '');

      const labelEl = document.createElement('div');
      labelEl.className = 'dr-pg-variant-label';
      labelEl.textContent = variantName;
      card.appendChild(labelEl);

      const renderSlot = document.createElement('div');
      renderSlot.className = 'dr-pg-variant-render';

      const propsForVariant: Record<string, unknown> =
        activeVar === variantName && Object.keys(liveProps).length > 0
          ? { ...liveProps }
          : { ...(variantProps as Record<string, unknown>) };

      renderComponent(storyDef, propsForVariant, renderSlot);
      card.appendChild(renderSlot);
      cardRenderMap.set(variantName, renderSlot);

      card.addEventListener('click', () => {
        activeVariant.set(variantName);
      });

      grid.appendChild(card);
    }

    canvasArea.appendChild(grid);

    // Props editor for active variant
    if (activeVar !== null) {
      const variantPropsRaw = storyDef.variants[activeVar];
      if (variantPropsRaw !== undefined) {
        // Merge with liveProps if same variant
        if (Object.keys(liveProps).length === 0) {
          liveProps = { ...(variantPropsRaw as Record<string, unknown>) };
        }

        const editor = buildPropsEditor(liveProps, (key, value) => {
          liveProps[key] = value;
          // Re-render the active variant card
          const slot = cardRenderMap.get(activeVar);
          if (slot) {
            renderComponent(storyDef, { ...liveProps }, slot);
          }
        });

        propsPanel.appendChild(editor);
      }
    }
  }

  // ── Effects ────────────────────────────────────────────────────────
  const stopSidebarEffect = effect(() => {
    activeStory();
    activeVariant();
    buildSidebar();
  });

  const stopCanvasEffect = effect(() => {
    const story = activeStory();
    const variant = activeVariant();

    // Reset liveProps when variant changes
    if (story !== null && variant !== null) {
      const def = stories.get(story);
      if (def) {
        const raw = def.variants[variant];
        if (raw !== undefined) {
          liveProps = { ...(raw as Record<string, unknown>) };
        }
      }
    } else {
      liveProps = {};
    }

    renderCanvas();
  });

  // ── Assemble ───────────────────────────────────────────────────────
  body.appendChild(sidebar);
  body.appendChild(main);
  root.appendChild(body);
  mountTarget.appendChild(root);

  // Auto-select first story if any
  const firstEntry = stories.entries().next().value;
  if (firstEntry) {
    const [firstStoryName, firstStoryDef] = firstEntry as [string, StoryDefinition<Record<string, unknown>>];
    openStates.set(firstStoryName, true);
    activeStory.set(firstStoryName);
    const firstVariantName = Object.keys(firstStoryDef.variants)[0];
    if (firstVariantName !== undefined) {
      activeVariant.set(firstVariantName);
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────
  function cleanup(): void {
    stopSidebarEffect();
    stopCanvasEffect();
    if (root.parentNode) {
      root.parentNode.removeChild(root);
    }
    const styleEl = document.getElementById('dr-playground-css');
    if (styleEl) styleEl.parentNode?.removeChild(styleEl);
  }

  return cleanup;
}
