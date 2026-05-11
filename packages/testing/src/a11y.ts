// ── WCAG 2.2 Accessibility Audit Engine ───────────────────────────────────────

export type A11ySeverity = 'critical' | 'serious' | 'moderate' | 'minor';
export type WCAGLevel    = 'A' | 'AA' | 'AAA';

export interface A11yViolation {
  id:           string;
  description:  string;
  impact:       A11ySeverity;
  wcagLevel:    WCAGLevel;
  wcagCriteria: string;
  element:      string;
  fix:          string;
}

export interface A11yReport {
  violations:  A11yViolation[];
  passes:      string[];
  incomplete:  string[];
  score:       number;
  wcagLevel:   WCAGLevel | 'none';
}

export interface A11yOptions {
  level?:  WCAGLevel;
  rules?:  string[];
  ignore?: string[];
}

// ── Color contrast helpers ────────────────────────────────────────────────────

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs! + 0.7152 * gs! + 0.0722 * bs!;
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const NAMED_COLORS: Record<string, [number, number, number]> = {
  black:   [0, 0, 0],
  white:   [255, 255, 255],
  red:     [255, 0, 0],
  green:   [0, 128, 0],
  blue:    [0, 0, 255],
  yellow:  [255, 255, 0],
  gray:    [128, 128, 128],
  grey:    [128, 128, 128],
  silver:  [192, 192, 192],
  navy:    [0, 0, 128],
  teal:    [0, 128, 128],
  maroon:  [128, 0, 0],
  purple:  [128, 0, 128],
  olive:   [128, 128, 0],
  aqua:    [0, 255, 255],
  cyan:    [0, 255, 255],
  fuchsia: [255, 0, 255],
  magenta: [255, 0, 255],
  lime:    [0, 255, 0],
  orange:  [255, 165, 0],
  pink:    [255, 192, 203],
  brown:   [165, 42, 42],
  transparent: [255, 255, 255], // treat as white bg
};

function parseColor(color: string): [number, number, number] | null {
  if (!color || color === 'transparent') return [255, 255, 255];

  const trimmed = color.trim().toLowerCase();

  // named colors
  if (trimmed in NAMED_COLORS) return NAMED_COLORS[trimmed]!;

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1]!, 10), parseInt(rgbMatch[2]!, 10), parseInt(rgbMatch[3]!, 10)];
  }

  // #rrggbb
  const hexLong = trimmed.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if (hexLong) {
    return [parseInt(hexLong[1]!, 16), parseInt(hexLong[2]!, 16), parseInt(hexLong[3]!, 16)];
  }

  // #rgb
  const hexShort = trimmed.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (hexShort) {
    return [
      parseInt(hexShort[1]! + hexShort[1]!, 16),
      parseInt(hexShort[2]! + hexShort[2]!, 16),
      parseInt(hexShort[3]! + hexShort[3]!, 16),
    ];
  }

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function snippet(el: HTMLElement): string {
  return el.outerHTML.slice(0, 120);
}

function queryAll<T extends Element>(root: HTMLElement, selector: string): T[] {
  const results: T[] = [];
  if (root.matches(selector)) results.push(root as unknown as T);
  results.push(...(root.querySelectorAll<T>(selector)));
  return results;
}

// ── Level A rules ─────────────────────────────────────────────────────────────

function ruleImgAlt(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  for (const img of queryAll<HTMLImageElement>(el, 'img')) {
    if (!img.hasAttribute('alt')) {
      violations.push({
        id:           'img-alt',
        description:  'Image is missing an alt attribute',
        impact:       'critical',
        wcagLevel:    'A',
        wcagCriteria: '1.1.1',
        element:      snippet(img),
        fix:          'Add an alt attribute describing the image, or alt="" for decorative images',
      });
    }
  }
  return violations;
}

