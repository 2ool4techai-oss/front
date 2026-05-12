import { signal } from './signal.js';

export interface A11yViolation {
  id: string;
  severity: 'error' | 'warning' | 'info';
  element: string;
  message: string;
  wcag: string;
  suggestion: string;
}

export interface A11yReport {
  violations: A11yViolation[];
  warnings: A11yViolation[];
  passes: string[];
  score: number;
  summary: string;
}

export interface A11yAgentOptions {
  rules?: string[];
  ai?: {
    provider: 'anthropic' | 'openai' | 'ollama';
    apiKey?: string;
    model?: string;
  } | false;
  onViolation?: (v: A11yViolation) => void;
  watch?: boolean;
  watchInterval?: number;
}

export interface A11yAgentHandle {
  scan: (root?: HTMLElement | Document) => Promise<A11yReport>;
  violations: () => A11yViolation[];
  score: () => number;
  scanning: () => boolean;
  autoFix: (root?: HTMLElement | Document) => { fixed: number; skipped: number };
  stop: () => void;
  suggestAria: (element: HTMLElement) => Record<string, string>;
}

const VALID_ARIA_ROLES = new Set([
  'alert', 'alertdialog', 'application', 'article', 'banner', 'button',
  'cell', 'checkbox', 'columnheader', 'combobox', 'complementary',
  'contentinfo', 'definition', 'dialog', 'directory', 'document',
  'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading',
  'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main',
  'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox',
  'menuitemradio', 'navigation', 'none', 'note', 'option', 'presentation',
  'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
  'rowheader', 'scrollbar', 'search', 'searchbox', 'separator',
  'slider', 'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist',
  'tabpanel', 'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree',
  'treegrid', 'treeitem',
]);

function getRoot(root?: HTMLElement | Document): Document | HTMLElement {
  return root ?? (typeof document !== 'undefined' ? document.body : (null as unknown as HTMLElement));
}

function querySelectorAll(root: HTMLElement | Document, selector: string): Element[] {
  return Array.from(root.querySelectorAll(selector));
}

function runAltText(root: HTMLElement | Document, enabledRules: Set<string> | null): A11yViolation[] {
  if (enabledRules && !enabledRules.has('alt-text')) return [];
  const violations: A11yViolation[] = [];
  const imgs = querySelectorAll(root, 'img');
  for (const img of imgs) {
    if (!img.hasAttribute('alt')) {
      violations.push({
        id: 'alt-text',
        severity: 'error',
        element: img.outerHTML.slice(0, 80),
        message: 'Image is missing an alt attribute',
        wcag: 'WCAG 2.1 AA 1.1.1',
        suggestion: 'Add alt="" for decorative images or a descriptive alt text for informative images',
      });
    }
  }
  return violations;
}

function runFormLabels(root: HTMLElement | Document, enabledRules: Set<string> | null): A11yViolation[] {
  if (enabledRules && !enabledRules.has('form-labels')) return [];
  const violations: A11yViolation[] = [];
  const inputs = querySelectorAll(root, 'input, select, textarea');
  const rootNode = root instanceof Document ? root : root.ownerDocument ?? root;

  for (const input of inputs) {
    const el = input as HTMLInputElement;
    // Skip hidden inputs
    if (el.type === 'hidden') continue;

    const hasAriaLabel = el.hasAttribute('aria-label') && el.getAttribute('aria-label')!.trim() !== '';
    const hasAriaLabelledBy = el.hasAttribute('aria-labelledby');

    let hasLabel = false;
    if (el.id) {
      const label = (rootNode as Document).querySelector(`label[for="${el.id}"]`);
      if (label) hasLabel = true;
    }

    // Check if wrapped in a label
    if (!hasLabel) {
      let parent = el.parentElement;
      while (parent) {
        if (parent.tagName.toLowerCase() === 'label') {
          hasLabel = true;
          break;
        }
        parent = parent.parentElement;
      }
    }

    if (!hasAriaLabel && !hasAriaLabelledBy && !hasLabel) {
      violations.push({
        id: 'form-labels',
        severity: 'error',
        element: el.outerHTML.slice(0, 80),
        message: 'Form control is missing an associated label',
        wcag: 'WCAG 2.1 AA 1.3.1',
        suggestion: 'Add a <label> element, aria-label, or aria-labelledby attribute',
      });
    }
  }
  return violations;
}

