// ── Minimal virtual DOM for SSR ────────────────────────────────────────
// Implements just enough of the DOM API to run DRISHTI components
// server-side without jsdom or a browser.

const VOID_TAGS = new Set([
  'area','base','br','col','embed','hr','img','input',
  'link','meta','param','source','track','wbr',
]);

const BOOL_ATTRS = new Set([
  'checked','selected','disabled','readonly','multiple',
  'hidden','autofocus','autoplay','controls','defer',
  'ismap','loop','open','required','reversed','scoped',
  'seamless','allowfullscreen','default','formnovalidate','novalidate',
]);

function escapeHTML(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── VStyle ─────────────────────────────────────────────────────────────
class VStyle {
  private _props: Map<string, string> = new Map();

  set cssText(v: string) {
    this._props.clear();
    for (const decl of v.split(';')) {
      const idx = decl.indexOf(':');
      if (idx < 0) continue;
      const prop = decl.slice(0, idx).trim();
      const val  = decl.slice(idx + 1).trim();
      if (prop && val) this._props.set(prop, val);
    }
  }

  get cssText(): string {
    return [...this._props.entries()].map(([k, v]) => `${k}:${v}`).join(';');
  }

  setProperty(prop: string, value: string): void { this._props.set(prop, value); }
  removeProperty(prop: string): void { this._props.delete(prop); }
  getPropertyValue(prop: string): string { return this._props.get(prop) ?? ''; }

  // Allow obj.style.color = 'red'
  [key: string]: unknown;
}

// Make VStyle work with property assignments like `style.color = 'red'`
const VStyleProxy = {
  set(target: VStyle, prop: string, value: string): boolean {
    if (prop === 'cssText') {
      target.cssText = value;
    } else if (typeof value === 'string' || value === '') {
      const cssKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      target.setProperty(cssKey, value);
    }
    return true;
  },
  get(target: VStyle, prop: string): unknown {
    if (prop in target) return (target as Record<string, unknown>)[prop];
    const cssKey = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
    return target.getPropertyValue(cssKey);
  },
};

// ── VClassList ─────────────────────────────────────────────────────────
class VClassList {
  private _set = new Set<string>();

  add(...classes: string[]): void    { for (const c of classes) if (c) this._set.add(c); }
  remove(...classes: string[]): void { for (const c of classes) this._set.delete(c); }
  toggle(cls: string, force?: boolean): boolean {
    const has = this._set.has(cls);
    const next = force !== undefined ? force : !has;
    if (next) this._set.add(cls); else this._set.delete(cls);
    return next;
  }
  contains(cls: string): boolean { return this._set.has(cls); }
  toString(): string { return [...this._set].join(' '); }
  get size(): number { return this._set.size; }
}

// ── VNode ──────────────────────────────────────────────────────────────
export class VNode {
  readonly nodeType: number;
  readonly nodeName: string;
  readonly tagName:  string;

  private _children:  VNode[]               = [];
  private _attrs:     Map<string, string>    = new Map();
  private _textContent = '';
  private _innerHTML   = '';
  private _hasInner    = false;

  readonly style:     VStyle    = new Proxy(new VStyle(), VStyleProxy) as VStyle;
  readonly classList: VClassList = new VClassList();

  // DRISHTI renderer needs these
  _drDispose?: () => void;

  constructor(tag: string, isText = false) {
    this.nodeType = isText ? 3 : 1;
    this.tagName  = tag.toUpperCase();
    this.nodeName = this.tagName;
  }

  // ── Attribute API ────────────────────────────────────────────────────
  setAttribute(k: string, v: string): void  { this._attrs.set(k, v); }
  getAttribute(k: string): string | null    { return this._attrs.get(k) ?? null; }
  removeAttribute(k: string): void          { this._attrs.delete(k); }
  hasAttribute(k: string): boolean          { return this._attrs.has(k); }

  // ── className bridged to classList ───────────────────────────────────
  get className(): string { return this.classList.toString(); }
  set className(v: string) {
    const cl = this.classList as VClassList;
    cl.remove(...[...cl['_set']]);
    for (const c of v.split(/\s+/).filter(Boolean)) cl.add(c);
  }

  // ── textContent / innerHTML ──────────────────────────────────────────
  get textContent(): string { return this._textContent; }
  set textContent(v: string) {
    this._textContent = v;
    this._children    = [];
    this._hasInner    = false;
    this._innerHTML   = '';
  }

  get innerHTML(): string {
    if (this._hasInner) return this._innerHTML;
    return this._children.map(c => c.serialize()).join('');
  }
  set innerHTML(v: string) {
    this._innerHTML = v;
    this._hasInner  = true;
    this._children  = [];
  }

  // ── DOM tree API ─────────────────────────────────────────────────────
  get childNodes(): VNode[]   { return this._children; }
  get children():  VNode[]    { return this._children.filter(c => c.nodeType === 1); }
  get firstChild(): VNode | null { return this._children[0] ?? null; }
  get lastChild():  VNode | null { return this._children[this._children.length - 1] ?? null; }

  get parentNode(): VNode | null { return null; } // simplified — not tracked

  appendChild<T extends VNode>(child: T): T {
    this._children.push(child);
    return child;
  }

  insertBefore<T extends VNode>(newChild: T, ref: VNode | null): T {
    if (!ref) { this.appendChild(newChild); return newChild; }
    const idx = this._children.indexOf(ref);
    if (idx < 0) this.appendChild(newChild);
    else this._children.splice(idx, 0, newChild);
    return newChild;
  }

  removeChild<T extends VNode>(child: T): T {
    const idx = this._children.indexOf(child);
    if (idx >= 0) this._children.splice(idx, 1);
    return child;
  }

  replaceChild<T extends VNode>(newChild: T, old: VNode): T {
    const idx = this._children.indexOf(old);
    if (idx >= 0) this._children[idx] = newChild;
    return newChild;
  }

  remove(): void { /* simplified — no parent tracking */ }

  // ── No-op event API ──────────────────────────────────────────────────
  addEventListener(): void    {}
  removeEventListener(): void {}
  dispatchEvent(): boolean    { return true; }
  focus(): void               {}
  blur():  void               {}
  click(): void               {}

  // ── Geometry — zeroed ────────────────────────────────────────────────
  getBoundingClientRect(): DOMRect {
    return { x:0, y:0, width:0, height:0, top:0, right:0, bottom:0, left:0, toJSON:()=>'' } as unknown as DOMRect;
  }
  get offsetWidth():  number { return 0; }
  get offsetHeight(): number { return 0; }
  get clientWidth():  number { return 0; }
  get clientHeight(): number { return 0; }
  get scrollTop():    number { return 0; }
  set scrollTop(_: number)   {}

  // ── Serialization ─────────────────────────────────────────────────────
  serialize(): string {
    if (this.nodeType === 3) return escapeHTML(this._textContent);

    const tag = this.tagName.toLowerCase();
    const parts: string[] = [];

    const cls = this.classList.toString();
    if (cls) parts.push(`class="${escapeHTML(cls)}"`);

    const cssText = (this.style as VStyle).cssText;
    if (cssText) parts.push(`style="${escapeHTML(cssText)}"`);

    for (const [k, v] of this._attrs) {
      if (BOOL_ATTRS.has(k)) {
        if (v !== 'false' && v !== '') parts.push(k);
      } else {
        parts.push(`${k}="${escapeHTML(v)}"`);
      }
    }

    const attrStr = parts.length ? ' ' + parts.join(' ') : '';

    if (VOID_TAGS.has(tag)) return `<${tag}${attrStr}>`;

    let inner: string;
    if (this._hasInner) {
      inner = this._innerHTML;
    } else if (this._textContent && this._children.length === 0) {
      inner = escapeHTML(this._textContent);
    } else {
      inner = this._children.map(c => c.serialize()).join('');
    }

    return `<${tag}${attrStr}>${inner}</${tag}>`;
  }
}

// ── VTextNode ──────────────────────────────────────────────────────────
export class VTextNode extends VNode {
  constructor(text: string) {
    super('#text', true);
    this.textContent = text;
  }
  override serialize(): string {
    return escapeHTML(this.textContent);
  }
}

// ── VDocument ─────────────────────────────────────────────────────────
export class VDocument {
  readonly body:   VNode = new VNode('body');
  readonly head:   VNode = new VNode('head');
  readonly documentElement: VNode = new VNode('html');

  createElement(tag: string): VNode    { return new VNode(tag); }
  createTextNode(text: string): VNode  { return new VTextNode(text); }
  createComment(text: string): VNode   {
    const n = new VNode('#comment');
    n.textContent = text;
    return n;
  }

  getElementById(_id: string): VNode | null    { return null; }
  querySelector(_sel: string): VNode | null    { return null; }
  querySelectorAll(_sel: string): VNode[]      { return []; }

  // No-op for SSR
  addEventListener(): void {}
  removeEventListener(): void {}
}

// ── SSR context ────────────────────────────────────────────────────────
export interface SSRContext {
  document: VDocument;
  window:   Record<string, unknown>;
}

export function createSSRContext(): SSRContext {
  const doc = new VDocument();
  return {
    document: doc,
    window: {
      document: doc,
      addEventListener: () => {},
      removeEventListener: () => {},
      location: { href: '/', pathname: '/', search: '', hash: '' },
      history:  { pushState: () => {}, replaceState: () => {}, back: () => {}, forward: () => {}, go: () => {} },
      requestAnimationFrame: (cb: FrameRequestCallback) => { cb(0); return 0; },
      cancelAnimationFrame:  () => {},
      ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
      IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
      matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    },
  };
}