function ruleButtonName(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  for (const btn of queryAll<HTMLButtonElement>(el, 'button')) {
    const hasText     = (btn.textContent ?? '').trim().length > 0;
    const hasLabel    = btn.hasAttribute('aria-label') && (btn.getAttribute('aria-label') ?? '').trim().length > 0;
    const hasLabelledBy = btn.hasAttribute('aria-labelledby');
    if (!hasText && !hasLabel && !hasLabelledBy) {
      violations.push({
        id:           'button-name',
        description:  'Button has no accessible name',
        impact:       'critical',
        wcagLevel:    'A',
        wcagCriteria: '4.1.2',
        element:      snippet(btn),
        fix:          'Add text content, aria-label, or aria-labelledby to the button',
      });
    }
  }
  return violations;
}

function ruleLinkName(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  for (const a of queryAll<HTMLAnchorElement>(el, 'a')) {
    const hasText  = (a.textContent ?? '').trim().length > 0;
    const hasLabel = a.hasAttribute('aria-label') && (a.getAttribute('aria-label') ?? '').trim().length > 0;
    if (!hasText && !hasLabel) {
      violations.push({
        id:           'link-name',
        description:  'Link has no accessible name',
        impact:       'serious',
        wcagLevel:    'A',
        wcagCriteria: '2.4.4',
        element:      snippet(a),
        fix:          'Add text content or aria-label to the link',
      });
    }
  }
  return violations;
}

function ruleFormLabel(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const skipTypes = new Set(['hidden', 'button', 'submit', 'reset', 'image']);
  for (const input of queryAll<HTMLInputElement>(el, 'input')) {
    const type = (input.getAttribute('type') ?? 'text').toLowerCase();
    if (skipTypes.has(type)) continue;

    const hasAriaLabel    = input.hasAttribute('aria-label') && (input.getAttribute('aria-label') ?? '').trim().length > 0;
    const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
    const inputId         = input.getAttribute('id');
    const hasLinkedLabel  = inputId ? !!input.ownerDocument?.querySelector(`label[for="${inputId}"]`) : false;
    const isWrapped       = !!input.closest('label');

    if (!hasAriaLabel && !hasAriaLabelledBy && !hasLinkedLabel && !isWrapped) {
      violations.push({
        id:           'form-label',
        description:  'Form input has no associated label',
        impact:       'critical',
        wcagLevel:    'A',
        wcagCriteria: '1.3.1',
        element:      snippet(input),
        fix:          'Add a <label> element linked via for/id, or add aria-label, or wrap input in <label>',
      });
    }
  }
  return violations;
}

function ruleDocumentTitle(el: HTMLElement): A11yViolation[] {
  // Only check at document level
  if (el !== el.ownerDocument?.documentElement && el.tagName !== 'HTML') {
    return [];
  }
  const title = el.ownerDocument?.title ?? '';
  if (!title.trim()) {
    return [{
      id:           'document-title',
      description:  'Document has no title',
      impact:       'serious',
      wcagLevel:    'A',
      wcagCriteria: '2.4.2',
      element:      '<html>',
      fix:          'Add a descriptive <title> element to the document <head>',
    }];
  }
  return [];
}

function ruleLandmarkOneMain(el: HTMLElement): A11yViolation[] {
  const hasMain = queryAll(el, 'main').length > 0
    || queryAll(el, '[role="main"]').length > 0;
  if (!hasMain) {
    return [{
      id:           'landmark-one-main',
      description:  'Page has no main landmark',
      impact:       'moderate',
      wcagLevel:    'A',
      wcagCriteria: '1.3.6',
      element:      snippet(el).slice(0, 40),
      fix:          'Add a <main> element or an element with role="main"',
    }];
  }
  return [];
}

function ruleListStructure(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  for (const li of queryAll<HTMLElement>(el, 'li')) {
    const parent = li.parentElement;
    if (!parent || (parent.tagName !== 'UL' && parent.tagName !== 'OL')) {
      violations.push({
        id:           'list-structure',
        description:  '<li> element is not inside a <ul> or <ol>',
        impact:       'moderate',
        wcagLevel:    'A',
        wcagCriteria: '1.3.1',
        element:      snippet(li),
        fix:          'Ensure <li> elements are always direct children of <ul> or <ol>',
      });
    }
  }
  return violations;
}

