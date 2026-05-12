// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createA11yAgent } from '../a11y-agent.js';

describe('createA11yAgent', () => {
  let agent: ReturnType<typeof createA11yAgent>;

  beforeEach(() => {
    agent = createA11yAgent();
    document.body.innerHTML = '';
  });

  it('starts with empty violations', () => {
    expect(agent.violations()).toEqual([]);
    expect(agent.score()).toBe(100);
  });

  it('detects missing alt text', async () => {
    document.body.innerHTML = '<img src="cat.jpg">';
    const report = await agent.scan(document.body);
    expect(report.violations.some(v => v.id === 'alt-text')).toBe(true);
  });

  it('passes when img has alt', async () => {
    document.body.innerHTML = '<img src="cat.jpg" alt="A cat">';
    const report = await agent.scan(document.body);
    expect(report.violations.some(v => v.id === 'alt-text')).toBe(false);
  });

  it('detects unlabeled input', async () => {
    document.body.innerHTML = '<input type="text" name="email">';
    const report = await agent.scan(document.body);
    expect(report.violations.some(v => v.id === 'form-labels')).toBe(true);
  });

  it('passes input with aria-label', async () => {
    document.body.innerHTML = '<input type="text" aria-label="Email address">';
    const report = await agent.scan(document.body);
    expect(report.violations.some(v => v.id === 'form-labels')).toBe(false);
  });

  it('detects empty button', async () => {
    document.body.innerHTML = '<button></button>';
    const report = await agent.scan(document.body);
    expect(report.violations.some(v => v.id === 'button-text')).toBe(true);
  });

  it('detects duplicate IDs', async () => {
    document.body.innerHTML = '<div id="foo"></div><div id="foo"></div>';
    const report = await agent.scan(document.body);
    expect(report.violations.some(v => v.id === 'duplicate-id')).toBe(true);
  });

  it('score decreases with violations', async () => {
    document.body.innerHTML = '<img src="x.jpg"><img src="y.jpg">';
    const report = await agent.scan(document.body);
    expect(report.score).toBeLessThan(100);
  });

  it('autoFix adds alt to img', async () => {
    document.body.innerHTML = '<img src="cat.jpg">';
    await agent.scan(document.body);
    const result = agent.autoFix(document.body);
    expect(result.fixed).toBeGreaterThan(0);
    expect(document.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('suggestAria returns role for clickable div', () => {
    const div = document.createElement('div');
    div.setAttribute('onclick', 'doSomething()');
    const suggestion = agent.suggestAria(div);
    expect(suggestion['role']).toBe('button');
    expect(suggestion['tabindex']).toBe('0');
  });

  it('scan updates violations signal', async () => {
    document.body.innerHTML = '<img src="cat.jpg">';
    await agent.scan(document.body);
    expect(agent.violations().length).toBeGreaterThan(0);
  });

  it('scanning signal is false after scan completes', async () => {
    await agent.scan(document.body);
    expect(agent.scanning()).toBe(false);
  });
});
