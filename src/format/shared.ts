import { DEFAULT_SEVERITY_THRESHOLDS } from '../core/defaults';
import type { SeverityThresholds } from '../core/types';

export const COMPACT_MAX_FINDINGS = 3;
export const COMPACT_MAX_SUGGESTIONS = 2;

export function formatCompactTokens(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return value.toLocaleString('en-US');
}

export function resolveSeverityThresholds(options: {
  severityThresholds?: SeverityThresholds;
}): SeverityThresholds {
  return options.severityThresholds ?? DEFAULT_SEVERITY_THRESHOLDS;
}

export function formatCostRange(cost: number): string {
  const low = cost * 0.5;
  const high = cost * 1.5;
  if (Math.abs(low - high) < 0.005) {
    return `~${formatUsd(cost)}`;
  }
  return `~${formatUsd(low)}–${formatUsd(high)}`;
}

export function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
