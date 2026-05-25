import type { SeverityLevel } from '../config/types';
import { getHighImpactFiles } from './analyze';
import { getRiskLevel, severityMeetsThreshold } from './severity';
import type { PullRequestAnalysis, SeverityThresholds } from './types';

export interface FailSettings {
  failOnSeverity?: SeverityLevel;
  failAboveTokens?: number;
  severityThresholds?: SeverityThresholds;
}

export interface FailDecision {
  fail: boolean;
  reason?: string;
}

export function shouldFailRun(
  analysis: PullRequestAnalysis,
  settings: FailSettings,
  maxHighImpactItems = 5,
): FailDecision {
  if (settings.failAboveTokens !== undefined) {
    if (analysis.totalEstimatedTokens > settings.failAboveTokens) {
      return {
        fail: true,
        reason: `Estimated context tokens (${analysis.totalEstimatedTokens}) exceed fail-above-tokens (${settings.failAboveTokens}).`,
      };
    }
  }

  if (settings.failOnSeverity !== undefined) {
    const highImpact = getHighImpactFiles(analysis, maxHighImpactItems);
    const riskLevel = getRiskLevel(
      analysis.totalEstimatedTokens,
      highImpact.length,
      settings.severityThresholds,
    );
    if (severityMeetsThreshold(riskLevel, settings.failOnSeverity)) {
      return {
        fail: true,
        reason: `Context risk level (${riskLevel}) meets or exceeds fail-on-severity (${settings.failOnSeverity}).`,
      };
    }
  }

  return { fail: false };
}
