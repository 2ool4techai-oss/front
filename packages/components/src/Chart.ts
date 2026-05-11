// ── Types ──────────────────────────────────────────────────────────────

export type ChartType = 'line' | 'bar' | 'pie' | 'area';

export interface ChartDataset {
  label:  string;
  data:   number[];
  color?: string;
}

export interface ChartOptions {
  type:        ChartType;
  labels:      string[];
  datasets:    ChartDataset[];
  width?:      number;
  height?:     number;
  animate?:    boolean;
  showGrid?:   boolean;
  showLegend?: boolean;
  title?:      string;
}

export interface ChartHandle {
  update(datasets: ChartDataset[]): void;
  destroy(): void;
  mount(container: HTMLElement): void;
  readonly svg: SVGSVGElement;
}

// ── Styles ─────────────────────────────────────────────────────────────

function injectChartStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById('dr-chart-styles')) return;
  const style = document.createElement('style');
  style.id = 'dr-chart-styles';
  style.textContent = `
.dr-chart{display:inline-block;font-family:sans-serif}
.dr-chart svg{overflow:visible}
.dr-chart__title{font-size:14px;font-weight:600;fill:#111827;text-anchor:middle}
.dr-chart__axis-label{font-size:11px;fill:#6b7280}
.dr-chart__grid-line{stroke:#e5e7eb;stroke-dasharray:4 4}
.dr-chart__legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;font-size:12px;color:#374151}
.dr-chart__legend-item{display:flex;align-items:center;gap:4px}
.dr-chart__legend-swatch{width:12px;height:12px;border-radius:2px;flex-shrink:0}
`;
  document.head.appendChild(style);
}

// ── Color palette ──────────────────────────────────────────────────────

const DEFAULT_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569',
];

function getColor(dataset: ChartDataset, index: number): string {
  return dataset.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]!;
}

// ── SVG helpers ────────────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
}

function setAttrs(el: SVGElement, attrs: Record<string, string | number>): void {
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
}

// ── Padding constants ──────────────────────────────────────────────────

const PAD_LEFT   = 40;
const PAD_BOTTOM = 40;
const PAD_TOP    = 20;
const PAD_RIGHT  = 20;

// ── Renderers ──────────────────────────────────────────────────────────

function renderGrid(
  g: SVGGElement,
  innerW: number, innerH: number,
  minVal: number, maxVal: number,
  ticks: number,
): void {
  for (let i = 0; i <= ticks; i++) {
    const y = innerH - (i / ticks) * innerH;
    const val = minVal + (i / ticks) * (maxVal - minVal);
    const line = svgEl('line');
    setAttrs(line, {
      x1: 0, y1: y, x2: innerW, y2: y,
      class: 'dr-chart__grid-line',
    });
    g.appendChild(line);
    const text = svgEl('text');
    setAttrs(text, { x: -4, y: y + 4, 'text-anchor': 'end', class: 'dr-chart__axis-label' });
    text.textContent = Math.round(val).toString();
    g.appendChild(text);
  }
  // X axis base line
  const base = svgEl('line');
  setAttrs(base, { x1: 0, y1: innerH, x2: innerW, y2: innerH, stroke: '#d1d5db', 'stroke-width': 1 });
  g.appendChild(base);
  // Y axis line
  const yAxis = svgEl('line');
  setAttrs(yAxis, { x1: 0, y1: 0, x2: 0, y2: innerH, stroke: '#d1d5db', 'stroke-width': 1 });
  g.appendChild(yAxis);
}

function renderXLabels(g: SVGGElement, labels: string[], innerW: number, innerH: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const x = (i / Math.max(count - 1, 1)) * innerW;
    const text = svgEl('text');
    setAttrs(text, { x, y: innerH + 16, 'text-anchor': 'middle', class: 'dr-chart__axis-label' });
    text.textContent = labels[i] ?? '';
    g.appendChild(text);
  }
}

function renderBarXLabels(g: SVGGElement, labels: string[], innerW: number, innerH: number, count: number): void {
  const groupW = innerW / count;
  for (let i = 0; i < count; i++) {
    const x = i * groupW + groupW / 2;
    const text = svgEl('text');
    setAttrs(text, { x, y: innerH + 16, 'text-anchor': 'middle', class: 'dr-chart__axis-label' });
    text.textContent = labels[i] ?? '';
    g.appendChild(text);
  }
}

function computeRange(datasets: ChartDataset[]): { min: number; max: number } {
  const allVals = datasets.flatMap((d) => d.data);
  if (allVals.length === 0) return { min: 0, max: 100 };
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const min = Math.min(0, rawMin);
  const max = rawMax === min ? rawMax + 10 : rawMax;
  return { min, max };
}

