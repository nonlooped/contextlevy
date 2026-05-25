import { DEFAULT_SEVERITY_THRESHOLDS } from './defaults';
import type { SeverityThresholds } from './types';

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

export function getRiskLevel(
  totalTokens: number,
  highImpactCount: number,
  thresholds: SeverityThresholds = DEFAULT_SEVERITY_THRESHOLDS,
): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (
    totalTokens >= thresholds.criticalTokens ||
    highImpactCount >= thresholds.criticalHighImpactCount
  ) {
    return 'Critical';
  }
  if (totalTokens >= thresholds.highTokens || highImpactCount >= thresholds.highHighImpactCount) {
    return 'High';
  }
  if (
    totalTokens >= thresholds.mediumTokens ||
    highImpactCount >= thresholds.mediumHighImpactCount
  ) {
    return 'Medium';
  }
  return 'Low';
}

export function formatRiskLevel(riskLevel: ReturnType<typeof getRiskLevel>): string {
  return `${RISK_LEVEL_EMOJI[riskLevel]} ${riskLevel}`;
}
