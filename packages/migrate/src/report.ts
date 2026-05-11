import type { AnalysisResult } from './analyzer.js';
import type { CodemodResult } from './codemods/react.js';

export function generateMigrationReport(
  analysis: AnalysisResult,
  codemods: CodemodResult[]
): string {
  const lines: string[] = [];

  lines.push('# Drishti Migration Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Framework detected:** ${analysis.framework}`);
  if (analysis.version !== null) {
    lines.push(`- **Version:** ${analysis.version}`);
  }
  lines.push(`- **Components:** ${analysis.componentCount}`);
  lines.push(`- **Signal patterns:** ${analysis.signalPatterns}`);
  lines.push(`- **Complexity score:** ${analysis.complexityScore}/100`);
  lines.push(`- **Estimated migration hours:** ${analysis.estimatedHours.toFixed(1)}`);
  lines.push('');

  // Complexity rating
  const complexityLabel =
    analysis.complexityScore >= 75
      ? 'High'
      : analysis.complexityScore >= 40
      ? 'Medium'
      : 'Low';
  lines.push(`> **Complexity rating: ${complexityLabel}**`);
  lines.push('');

  // Breakdown
  lines.push('## Breakdown');
  lines.push('');
  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  lines.push(`| Components | ${analysis.breakdown.components} |`);
  lines.push(`| State usages | ${analysis.breakdown.stateUsages} |`);
  lines.push(`| Effect usages | ${analysis.breakdown.effectUsages} |`);
  lines.push(`| Router usages | ${analysis.breakdown.routerUsages} |`);
  lines.push(`| Context usages | ${analysis.breakdown.contextUsages} |`);
  lines.push('');

  // Codemod results
  if (codemods.length > 0) {
    lines.push('## Codemod Results');
    lines.push('');

    let totalChanges = 0;
    let totalWarnings = 0;
    let totalManualReview = 0;

    for (const codemod of codemods) {
      totalChanges += codemod.changes.length;
      totalWarnings += codemod.warnings.length;
      totalManualReview += codemod.manualReviewNeeded.length;
    }

    lines.push(`- **Automated changes:** ${totalChanges}`);
    lines.push(`- **Warnings:** ${totalWarnings}`);
    lines.push(`- **Manual review items:** ${totalManualReview}`);
    lines.push('');

    // Warnings
    const allWarnings = codemods.flatMap((c) => c.warnings);
    if (allWarnings.length > 0) {
      lines.push('### Warnings');
      lines.push('');
      for (const warning of allWarnings) {
        lines.push(`- ${warning}`);
      }
      lines.push('');
    }

    // Manual review
    const allManualReview = codemods.flatMap((c) => c.manualReviewNeeded);
    if (allManualReview.length > 0) {
      lines.push('### Manual Review Required');
      lines.push('');
      for (const item of allManualReview) {
        lines.push(`- [ ] ${item}`);
      }
      lines.push('');
    }

    // Changes detail
    lines.push('### Changes Applied');
    lines.push('');
    for (let i = 0; i < codemods.length; i++) {
      const codemod = codemods[i];
      if (codemod === undefined) continue;
      if (codemod.changes.length === 0) continue;
      lines.push(`#### File ${i + 1}`);
      lines.push('');
      for (const change of codemod.changes) {
        lines.push(`- Line ${change.line}: \`${change.from}\` → \`${change.to}\``);
      }
      lines.push('');
    }
  }

  // Recommendations
  lines.push('## Recommendations');
  lines.push('');
  for (const rec of analysis.recommendations) {
    lines.push(`- ${rec}`);
  }
  lines.push('');

  // Next steps
  lines.push('## Next Steps');
  lines.push('');
  lines.push('1. Review all automated changes in version control');
  lines.push('2. Address manual review items listed above');
  lines.push('3. Run your test suite after each file migration');
  lines.push('4. Consult the [Drishti migration guide](https://drishti.dev/migrate) for edge cases');
  lines.push('');

  return lines.join('\n');
}