function renderLine(
  g: SVGGElement,
  datasets: ChartDataset[],
  labels: string[],
  innerW: number, innerH: number,
  minVal: number, maxVal: number,
  animate: boolean,
): void {
  const count = labels.length;
  renderXLabels(g, labels, innerW, innerH, count);

  datasets.forEach((ds, di) => {
    const color = getColor(ds, di);
    const points = ds.data.map((v, i) => {
      const x = (i / Math.max(count - 1, 1)) * innerW;
      const y = innerH - ((v - minVal) / (maxVal - minVal)) * innerH;
      return `${x},${y}`;
    });

    const polyline = svgEl('polyline');
    setAttrs(polyline, {
      points: points.join(' '),
      fill: 'none',
      stroke: color,
      'stroke-width': 2,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    });
    if (animate) {
      polyline.style.transition = 'all 0.3s ease';
    }
    g.appendChild(polyline);

    // Dots
    ds.data.forEach((v, i) => {
      const x = (i / Math.max(count - 1, 1)) * innerW;
      const y = innerH - ((v - minVal) / (maxVal - minVal)) * innerH;
      const circle = svgEl('circle');
      setAttrs(circle, { cx: x, cy: y, r: 3, fill: color, stroke: '#fff', 'stroke-width': 1.5 });
      g.appendChild(circle);
    });
  });
}

function renderBar(
  g: SVGGElement,
  datasets: ChartDataset[],
  labels: string[],
  innerW: number, innerH: number,
  minVal: number, maxVal: number,
  animate: boolean,
): void {
  const count = labels.length;
  const groupW = innerW / count;
  const barW = groupW / (datasets.length + 1);

  renderBarXLabels(g, labels, innerW, innerH, count);

  datasets.forEach((ds, di) => {
    const color = getColor(ds, di);
    ds.data.forEach((v, i) => {
      const x = i * groupW + (di + 0.5) * barW;
      const barH = ((v - minVal) / (maxVal - minVal)) * innerH;
      const y = innerH - barH;
      const rect = svgEl('rect');
      setAttrs(rect, { x, y, width: barW * 0.9, height: Math.max(0, barH), fill: color, rx: 2 });
      if (animate) {
        rect.style.transition = 'all 0.3s ease';
      }
      g.appendChild(rect);
    });
  });
}

function renderArea(
  g: SVGGElement,
  datasets: ChartDataset[],
  labels: string[],
  innerW: number, innerH: number,
  minVal: number, maxVal: number,
  animate: boolean,
): void {
  const count = labels.length;
  renderXLabels(g, labels, innerW, innerH, count);

  datasets.forEach((ds, di) => {
    const color = getColor(ds, di);
    const pts = ds.data.map((v, i) => {
      const x = (i / Math.max(count - 1, 1)) * innerW;
      const y = innerH - ((v - minVal) / (maxVal - minVal)) * innerH;
      return [x, y] as [number, number];
    });

    // Fill polygon: go forward along top, then back along bottom
    const firstX = pts[0]?.[0] ?? 0;
    const lastX  = pts[pts.length - 1]?.[0] ?? innerW;
    const polyPts = [
      `${firstX},${innerH}`,
      ...pts.map(([x, y]) => `${x},${y}`),
      `${lastX},${innerH}`,
    ].join(' ');

    const polygon = svgEl('polygon');
    setAttrs(polygon, {
      points: polyPts,
      fill: color,
      opacity: '0.2',
    });
    if (animate) polygon.style.transition = 'all 0.3s ease';
    g.appendChild(polygon);

    // Line on top
    const linePoints = pts.map(([x, y]) => `${x},${y}`).join(' ');
    const polyline = svgEl('polyline');
    setAttrs(polyline, {
      points: linePoints,
      fill: 'none',
      stroke: color,
      'stroke-width': 2,
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round',
    });
    if (animate) polyline.style.transition = 'all 0.3s ease';
    g.appendChild(polyline);

    // Dots
    pts.forEach(([x, y]) => {
      const circle = svgEl('circle');
      setAttrs(circle, { cx: x, cy: y, r: 3, fill: color, stroke: '#fff', 'stroke-width': 1.5 });
      g.appendChild(circle);
    });
  });
}

