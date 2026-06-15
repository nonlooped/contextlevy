import type { RepoDebtGrade } from '../core/scan';
import type { PullRequestAnalysis } from '../core/types';
import { formatCompactTokens } from './shared';

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

const RISK_COLORS: Record<RiskLevel, string> = {
  Low: 'brightgreen',
  Medium: 'yellow',
  High: 'orange',
  Critical: 'red',
};

const GRADE_COLORS: Record<RepoDebtGrade, string> = {
  A: 'brightgreen',
  B: 'green',
  C: 'yellow',
  D: 'orange',
  F: 'red',
};

function encodeShieldSegment(value: string): string {
  return encodeURIComponent(value.replace(/-/g, '--').replace(/_/g, '__'));
}

export function buildRiskBadgeUrl(riskLevel: RiskLevel, totalTokens?: number): string {
  const message =
    totalTokens !== undefined
      ? `${riskLevel} · ${formatCompactTokens(totalTokens)} tokens`
      : riskLevel;
  const color = RISK_COLORS[riskLevel];
  return `https://img.shields.io/badge/${encodeShieldSegment('context risk')}-${encodeShieldSegment(message)}-${color}?logo=github&labelColor=24292e`;
}

export function buildDebtBadgeUrl(score: number, grade: RepoDebtGrade): string {
  const message = `${grade} · ${score}/100`;
  const color = GRADE_COLORS[grade];
  return `https://img.shields.io/badge/${encodeShieldSegment('context debt')}-${encodeShieldSegment(message)}-${color}?logo=github&labelColor=24292e`;
}

export function buildTokenBadgeUrl(analysis: PullRequestAnalysis): string {
  const message = `+${formatCompactTokens(analysis.totalEstimatedTokens)} tokens`;
  return `https://img.shields.io/badge/${encodeShieldSegment('context delta')}-${encodeShieldSegment(message)}-blue?logo=github&labelColor=24292e`;
}

export function buildBadgeMarkdown(imageUrl: string, alt: string): string {
  return `![${alt}](${imageUrl})`;
}
