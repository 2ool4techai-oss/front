import { noUntrackedEffectRule, preferComputedRule, noSignalInConditionRule, noMutateInRenderRule } from './rules.js';

export { noUntrackedEffectRule, preferComputedRule, noSignalInConditionRule, noMutateInRenderRule } from './rules.js';
export type { LintRule, LintViolation } from './rules.js';

export const plugin = {
  name: '@nexoraaidrishti/eslint-plugin',
  rules: {
    'no-untracked-effect':    noUntrackedEffectRule,
    'prefer-computed':        preferComputedRule,
    'no-signal-in-condition': noSignalInConditionRule,
    'no-mutate-in-render':    noMutateInRenderRule,
  },
  configs: {
    recommended: {
      rules: {
        '@nexoraaidrishti/no-untracked-effect':    'warn',
        '@nexoraaidrishti/prefer-computed':        'warn',
        '@nexoraaidrishti/no-signal-in-condition': 'error',
        '@nexoraaidrishti/no-mutate-in-render':    'error',
      },
    },
  },
};
