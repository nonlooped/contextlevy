import * as core from '@actions/core';
import type { ContextLevySettings } from '../config/settings';
import { getHighImpactFiles } from '../core/analyze';
import type { FailDecision } from '../core/fail';
import { formatRiskLevel, getRiskLevel } from '../core/severity';
import type { PullRequestAnalysis } from '../core/types';
import { formatCompactTokens } from '../format/shared';

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
