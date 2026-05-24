import * as core from '@actions/core';
import { getHighImpactFiles } from './analyze';
import { formatCompactTokens, formatRiskLevel, getRiskLevel } from './comment';
import type { FailDecision } from './fail';
import type { ContextLevySettings } from './settings';
import type { PullRequestAnalysis } from './types';

export async function writeJobSummary(
  analysis: PullRequestAnalysis,
  settings: ContextLevySettings,
  failDecision: FailDecision,
): Promise<void> {
  const highImpact = getHighImpactFiles(analysis, settings.maxHighImpactItems);
  const riskLevel = getRiskLevel(
    analysis.totalEstimatedTokens,
    highImpact.length,
    settings.severityThresholds,
  );

  const summary = core.summary
    .addHeading('ContextLevy')
    .addRaw(
      `Estimated **+${formatCompactTokens(analysis.totalEstimatedTokens)}** net-new context tokens across **${analysis.files.length}** analyzed file(s).`,
    )
    .addEOL()
    .addRaw(`**Risk level:** ${formatRiskLevel(riskLevel)}`)
    .addEOL()
    .addRaw(`**Estimation mode:** \`${settings.estimationMode}\``)
    .addEOL();

  if (highImpact.length > 0) {
    summary.addHeading('Top findings', 3);
    summary.addTable([
      [
        { data: 'File', header: true },
        { data: 'Added tokens', header: true },
        { data: 'Category', header: true },
      ],
      ...highImpact.map((file) => [
        file.filename,
        `+${formatCompactTokens(file.estimatedTokens)}`,
        file.category,
      ]),
    ]);
  }

  if (failDecision.fail) {
    summary.addEOL().addRaw(`**Workflow failed:** ${failDecision.reason ?? 'Threshold exceeded.'}`);
  }

  await summary.write();
}
