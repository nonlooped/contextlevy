import type {
  CommentFormat,
  ContextCategory,
  CustomRule,
  EstimationMode,
  PricingProfile,
  SeverityThresholds,
} from '../core/types';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export type ContextLevyMode = 'advisory' | 'strict' | 'minimal' | 'legacy';

export interface ContextLevyConfig {
  mode?: ContextLevyMode;
  tokenThreshold?: number;
  largeFileTokenThreshold?: number;
  maxHighImpactItems?: number;
  showCostTable?: boolean;
  pricingProfiles?: PricingProfile[];
  commentFormat?: CommentFormat;
  commentOnHygiene?: boolean;
  ignorePaths?: string[];
  allowPaths?: string[];
  failOnSeverity?: SeverityLevel;
  failAboveTokens?: number;
  failOnCategories?: ContextCategory[];
  warnOnlyCategories?: ContextCategory[];
  estimationMode?: EstimationMode;
  customRules?: CustomRule[];
  severityThresholds?: Partial<SeverityThresholds>;
}