function runButtonText(root: HTMLElement | Document, enabledRules: Set<string> | null): A11yViolation[] {
  if (enabledRules && !enabledRules.has('button-text')) return [];
  const violations: A11yViolation[] = [];
  const buttons = querySelectorAll(root, 'button');
  for (const btn of buttons) {
    const text = btn.textContent?.trim() ?? '';
    const ariaLabel = btn.getAttribute('aria-label')?.trim() ?? '';
    const ariaLabelledBy = btn.getAttribute('aria-labelledby')?.trim() ?? '';
    if (!text && !ariaLabel && !ariaLabelledBy) {
      violations.push({
        id: 'button-text',
        severity: 'error',
        element: btn.outerHTML.slice(0, 80),
        message: 'Button has no accessible text',
        wcag: 'WCAG 2.1 AA 4.1.2',
        suggestion: 'Add text content or an aria-label attribute to the button',
      });
    }
  }
  return violations;
}

function runLinkText(root: HTMLElement | Document, enabledRules: Set<string> | null): A11yViolation[] {
  if (enabledRules && !enabledRules.has('link-text')) return [];
  const violations: A11yViolation[] = [];
  const badTexts = new Set(['click here', 'here', 'read more']);
  const links = querySelectorAll(root, 'a');
  for (const a of links) {
    const text = a.textContent?.trim().toLowerCase() ?? '';
    if (!text || badTexts.has(text)) {
      violations.push({
        id: 'link-text',
        severity: 'warning',
        element: a.outerHTML.slice(0, 80),
        message: 'Link has non-descriptive text',
        wcag: 'WCAG 2.1 AA 2.4.4',
        suggestion: 'Use descriptive link text that makes sense out of context',
      });
    }
  }
  return violations;
}

function runHeadingOrder(root: HTMLElement | Document, enabledRules: Set<string> | null): A11yViolation[] {
  if (enabledRules && !enabledRules.has('heading-order')) return [];
  const violations: A11yViolation[] = [];
  const headings = querySelectorAll(root, 'h1, h2, h3, h4, h5, h6');
  let prevLevel = 0;
  for (const h of headings) {
    const level = parseInt(h.tagName[1], 10);
    if (prevLevel > 0 && level > prevLevel + 1) {
      violations.push({
        id: 'heading-order',
        severity: 'warning',
        element: h.outerHTML.slice(0, 80),
        message: `Heading level skipped from h${prevLevel} to h${level}`,
        wcag: 'WCAG 2.1 AA 1.3.1',
        suggestion: `Use h${prevLevel + 1} instead of h${level} to maintain proper heading hierarchy`,
      });
    }
    prevLevel = level;
  }
  return violations;
}

function runLangAttr(_root: HTMLElement | Document, enabledRules: Set<string> | null): A11yViolation[] {
  if (enabledRules && !enabledRules.has('lang-attr')) return [];
  if (typeof document === 'undefined') return [];
  const html = document.documentElement;
  if (!html.hasAttribute('lang') || !html.getAttribute('lang')?.trim()) {
    return [{
      id: 'lang-attr',
      severity: 'error',
      element: '<html>',
      message: 'HTML element is missing a lang attribute',
      wcag: 'WCAG 2.1 AA 3.1.1',
      suggestion: 'Add a lang attribute to the <html> element, e.g., lang="en"',
    }];
  }
  return [];
}

function runDuplicateId(root: HTMLElement | Document, enabledRules: Set<string> | null): A11yViolation[] {
  if (enabledRules && !enabledRules.has('duplicate-id')) return [];
  const violations: A11yViolation[] = [];
  const elements = querySelectorAll(root, '[id]');
  const seen = new Map<string, number>();
  for (const el of elements) {
    const id = el.getAttribute('id')!;
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }
  const reported = new Set<string>();
  for (const el of elements) {
    const id = el.getAttribute('id')!;
    if (seen.get(id)! > 1 && !reported.has(id)) {
      reported.add(id);
      violations.push({
        id: 'duplicate-id',
        severity: 'error',
        element: `[id="${id}"]`,
        message: `Multiple elements share the same id "${id}"`,
        wcag: 'WCAG 2.1 AA 4.1.1',
        suggestion: 'Ensure all id attributes are unique within the page',
      });
    }
  }
  return violations;
}