// Required ARIA attributes per role
const ARIA_REQUIRED: Record<string, string[]> = {
  checkbox:     ['aria-checked'],
  radio:        ['aria-checked'],
  combobox:     ['aria-expanded'],
  listbox:      [],
  option:       ['aria-selected'],
  scrollbar:    ['aria-controls', 'aria-valuenow'],
  slider:       ['aria-valuenow'],
  spinbutton:   ['aria-valuenow'],
  separator:    [],
  progressbar:  [],
  tab:          ['aria-selected'],
  treeitem:     ['aria-expanded'],
  gridcell:     [],
  rowheader:    [],
  columnheader: [],
};

function ruleAriaRequiredAttr(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const roledEls = queryAll<HTMLElement>(el, '[role]');
  for (const roledEl of roledEls) {
    const role = roledEl.getAttribute('role') ?? '';
    const required = ARIA_REQUIRED[role];
    if (!required) continue;
    for (const attr of required) {
      if (!roledEl.hasAttribute(attr)) {
        violations.push({
          id:           'aria-required-attr',
          description:  `Element with role="${role}" is missing required attribute ${attr}`,
          impact:       'critical',
          wcagLevel:    'A',
          wcagCriteria: '4.1.2',
          element:      snippet(roledEl),
          fix:          `Add the ${attr} attribute to the element with role="${role}"`,
        });
      }
    }
  }
  return violations;
}

// Known valid aria-* attributes (subset of ARIA spec)
const VALID_ARIA_ATTRS = new Set([
  'aria-activedescendant', 'aria-atomic', 'aria-autocomplete', 'aria-busy',
  'aria-checked', 'aria-colcount', 'aria-colindex', 'aria-colspan',
  'aria-controls', 'aria-current', 'aria-describedby', 'aria-details',
  'aria-disabled', 'aria-dropeffect', 'aria-errormessage', 'aria-expanded',
  'aria-flowto', 'aria-grabbed', 'aria-haspopup', 'aria-hidden',
  'aria-invalid', 'aria-keyshortcuts', 'aria-label', 'aria-labelledby',
  'aria-level', 'aria-live', 'aria-modal', 'aria-multiline',
  'aria-multiselectable', 'aria-orientation', 'aria-owns', 'aria-placeholder',
  'aria-posinset', 'aria-pressed', 'aria-readonly', 'aria-relevant',
  'aria-required', 'aria-roledescription', 'aria-rowcount', 'aria-rowindex',
  'aria-rowspan', 'aria-selected', 'aria-setsize', 'aria-sort',
  'aria-valuemax', 'aria-valuemin', 'aria-valuenow', 'aria-valuetext',
]);

function ruleAriaValidAttr(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const allEls = [el, ...el.querySelectorAll<HTMLElement>('*')];
  for (const elem of allEls) {
    for (const attr of elem.attributes) {
      if (attr.name.startsWith('aria-') && !VALID_ARIA_ATTRS.has(attr.name)) {
        violations.push({
          id:           'aria-valid-attr',
          description:  `Unknown ARIA attribute: ${attr.name}`,
          impact:       'moderate',
          wcagLevel:    'A',
          wcagCriteria: '4.1.2',
          element:      snippet(elem),
          fix:          `Remove or correct the unknown ARIA attribute "${attr.name}"`,
        });
      }
    }
  }
  return violations;
}

function ruleEmptyHeading(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  for (const h of queryAll<HTMLElement>(el, 'h1,h2,h3,h4,h5,h6')) {
    if (!(h.textContent ?? '').trim()) {
      violations.push({
        id:           'empty-heading',
        description:  'Heading element has no text content',
        impact:       'serious',
        wcagLevel:    'A',
        wcagCriteria: '2.4.6',
        element:      snippet(h),
        fix:          'Add descriptive text content to the heading element',
      });
    }
  }
  return violations;
}

