import type { ContextLevySettings } from '../config/settings';
import { getHighImpactFiles } from './analyze';
import { getRiskLevel, severityMeetsThreshold } from './severity';
import type { PullRequestAnalysis } from './types';

export function shouldPostComment(
  analysis: PullRequestAnalysis,
  settings: Pick<
    ContextLevySettings,
    'tokenThreshold' | 'commentOnHygiene' | 'mode' | 'severityThresholds'
  >,
): boolean {
  if (analysis.files.length === 0) {
    return false;
  }

  const highImpact = getHighImpactFiles(analysis, analysis.files.length);

  if (settings.mode === 'minimal') {
    const riskLevel = getRiskLevel(
      analysis.totalEstimatedTokens,
      highImpact,
      settings.severityThresholds,
    );
    return severityMeetsThreshold(riskLevel, 'high');
  }

  if (analysis.totalEstimatedTokens >= settings.tokenThreshold) {
    return true;
  }

  if (highImpact.some((file) => file.category === 'agent-config')) {
    return settings.mode !== 'legacy';
  }

  if (settings.commentOnHygiene && highImpact.length > 0) {
    return true;
  }

  return false;
}
