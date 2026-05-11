import { describe, it, expect } from 'vitest';
import { noUntrackedEffectRule, preferComputedRule, noSignalInConditionRule, noMutateInRenderRule } from '../rules.js';
import { plugin } from '../index.js';

describe('no-untracked-effect', () => {
  it('fires on peek() inside effect', () => {
    const code = `
effect(() => {
  const val = mySignal.peek();
  console.log(val);
});
    `;
    const violations = noUntrackedEffectRule.check(code);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]?.messageId).toBe('noPeekInEffect');
  });

  it('passes on normal effect without peek', () => {
    const code = `
effect(() => {
  const val = mySignal();
  console.log(val);
});
    `;
    const violations = noUntrackedEffectRule.check(code);
    expect(violations).toHaveLength(0);
  });
});

describe('prefer-computed', () => {
  it('fires on effect with return', () => {
    const code = `
effect(() => {
  return mySignal() * 2;
});
    `;
    const violations = preferComputedRule.check(code);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]?.messageId).toBe('useComputed');
  });

  it('passes on effect without return', () => {
    const code = `
effect(() => {
  document.title = mySignal();
});
    `;
    const violations = preferComputedRule.check(code);
    expect(violations).toHaveLength(0);
  });
});

describe('no-signal-in-condition', () => {
  it('fires on `if (mySignal)` (bare signal in condition)', () => {
    const code = `
if (mySignal) {
  doSomething();
}
    `;
    const violations = noSignalInConditionRule.check(code);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]?.messageId).toBe('callSignal');
  });

  it('passes on `if (mySignal())` (properly called)', () => {
    const code = `
if (mySignal()) {
  doSomething();
}
    `;
    const violations = noSignalInConditionRule.check(code);
    expect(violations).toHaveLength(0);
  });
});

describe('no-mutate-in-render', () => {
  it('fires on .set() in render function', () => {
    const code = `
function render() {
  mySignal.set(42);
  return '<div></div>';
}
    `;
    const violations = noMutateInRenderRule.check(code);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]?.messageId).toBe('noMutateInRender');
  });

  it('passes on .set() outside render function', () => {
    const code = `
function handleClick() {
  mySignal.set(42);
}
    `;
    const violations = noMutateInRenderRule.check(code);
    expect(violations).toHaveLength(0);
  });
});

describe('plugin', () => {
  it('exports rules object', () => {
    expect(plugin.rules).toBeDefined();
    expect(typeof plugin.rules).toBe('object');
  });

  it('exports configs.recommended', () => {
    expect(plugin.configs.recommended).toBeDefined();
    expect(plugin.configs.recommended.rules).toBeDefined();
  });

  it('recommended config has all 4 rules', () => {
    const ruleKeys = Object.keys(plugin.configs.recommended.rules);
    expect(ruleKeys).toContain('@drishti/no-untracked-effect');
    expect(ruleKeys).toContain('@drishti/prefer-computed');
    expect(ruleKeys).toContain('@drishti/no-signal-in-condition');
    expect(ruleKeys).toContain('@drishti/no-mutate-in-render');
  });

  it('each rule has meta.docs.description', () => {
    for (const [, rule] of Object.entries(plugin.rules)) {
      expect(typeof rule.meta.docs.description).toBe('string');
      expect(rule.meta.docs.description.length).toBeGreaterThan(0);
    }
  });
});