function ruleSkipLink(el: HTMLElement): A11yViolation[] {
  // Only meaningful at near-document level — check if there is a skip link
  const links = queryAll<HTMLAnchorElement>(el, 'a[href]');
  const hasSkipLink = links.some(a => {
    const href = a.getAttribute('href') ?? '';
    const text = (a.textContent ?? '').toLowerCase();
    return href.startsWith('#') && (
      text.includes('skip') || text.includes('main') || text.includes('content')
    );
  });

  // Only fire if we have meaningful page content (has nav or header)
  const hasNav = queryAll(el, 'nav,header').length > 0;
  if (!hasSkipLink && hasNav) {
    return [{
      id:           'skip-link',
      description:  'Page has no skip-to-main-content link',
      impact:       'moderate',
      wcagLevel:    'A',
      wcagCriteria: '2.4.1',
      element:      snippet(el).slice(0, 40),
      fix:          'Add a skip link at the top of the page: <a href="#main">Skip to main content</a>',
    }];
  }
  return [];
}

// ── Level AA rules ────────────────────────────────────────────────────────────

function ruleColorContrast(el: HTMLElement): { violations: A11yViolation[]; incomplete: string[] } {
  const violations: A11yViolation[] = [];
  const incomplete: string[] = [];

  const textTags = new Set(['p', 'span', 'div', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'li', 'td', 'th', 'label', 'button', 'strong', 'em', 'small', 'b', 'i']);

  const candidates: HTMLElement[] = [];
  if (textTags.has(el.tagName.toLowerCase())) candidates.push(el);
  candidates.push(...el.querySelectorAll<HTMLElement>([...textTags].join(',')));

  let markedIncomplete = false;

  for (const elem of candidates) {
    const style = elem.style; // inline styles only in jsdom
    const color     = style?.color ?? '';
    const bgColor   = style?.backgroundColor ?? '';

    if (!color && !bgColor) {
      // Can't check without color info
      if (!markedIncomplete) {
        incomplete.push('color-contrast');
        markedIncomplete = true;
      }
      continue;
    }

    if (!color || !bgColor) {
      if (!markedIncomplete) {
        incomplete.push('color-contrast');
        markedIncomplete = true;
      }
      continue;
    }

    const fg = parseColor(color);
    const bg = parseColor(bgColor);

    if (!fg || !bg) {
      if (!markedIncomplete) {
        incomplete.push('color-contrast');
        markedIncomplete = true;
      }
      continue;
    }

    const fgL = getLuminance(...fg);
    const bgL = getLuminance(...bg);
    const ratio = contrastRatio(fgL, bgL);

    // Determine if large text: check font-size inline style
    const fontSize   = style?.fontSize ?? '';
    const fontWeight = style?.fontWeight ?? '';
    const isLargeText = (() => {
      if (!fontSize) return false;
      const ptMatch = fontSize.match(/^([\d.]+)pt$/);
      if (ptMatch) {
        const pt = parseFloat(ptMatch[1]!);
        const isBold = fontWeight === 'bold' || parseInt(fontWeight || '0', 10) >= 700;
        return pt >= 18 || (isBold && pt >= 14);
      }
      const pxMatch = fontSize.match(/^([\d.]+)px$/);
      if (pxMatch) {
        const px = parseFloat(pxMatch[1]!);
        const isBold = fontWeight === 'bold' || parseInt(fontWeight || '0', 10) >= 700;
        // 18pt ~ 24px, 14pt ~ ~18.67px
        return px >= 24 || (isBold && px >= 18.67);
      }
      return false;
    })();

    const required = isLargeText ? 3 : 4.5;

    if (ratio < required) {
      violations.push({
        id:           'color-contrast',
        description:  `Color contrast ratio ${ratio.toFixed(2)}:1 is below the required ${required}:1`,
        impact:       'serious',
        wcagLevel:    'AA',
        wcagCriteria: '1.4.3',
        element:      snippet(elem),
        fix:          `Increase color contrast to at least ${required}:1. Current: ${ratio.toFixed(2)}:1`,
      });
    }
  }

  return { violations, incomplete };
}

function ruleFocusVisible(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const interactive = queryAll<HTMLElement>(el, 'button,a,input');
  for (const elem of interactive) {
    const outline = elem.style?.outline ?? '';
    if (outline === 'none' || outline === '0') {
      violations.push({
        id:           'focus-visible',
        description:  'Interactive element has outline removed, hiding focus indicator',
        impact:       'serious',
        wcagLevel:    'AA',
        wcagCriteria: '2.4.7',
        element:      snippet(elem),
        fix:          'Remove outline:none or provide an equivalent :focus-visible style',
      });
    }
  }
  return violations;
}

