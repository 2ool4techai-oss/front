import { noUntrackedEffectRule, preferComputedRule, noSignalInConditionRule, noMutateInRenderRule } from './rules.js';

export { noUntrackedEffectRule, preferComputedRule, noSignalInConditionRule, noMutateInRenderRule } from './rules.js';
export type { LintRule, LintViolation } from './rules.js';

export const plugin = {
  name: '@drishti/eslint-plugin',
  rules: {
    'no-untracked-effect':    noUntrackedEffectRule,
    'prefer-computed':        preferComputedRule,
    'no-signal-in-condition': noSignalInConditionRule,
    'no-mutate-in-render':    noMutateInRenderRule,
  },
  configs: {
    recommended: {
      rules: {
        '@drishti/no-untracked-effect':    'warn',
        '@drishti/prefer-computed':        'warn',
        '@drishti/no-signal-in-condition': 'error',
        '@drishti/no-mutate-in-render':    'error',
      },
    },
  },
};
