import type { SeverityLevel } from '../config/types';
import { getHighImpactFiles } from './analyze';
import { getRiskLevel, severityMeetsThreshold } from './severity';
import type { ContextCategory, PullRequestAnalysis, SeverityThresholds } from './types';

export interface FailSettings {
  failOnSeverity?: SeverityLevel;
  failAboveTokens?: number;
  failOnCategories?: ContextCategory[];
  warnOnlyCategories?: ContextCategory[];
  severityThresholds?: SeverityThresholds;
}

export interface FailDecision {
  fail: boolean;
  reason?: string;
}

function getMatchingCategories(
  analysis: PullRequestAnalysis,
  categories: ContextCategory[],
): ContextCategory[] {
  if (categories.length === 0) {
    return [];
  }

  const categorySet = new Set(categories);
  const matched = new Set<ContextCategory>();

  for (const file of analysis.files) {
    if (categorySet.has(file.category)) {
      matched.add(file.category);
    }
  }

  return [...matched];
}

export function shouldFailRun(
  analysis: PullRequestAnalysis,
  settings: FailSettings,
  maxHighImpactItems = 5,
): FailDecision {
  if (settings.failOnCategories && settings.failOnCategories.length > 0) {
    const matched = getMatchingCategories(analysis, settings.failOnCategories);
    const hardMatches = matched.filter(
      (category) => !settings.warnOnlyCategories?.includes(category),
    );
    if (hardMatches.length > 0) {
      return {
        fail: true,
        reason: `Diff includes forbidden context categories: ${hardMatches.join(', ')}.`,
      };
    }
  }

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
      highImpact,
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