function runFocusVisible(root: HTMLElement | Document, enabledRules: Set<string> | null): A11yViolation[] {
  if (enabledRules && !enabledRules.has('focus-visible')) return [];
  if (typeof window === 'undefined' || !window.getComputedStyle) return [];
  const violations: A11yViolation[] = [];
  const interactive = querySelectorAll(root, 'a, button, input, select, textarea, [tabindex]');
  for (const el of interactive) {
    try {
      const style = window.getComputedStyle(el as HTMLElement);
      if (style.outline === 'none' || style.outline === '0px none rgb(0, 0, 0)' || style.outlineStyle === 'none') {
        const outlineWidth = style.outlineWidth;
        if (outlineWidth === '0px') {
          violations.push({
            id: 'focus-visible',
            severity: 'warning',
            element: el.outerHTML.slice(0, 80),
            message: 'Interactive element may not have a visible focus indicator',
            wcag: 'WCAG 2.1 AA 2.4.7',
            suggestion: 'Do not set outline: none without providing an alternative focus indicator',
          });
        }
      }
    } catch {
      // ignore getComputedStyle errors
    }
  }
  return violations;
}

function runAriaValid(root: HTMLElement | Document, enabledRules: Set<string> | null): A11yViolation[] {
  if (enabledRules && !enabledRules.has('aria-valid')) return [];
  const violations: A11yViolation[] = [];
  const elements = querySelectorAll(root, '[role]');
  for (const el of elements) {
    const role = el.getAttribute('role')!.trim();
    if (!VALID_ARIA_ROLES.has(role)) {
      violations.push({
        id: 'aria-valid',
        severity: 'error',
        element: el.outerHTML.slice(0, 80),
        message: `Invalid ARIA role: "${role}"`,
        wcag: 'WCAG 2.1 AA 4.1.2',
        suggestion: `Use a valid ARIA role. "${role}" is not a recognized ARIA role`,
      });
    }
  }
  return violations;
}

function runSkipLink(root: HTMLElement | Document, enabledRules: Set<string> | null): A11yViolation[] {
  if (enabledRules && !enabledRules.has('skip-link')) return [];
  if (typeof document === 'undefined') return [];
  // Look for a skip link — a link at/near the top that points to an anchor
  const links = querySelectorAll(document.body ?? root, 'a');
  const hasSkipLink = links.some(a => {
    const href = a.getAttribute('href') ?? '';
    const text = a.textContent?.toLowerCase() ?? '';
    return href.startsWith('#') && (
      text.includes('skip') || text.includes('jump') || text.includes('main content')
    );
  });
  if (!hasSkipLink) {
    return [{
      id: 'skip-link',
      severity: 'info',
      element: '<body>',
      message: 'Page has no skip navigation link',
      wcag: 'WCAG 2.1 AA 2.4.1',
      suggestion: 'Add a "Skip to main content" link as the first focusable element on the page',
    }];
  }
  return [];
}

function computeScore(allViolations: A11yViolation[]): number {
  let score = 100;
  for (const v of allViolations) {
    if (v.severity === 'error') score -= 10;
    else if (v.severity === 'warning') score -= 3;
    else if (v.severity === 'info') score -= 1;
  }
  return Math.max(0, score);
}