function ruleMetaViewport(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const metas = queryAll<HTMLMetaElement>(el, 'meta[name="viewport"]');
  for (const meta of metas) {
    const content = meta.getAttribute('content') ?? '';
    if (content.includes('user-scalable=no')) {
      violations.push({
        id:           'meta-viewport',
        description:  'Viewport meta tag disables user scaling (user-scalable=no)',
        impact:       'critical',
        wcagLevel:    'AA',
        wcagCriteria: '1.4.4',
        element:      snippet(meta),
        fix:          'Remove user-scalable=no from the viewport meta tag',
      });
    }
    const maxScaleMatch = content.match(/maximum-scale=([\d.]+)/);
    if (maxScaleMatch) {
      const scale = parseFloat(maxScaleMatch[1]!);
      if (scale < 1) {
        violations.push({
          id:           'meta-viewport',
          description:  `Viewport meta tag sets maximum-scale=${scale} which prevents zoom`,
          impact:       'critical',
          wcagLevel:    'AA',
          wcagCriteria: '1.4.4',
          element:      snippet(meta),
          fix:          'Remove maximum-scale or set it to at least 1',
        });
      }
    }
  }
  return violations;
}

function ruleHeadingOrder(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const headings = queryAll<HTMLElement>(el, 'h1,h2,h3,h4,h5,h6');
  let prevLevel = 0;
  for (const h of headings) {
    const level = parseInt(h.tagName[1]!, 10);
    if (prevLevel > 0 && level > prevLevel + 1) {
      violations.push({
        id:           'heading-order',
        description:  `Heading level skipped: <h${prevLevel}> followed by <h${level}>`,
        impact:       'moderate',
        wcagLevel:    'AA',
        wcagCriteria: '1.3.1',
        element:      snippet(h),
        fix:          `Use heading levels in order without skipping. Expected h${prevLevel + 1}, found h${level}`,
      });
    }
    prevLevel = level;
  }
  return violations;
}

function ruleInputErrorSuggestion(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const invalidInputs = queryAll<HTMLInputElement>(el, 'input[aria-invalid="true"]');
  for (const input of invalidInputs) {
    const describedBy = input.getAttribute('aria-describedby');
    if (!describedBy) {
      violations.push({
        id:           'input-error-suggestion',
        description:  'Invalid input has no linked error message',
        impact:       'moderate',
        wcagLevel:    'AA',
        wcagCriteria: '3.3.1',
        element:      snippet(input),
        fix:          'Add aria-describedby pointing to an element describing the error',
      });
    } else {
      const errorEl = input.ownerDocument?.getElementById(describedBy);
      if (!errorEl || !(errorEl.textContent ?? '').trim()) {
        violations.push({
          id:           'input-error-suggestion',
          description:  'Invalid input aria-describedby points to missing or empty error element',
          impact:       'moderate',
          wcagLevel:    'AA',
          wcagCriteria: '3.3.1',
          element:      snippet(input),
          fix:          'Ensure the element referenced by aria-describedby exists and contains error text',
        });
      }
    }
  }
  return violations;
}

// ── Level AAA rules ───────────────────────────────────────────────────────────

function ruleTargetSize(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const interactive = queryAll<HTMLElement>(el, 'button,a,input');
  for (const elem of interactive) {
    const w = elem.offsetWidth;
    const h = elem.offsetHeight;
    // jsdom returns 0 for most elements; skip if both are 0 (no layout)
    if (w === 0 && h === 0) continue;
    if (w < 44 || h < 44) {
      violations.push({
        id:           'target-size',
        description:  `Interactive element is ${w}×${h}px, below the 44×44px minimum`,
        impact:       'minor',
        wcagLevel:    'AAA',
        wcagCriteria: '2.5.5',
        element:      snippet(elem),
        fix:          'Increase the element size to at least 44×44 CSS pixels',
      });
    }
  }
  return violations;
}

