import { DEFAULT_SEVERITY_THRESHOLDS } from './defaults';
import type { ContextCategory, FileAnalysis, SeverityThresholds } from './types';

const SEVERITY_RANK = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
} as const;

export const RISK_LEVEL_EMOJI: Record<ReturnType<typeof getRiskLevel>, string> = {
  Low: '🟢',
  Medium: '🟡',
  High: '🔴',
  Critical: '⛔',
};

export function severityMeetsThreshold(
  actual: ReturnType<typeof getRiskLevel>,
  threshold: 'low' | 'medium' | 'high' | 'critical',
): boolean {
  const thresholdRank =
    threshold === 'low' ? 0 : threshold === 'medium' ? 1 : threshold === 'high' ? 2 : 3;
  return SEVERITY_RANK[actual] >= thresholdRank;
}

function countHardHighImpact(highImpact: FileAnalysis[]): number {
  return highImpact.filter(
    (file) => file.category !== 'lockfile' && file.category !== 'agent-config',
  ).length;
}

export function getRiskLevel(
  totalTokens: number,
  highImpact: FileAnalysis[],
  thresholds: SeverityThresholds = DEFAULT_SEVERITY_THRESHOLDS,
): 'Low' | 'Medium' | 'High' | 'Critical' {
  const hardCount = countHardHighImpact(highImpact);
  const hasAgentConfig = highImpact.some((file) => file.category === 'agent-config');
  const onlySoftCategories = highImpact.length > 0 && hardCount === 0;

  if (totalTokens >= thresholds.criticalTokens || hardCount >= thresholds.criticalHighImpactCount) {
    return 'Critical';
  }

  if (totalTokens >= thresholds.highTokens || hardCount >= thresholds.highHighImpactCount) {
    return 'High';
  }

  if (hasAgentConfig) {
    return 'Medium';
  }

  if (onlySoftCategories) {
    return totalTokens >= thresholds.mediumTokens ? 'Medium' : 'Low';
  }

  if (totalTokens >= thresholds.mediumTokens || hardCount >= thresholds.mediumHighImpactCount) {
    return 'Medium';
  }

  return 'Low';
}

export function formatRiskLevel(riskLevel: ReturnType<typeof getRiskLevel>): string {
  return `${RISK_LEVEL_EMOJI[riskLevel]} ${riskLevel}`;
}

export function getHighImpactCategories(highImpact: FileAnalysis[]): ContextCategory[] {
  const seen = new Set<ContextCategory>();
  const categories: ContextCategory[] = [];
  for (const file of highImpact) {
    if (file.category === 'other' || seen.has(file.category)) {
      continue;
    }
    seen.add(file.category);
    categories.push(file.category);
  }
  return categories;
}