export function createA11yAgent(opts?: A11yAgentOptions): A11yAgentHandle {
  const enabledRules = opts?.rules ? new Set(opts.rules) : null;

  const _violations = signal<A11yViolation[]>([]);
  const _score = signal<number>(100);
  const _scanning = signal<boolean>(false);

  let watchTimer: ReturnType<typeof setInterval> | null = null;

  // Store last scan violations for autoFix
  let lastViolations: A11yViolation[] = [];

  async function scan(root?: HTMLElement | Document): Promise<A11yReport> {
    const scanRoot = getRoot(root);
    _scanning.set(true);

    const allViolations: A11yViolation[] = [
      ...runAltText(scanRoot, enabledRules),
      ...runFormLabels(scanRoot, enabledRules),
      ...runButtonText(scanRoot, enabledRules),
      ...runLinkText(scanRoot, enabledRules),
      ...runHeadingOrder(scanRoot, enabledRules),
      ...runLangAttr(scanRoot, enabledRules),
      ...runDuplicateId(scanRoot, enabledRules),
      ...runFocusVisible(scanRoot, enabledRules),
      ...runAriaValid(scanRoot, enabledRules),
      ...runSkipLink(scanRoot, enabledRules),
    ];

    if (opts?.onViolation) {
      for (const v of allViolations) {
        opts.onViolation(v);
      }
    }

    const errors = allViolations.filter(v => v.severity === 'error');
    const warnings = allViolations.filter(v => v.severity === 'warning' || v.severity === 'info');
    const score = computeScore(allViolations);

    const ruleNames = ['alt-text', 'form-labels', 'button-text', 'link-text', 'heading-order',
      'lang-attr', 'duplicate-id', 'focus-visible', 'aria-valid', 'skip-link'];
    const failedRules = new Set(allViolations.map(v => v.id));
    const passes = ruleNames.filter(r => !failedRules.has(r) && (!enabledRules || enabledRules.has(r)));

    const summary = allViolations.length === 0
      ? 'No accessibility violations found.'
      : `Found ${errors.length} error(s) and ${warnings.length} warning(s). Score: ${score}/100.`;

    lastViolations = allViolations;
    _violations.set(allViolations);
    _score.set(score);
    _scanning.set(false);

    return {
      violations: errors,
      warnings,
      passes,
      score,
      summary,
    };
  }

  function autoFix(root?: HTMLElement | Document): { fixed: number; skipped: number } {
    const scanRoot = getRoot(root);
    let fixed = 0;
    let skipped = 0;

    // Fix alt-text violations
    const altViolations = lastViolations.filter(v => v.id === 'alt-text');
    if (altViolations.length > 0 || !enabledRules || enabledRules.has('alt-text')) {
      const imgs = querySelectorAll(scanRoot, 'img');
      for (const img of imgs) {
        if (!img.hasAttribute('alt')) {
          img.setAttribute('alt', '');
          fixed++;
        }
      }
    }

    // Fix form-labels violations
    const labelViolations = lastViolations.filter(v => v.id === 'form-labels');
    if (labelViolations.length > 0) {
      const inputs = querySelectorAll(scanRoot, 'input, select, textarea');
      const rootNode = scanRoot instanceof Document ? scanRoot : scanRoot.ownerDocument ?? scanRoot;
      for (const input of inputs) {
        const el = input as HTMLInputElement;
        if (el.type === 'hidden') continue;
        const hasAriaLabel = el.hasAttribute('aria-label') && el.getAttribute('aria-label')!.trim() !== '';
        const hasAriaLabelledBy = el.hasAttribute('aria-labelledby');
        let hasLabel = false;
        if (el.id) {
          const label = (rootNode as Document).querySelector(`label[for="${el.id}"]`);
          if (label) hasLabel = true;
        }
        if (!hasLabel) {
          let parent = el.parentElement;
          while (parent) {
            if (parent.tagName.toLowerCase() === 'label') { hasLabel = true; break; }
            parent = parent.parentElement;
          }
        }
        if (!hasAriaLabel && !hasAriaLabelledBy && !hasLabel) {
          const labelText = el.getAttribute('name') || el.getAttribute('id') || el.getAttribute('placeholder') || 'Input';
          el.setAttribute('aria-label', labelText);
          fixed++;
        }
      }
    }

    // Fix button-text violations
    const btnViolations = lastViolations.filter(v => v.id === 'button-text');
    if (btnViolations.length > 0) {
      const buttons = querySelectorAll(scanRoot, 'button');
      for (const btn of buttons) {
        const text = btn.textContent?.trim() ?? '';
        const ariaLabel = btn.getAttribute('aria-label')?.trim() ?? '';
        if (!text && !ariaLabel) {
          const title = btn.getAttribute('title') || 'Button';
          btn.setAttribute('aria-label', title);
          fixed++;
        }
      }
    }

    return { fixed, skipped };
  }

  function stop(): void {
    if (watchTimer !== null) {
      clearInterval(watchTimer);
      watchTimer = null;
    }
  }

  if (opts?.watch) {
    const interval = opts.watchInterval ?? 5000;
    watchTimer = setInterval(() => {
      scan().catch(() => {});
    }, interval);
  }

  function suggestAria(element: HTMLElement): Record<string, string> {
    const tag = element.tagName.toLowerCase();

    if (tag === 'div' && element.hasAttribute('onclick')) {
      return { role: 'button', tabindex: '0' };
    }

    if (tag === 'input' && (element as HTMLInputElement).type === 'text') {
      const placeholder = element.getAttribute('placeholder') ?? '';
      // Look for nearby label text
      let labelText = placeholder;
      let parent = element.parentElement;
      while (parent) {
        if (parent.tagName.toLowerCase() === 'label') {
          labelText = parent.textContent?.trim() ?? placeholder;
          break;
        }
        parent = parent.parentElement;
      }
      if (labelText) {
        return { 'aria-label': labelText };
      }
      return {};
    }

    if (tag === 'ul') {
      const items = element.querySelectorAll('li a');
      if (items.length > 0) {
        return { role: 'navigation', 'aria-label': 'Main' };
      }
    }

    return {};
  }

  return {
    scan,
    violations: () => _violations(),
    score: () => _score(),
    scanning: () => _scanning(),
    autoFix,
    stop,
    suggestAria,
  };
}
