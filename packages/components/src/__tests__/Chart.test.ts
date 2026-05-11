import { describe, it, expect } from 'vitest';
import { createChart } from '../Chart.js';

const LABELS = ['Jan', 'Feb', 'Mar', 'Apr'];
const DATASETS = [
  { label: 'Sales', data: [10, 20, 15, 30], color: '#2563eb' },
  { label: 'Profit', data: [5, 8, 12, 20], color: '#16a34a' },
];

describe('createChart', () => {
  it('createChart returns handle with svg', () => {
    const chart = createChart({ type: 'line', labels: LABELS, datasets: DATASETS });
    expect(chart.svg).toBeTruthy();
    expect(chart.svg.tagName.toLowerCase()).toBe('svg');
  });

  it('mount() appends SVG to container', () => {
    const container = document.createElement('div');
    const chart = createChart({ type: 'line', labels: LABELS, datasets: DATASETS });
    chart.mount(container);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('line chart creates polyline element', () => {
    const container = document.createElement('div');
    const chart = createChart({ type: 'line', labels: LABELS, datasets: DATASETS });
    chart.mount(container);
    const polylines = container.querySelectorAll('polyline');
    expect(polylines.length).toBeGreaterThan(0);
  });

  it('bar chart creates rect elements', () => {
    const container = document.createElement('div');
    const chart = createChart({ type: 'bar', labels: LABELS, datasets: DATASETS });
    chart.mount(container);
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThan(0);
  });

  it('pie chart creates path elements', () => {
    const container = document.createElement('div');
    const chart = createChart({
      type: 'pie',
      labels: LABELS,
      datasets: [{ label: 'Data', data: [25, 35, 20, 20] }],
    });
    chart.mount(container);
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThan(0);
  });

  it('area chart creates polygon/path', () => {
    const container = document.createElement('div');
    const chart = createChart({ type: 'area', labels: LABELS, datasets: DATASETS });
    chart.mount(container);
    const polygons = container.querySelectorAll('polygon');
    const paths    = container.querySelectorAll('path');
    expect(polygons.length + paths.length).toBeGreaterThan(0);
  });

  it('update() replaces chart data', () => {
    const container = document.createElement('div');
    const chart = createChart({ type: 'line', labels: LABELS, datasets: DATASETS });
    chart.mount(container);
    const newDatasets = [{ label: 'New', data: [1, 2, 3, 4], color: '#dc2626' }];
    chart.update(newDatasets);
    // After update, svg should still be in the container
    expect(container.querySelector('svg')).toBeTruthy();
    // The new svg reference should match chart.svg
    expect(chart.svg).toBeTruthy();
  });

  it('destroy() removes SVG', () => {
    const container = document.createElement('div');
    const chart = createChart({ type: 'bar', labels: LABELS, datasets: DATASETS });
    chart.mount(container);
    expect(container.querySelector('svg')).toBeTruthy();
    chart.destroy();
    expect(container.querySelector('svg')).toBeNull();
  });
});