function renderPie(
  g: SVGGElement,
  datasets: ChartDataset[],
  innerW: number, innerH: number,
  animate: boolean,
): void {
  // Use first dataset for pie
  const ds = datasets[0];
  if (!ds) return;

  const cx = innerW / 2;
  const cy = innerH / 2;
  const r  = Math.min(cx, cy) * 0.85;
  const total = ds.data.reduce((a, b) => a + b, 0);
  if (total === 0) return;

  let startAngle = -Math.PI / 2;

  ds.data.forEach((v, i) => {
    const slice = (v / total) * 2 * Math.PI;
    const endAngle = startAngle + slice;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = slice > Math.PI ? 1 : 0;

    const pathData = [
      `M ${cx} ${cy}`,
      `L ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z',
    ].join(' ');

    const color = DEFAULT_COLORS[i % DEFAULT_COLORS.length]!;
    const path = svgEl('path');
    setAttrs(path, { d: pathData, fill: color, stroke: '#fff', 'stroke-width': 2 });
    if (animate) path.style.transition = 'all 0.3s ease';
    g.appendChild(path);

    startAngle = endAngle;
  });
}

function renderLegend(
  svg: SVGSVGElement,
  datasets: ChartDataset[],
  width: number, height: number,
  isPie: boolean,
): void {
  if (isPie && datasets[0]) {
    // For pie, legend uses labels from data index colors
    const ds = datasets[0];
    let lx = PAD_LEFT;
    const ly = height - 10;
    ds.data.forEach((_v, i) => {
      const color = DEFAULT_COLORS[i % DEFAULT_COLORS.length]!;
      const rect = svgEl('rect');
      setAttrs(rect, { x: lx, y: ly, width: 10, height: 10, fill: color, rx: 2 });
      svg.appendChild(rect);
      const text = svgEl('text');
      setAttrs(text, { x: lx + 14, y: ly + 9, class: 'dr-chart__axis-label' });
      text.textContent = `Item ${i + 1}`;
      svg.appendChild(text);
      lx += 70;
    });
    return;
  }

  let lx = PAD_LEFT;
  const ly = height - 10;
  datasets.forEach((ds, i) => {
    const color = getColor(ds, i);
    const rect = svgEl('rect');
    setAttrs(rect, { x: lx, y: ly, width: 10, height: 10, fill: color, rx: 2 });
    svg.appendChild(rect);
    const text = svgEl('text');
    setAttrs(text, { x: lx + 14, y: ly + 9, class: 'dr-chart__axis-label' });
    text.textContent = ds.label;
    svg.appendChild(text);
    lx += ds.label.length * 7 + 24;
  });
}

// ── buildSVG ───────────────────────────────────────────────────────────

function buildSVG(opts: ChartOptions, datasets: ChartDataset[]): SVGSVGElement {
  const width      = opts.width  ?? 400;
  const height     = opts.height ?? 250;
  const animate    = opts.animate    ?? true;
  const showGrid   = opts.showGrid   ?? true;
  const showLegend = opts.showLegend ?? true;

  const legendH = showLegend ? 24 : 0;
  const titleH  = opts.title ? 20 : 0;
  const totalH  = height + legendH + titleH;

  const svg = svgEl('svg');
  setAttrs(svg, { width, height: totalH, viewBox: `0 0 ${width} ${totalH}` });

  if (opts.title) {
    const titleEl = svgEl('text');
    setAttrs(titleEl, { x: width / 2, y: 15, class: 'dr-chart__title' });
    titleEl.textContent = opts.title;
    svg.appendChild(titleEl);
  }

  const isPie = opts.type === 'pie';
  const innerW = width  - PAD_LEFT - PAD_RIGHT;
  const innerH = height - PAD_TOP  - PAD_BOTTOM;

  // Main drawing group
  const g = svgEl('g');
  setAttrs(g, { transform: `translate(${PAD_LEFT},${PAD_TOP + titleH})` });

  if (!isPie) {
    const { min, max } = computeRange(datasets);
    const ticks = 5;

    if (showGrid) {
      renderGrid(g, innerW, innerH, min, max, ticks);
    }

    if (opts.type === 'line') {
      renderLine(g, datasets, opts.labels, innerW, innerH, min, max, animate);
    } else if (opts.type === 'bar') {
      renderBar(g, datasets, opts.labels, innerW, innerH, min, max, animate);
    } else if (opts.type === 'area') {
      renderArea(g, datasets, opts.labels, innerW, innerH, min, max, animate);
    }
  } else {
    renderPie(g, datasets, innerW, innerH, animate);
  }

  svg.appendChild(g);

  if (showLegend) {
    renderLegend(svg, datasets, width, totalH, isPie);
  }

  return svg;
}

// ── createChart ────────────────────────────────────────────────────────

export function createChart(opts: ChartOptions): ChartHandle {
  injectChartStyles();

  let svgEl2 = buildSVG(opts, opts.datasets);
  let container: HTMLElement | null = null;
  let wrapEl: HTMLElement | null = null;

  function update(datasets: ChartDataset[]): void {
    const newSvg = buildSVG({ ...opts, datasets }, datasets);
    if (wrapEl && svgEl2.parentNode === wrapEl) {
      wrapEl.replaceChild(newSvg, svgEl2);
    }
    svgEl2 = newSvg;
  }

  function mount(el: HTMLElement): void {
    container = el;
    injectChartStyles();

    wrapEl = document.createElement('div');
    wrapEl.className = 'dr-chart';
    wrapEl.appendChild(svgEl2);
    el.appendChild(wrapEl);
  }

  function destroy(): void {
    if (wrapEl && container) {
      container.removeChild(wrapEl);
    }
    wrapEl    = null;
    container = null;
  }

  return {
    get svg() { return svgEl2; },
    update,
    destroy,
    mount,
  };
}
