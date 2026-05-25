import { DEFAULT_SEVERITY_THRESHOLDS } from '../core/defaults';
import { DEFAULT_PRICING_PROFILES } from '../core/pricing';
import type {
  CommentFormat,
  CustomRule,
  EstimationMode,
  PricingProfile,
  SeverityThresholds,
} from '../core/types';
import type { ContextLevyConfig, SeverityLevel } from './types';

export { DEFAULT_SEVERITY_THRESHOLDS };

export interface ContextLevySettings {
  tokenThreshold: number;
  largeFileTokenThreshold: number;
  maxHighImpactItems: number;
  showCostTable: boolean;
  pricingProfiles: PricingProfile[];
  commentFormat: CommentFormat;
  ignorePaths: string[];
  allowPaths: string[];
  failOnSeverity?: SeverityLevel;
  failAboveTokens?: number;
  estimationMode: EstimationMode;
  customRules: CustomRule[];
  severityThresholds: SeverityThresholds;
}

const DEFAULTS: ContextLevySettings = {
  tokenThreshold: 1000,
  largeFileTokenThreshold: 5000,
  maxHighImpactItems: 5,
  showCostTable: true,
  pricingProfiles: DEFAULT_PRICING_PROFILES,
  commentFormat: 'default',
  ignorePaths: [],
  allowPaths: [],
  estimationMode: 'simple',
  customRules: [],
  severityThresholds: DEFAULT_SEVERITY_THRESHOLDS,
};

export function resolveSeverityThresholds(
  partial: Partial<SeverityThresholds> | undefined,
): SeverityThresholds {
  return {
    mediumTokens: partial?.mediumTokens ?? DEFAULT_SEVERITY_THRESHOLDS.mediumTokens,
    highTokens: partial?.highTokens ?? DEFAULT_SEVERITY_THRESHOLDS.highTokens,
    criticalTokens: partial?.criticalTokens ?? DEFAULT_SEVERITY_THRESHOLDS.criticalTokens,
    mediumHighImpactCount:
      partial?.mediumHighImpactCount ?? DEFAULT_SEVERITY_THRESHOLDS.mediumHighImpactCount,
    highHighImpactCount:
      partial?.highHighImpactCount ?? DEFAULT_SEVERITY_THRESHOLDS.highHighImpactCount,
    criticalHighImpactCount:
      partial?.criticalHighImpactCount ?? DEFAULT_SEVERITY_THRESHOLDS.criticalHighImpactCount,
  };
}

export function resolveSettings(config: ContextLevyConfig | null): ContextLevySettings {
  return {
    tokenThreshold: config?.tokenThreshold ?? DEFAULTS.tokenThreshold,
    largeFileTokenThreshold: config?.largeFileTokenThreshold ?? DEFAULTS.largeFileTokenThreshold,
    maxHighImpactItems: config?.maxHighImpactItems ?? DEFAULTS.maxHighImpactItems,
    showCostTable: config?.showCostTable ?? DEFAULTS.showCostTable,
    pricingProfiles: config?.pricingProfiles ?? DEFAULTS.pricingProfiles,
    commentFormat: config?.commentFormat ?? DEFAULTS.commentFormat,
    ignorePaths: config?.ignorePaths ?? DEFAULTS.ignorePaths,
    allowPaths: config?.allowPaths ?? DEFAULTS.allowPaths,
    failOnSeverity: config?.failOnSeverity,
    failAboveTokens: config?.failAboveTokens,
    estimationMode: config?.estimationMode ?? DEFAULTS.estimationMode,
    customRules: config?.customRules ?? DEFAULTS.customRules,
    severityThresholds: resolveSeverityThresholds(config?.severityThresholds),
  };
}