function ruleNoPositiveTabindex(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const allEls = [el, ...el.querySelectorAll<HTMLElement>('[tabindex]')];
  for (const elem of allEls) {
    const tabindex = elem.getAttribute('tabindex');
    if (tabindex !== null && parseInt(tabindex, 10) > 0) {
      violations.push({
        id:           'no-positive-tabindex',
        description:  `Element has tabindex="${tabindex}" which disrupts natural tab order`,
        impact:       'minor',
        wcagLevel:    'AAA',
        wcagCriteria: '2.4.3',
        element:      snippet(elem),
        fix:          'Use tabindex="0" or tabindex="-1" instead of positive values',
      });
    }
  }
  return violations;
}

const GENERIC_LINK_TEXTS = new Set([
  'click here', 'here', 'read more', 'more', 'learn more', 'click', 'link',
  'this link', 'this page', 'details', 'info', 'information',
]);

function ruleLinkPurpose(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  for (const a of queryAll<HTMLAnchorElement>(el, 'a')) {
    const text = (a.textContent ?? '').trim().toLowerCase();
    if (text && GENERIC_LINK_TEXTS.has(text)) {
      violations.push({
        id:           'link-purpose',
        description:  `Link text "${text}" is generic and does not describe the destination`,
        impact:       'minor',
        wcagLevel:    'AAA',
        wcagCriteria: '2.4.9',
        element:      snippet(a),
        fix:          'Use descriptive link text that explains where the link goes',
      });
    }
  }
  return violations;
}

function ruleReadingLevel(el: HTMLElement): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const paragraphs = queryAll<HTMLElement>(el, 'p');
  for (const p of paragraphs) {
    const text = (p.textContent ?? '').trim();
    if (!text) continue;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) continue;
    const totalWords = text.split(/\s+/).filter(Boolean).length;
    const avgWords = totalWords / sentences.length;
    if (avgWords > 25) {
      violations.push({
        id:           'reading-level',
        description:  `Paragraph has an average of ${avgWords.toFixed(1)} words per sentence (recommended: ≤25)`,
        impact:       'minor',
        wcagLevel:    'AAA',
        wcagCriteria: '3.1.5',
        element:      snippet(p),
        fix:          'Break long sentences into shorter, clearer statements',
      });
    }
  }
  return violations;
}

// ── Rule registry ─────────────────────────────────────────────────────────────

interface RuleDef {
  id:    string;
  level: WCAGLevel;
  run:   (el: HTMLElement) => A11yViolation[] | { violations: A11yViolation[]; incomplete: string[] };
}

const ALL_RULES: RuleDef[] = [
  // Level A
  { id: 'img-alt',            level: 'A',   run: ruleImgAlt },
  { id: 'button-name',        level: 'A',   run: ruleButtonName },
  { id: 'link-name',          level: 'A',   run: ruleLinkName },
  { id: 'form-label',         level: 'A',   run: ruleFormLabel },
  { id: 'document-title',     level: 'A',   run: ruleDocumentTitle },
  { id: 'landmark-one-main',  level: 'A',   run: ruleLandmarkOneMain },
  { id: 'list-structure',     level: 'A',   run: ruleListStructure },
  { id: 'aria-required-attr', level: 'A',   run: ruleAriaRequiredAttr },
  { id: 'aria-valid-attr',    level: 'A',   run: ruleAriaValidAttr },
  { id: 'empty-heading',      level: 'A',   run: ruleEmptyHeading },
  { id: 'skip-link',          level: 'A',   run: ruleSkipLink },
  // Level AA
  { id: 'color-contrast',         level: 'AA',  run: ruleColorContrast },
  { id: 'focus-visible',          level: 'AA',  run: ruleFocusVisible },
  { id: 'meta-viewport',          level: 'AA',  run: ruleMetaViewport },
  { id: 'heading-order',          level: 'AA',  run: ruleHeadingOrder },
  { id: 'input-error-suggestion', level: 'AA',  run: ruleInputErrorSuggestion },
  // Level AAA
  { id: 'target-size',          level: 'AAA', run: ruleTargetSize },
  { id: 'no-positive-tabindex', level: 'AAA', run: ruleNoPositiveTabindex },
  { id: 'link-purpose',         level: 'AAA', run: ruleLinkPurpose },
  { id: 'reading-level',        level: 'AAA', run: ruleReadingLevel },
];

