import type {
  CommentFormat,
  CustomRule,
  EstimationMode,
  PricingProfile,
  SeverityThresholds,
} from '../core/types';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ContextLevyConfig {
  tokenThreshold?: number;
  largeFileTokenThreshold?: number;
  maxHighImpactItems?: number;
  showCostTable?: boolean;
  pricingProfiles?: PricingProfile[];
  commentFormat?: CommentFormat;
  ignorePaths?: string[];
  allowPaths?: string[];
  failOnSeverity?: SeverityLevel;
  failAboveTokens?: number;
  estimationMode?: EstimationMode;
  customRules?: CustomRule[];
  severityThresholds?: Partial<SeverityThresholds>;
}
