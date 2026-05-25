import type { SeverityThresholds } from './types';

export const DEFAULT_SEVERITY_THRESHOLDS: SeverityThresholds = {
  mediumTokens: 5_000,
  highTokens: 20_000,
  criticalTokens: 100_000,
  mediumHighImpactCount: 1,
  highHighImpactCount: 3,
  criticalHighImpactCount: 8,
};