const LEVEL_ORDER: Record<WCAGLevel, number> = { A: 1, AA: 2, AAA: 3 };

// ── Main function ─────────────────────────────────────────────────────────────

export function auditA11y(element: HTMLElement, opts?: A11yOptions): A11yReport {
  const level      = opts?.level ?? 'AA';
  const rulesFilter = opts?.rules;
  const ignoreSet  = new Set(opts?.ignore ?? []);
  const maxLevel   = LEVEL_ORDER[level];

  const violations: A11yViolation[] = [];
  const passes:     string[]        = [];
  const incomplete: string[]        = [];

  for (const ruleDef of ALL_RULES) {
    // Filter by level
    if (LEVEL_ORDER[ruleDef.level] > maxLevel) continue;
    // Filter by explicit rules list
    if (rulesFilter && !rulesFilter.includes(ruleDef.id)) continue;
    // Skip ignored rules
    if (ignoreSet.has(ruleDef.id)) continue;

    const result = ruleDef.run(element);

    if (Array.isArray(result)) {
      if (result.length === 0) {
        passes.push(ruleDef.id);
      } else {
        violations.push(...result);
      }
    } else {
      // { violations, incomplete }
      if (result.violations.length === 0) {
        passes.push(ruleDef.id);
      } else {
        violations.push(...result.violations);
      }
      for (const inc of result.incomplete) {
        if (!incomplete.includes(inc)) incomplete.push(inc);
      }
    }
  }

  // Compute score
  let penalty = 0;
  for (const v of violations) {
    if (v.impact === 'critical')  penalty += 20;
    else if (v.impact === 'serious')  penalty += 10;
    else if (v.impact === 'moderate') penalty += 5;
    else if (v.impact === 'minor')    penalty += 2;
  }
  const score = Math.max(0, 100 - penalty);

  // Determine WCAG level achieved
  const hasAViolations   = violations.some(v => v.wcagLevel === 'A');
  const hasAAViolations  = violations.some(v => v.wcagLevel === 'AA');
  const hasAAAViolations = violations.some(v => v.wcagLevel === 'AAA');

  let wcagLevel: WCAGLevel | 'none';
  if (hasAViolations) {
    wcagLevel = 'none';
  } else if (hasAAViolations) {
    wcagLevel = 'A';
  } else if (hasAAAViolations) {
    wcagLevel = 'AA';
  } else {
    wcagLevel = 'AAA';
  }

  return { violations, passes, incomplete, score, wcagLevel };
}

// ── assertA11y ────────────────────────────────────────────────────────────────

export function assertA11y(element: HTMLElement, opts?: A11yOptions): void {
  const report = auditA11y(element, opts);
  if (report.violations.length > 0) {
    const lines = report.violations.map(
      v => `  [${v.impact}] ${v.id}: ${v.description}`
    );
    throw new Error(
      `Accessibility violations found:\n${lines.join('\n')}\n\nScore: ${report.score}/100`
    );
  }
}

// ── Vitest custom matcher ─────────────────────────────────────────────────────

export function setupA11yMatchers(): void {
  const globalExpect = (globalThis as Record<string, unknown>)['expect'] as
    | ({ extend: (matchers: Record<string, unknown>) => void } & Record<string, unknown>)
    | undefined;

  if (globalExpect != null && 'extend' in globalExpect) {
    globalExpect.extend({
      toBeAccessible(received: HTMLElement, opts?: A11yOptions) {
        const report = auditA11y(received, opts);
        const pass = report.violations.length === 0;
        return {
          pass,
          message: () => {
            if (pass) {
              return `Expected element to have accessibility violations, but it passed all rules`;
            }
            const lines = report.violations.map(
              v => `  [${v.impact}] ${v.id}: ${v.description}`
            );
            return `Expected element to be accessible, but found violations:\n${lines.join('\n')}`;
          },
        };
      },
    });
  }
}
