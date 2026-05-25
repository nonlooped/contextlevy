import { HARD_FAIL_CATEGORIES, WARN_ONLY_CATEGORIES } from '../core/categories';
import { DEFAULT_SEVERITY_THRESHOLDS } from '../core/defaults';
import { DEFAULT_PRICING_PROFILES } from '../core/pricing';
import type {
  CommentFormat,
  ContextCategory,
  CustomRule,
  EstimationMode,
  PricingProfile,
  SeverityThresholds,
} from '../core/types';
import type { ContextLevyConfig, ContextLevyMode, SeverityLevel } from './types';

export interface ContextLevySettings {
  mode: ContextLevyMode;
  tokenThreshold: number;
  largeFileTokenThreshold: number;
  maxHighImpactItems: number;
  showCostTable: boolean;
  pricingProfiles: PricingProfile[];
  commentFormat: CommentFormat;
  commentOnHygiene: boolean;
  ignorePaths: string[];
  allowPaths: string[];
  failOnSeverity?: SeverityLevel;
  failAboveTokens?: number;
  failOnCategories: ContextCategory[];
  warnOnlyCategories: ContextCategory[];
  estimationMode: EstimationMode;
  customRules: CustomRule[];
  severityThresholds: SeverityThresholds;
}

const LEGACY_DEFAULTS: Omit<ContextLevySettings, 'mode'> = {
  tokenThreshold: 1000,
  largeFileTokenThreshold: 5000,
  maxHighImpactItems: 5,
  showCostTable: true,
  pricingProfiles: DEFAULT_PRICING_PROFILES,
  commentFormat: 'default',
  commentOnHygiene: false,
  ignorePaths: [],
  allowPaths: [],
  failOnSeverity: undefined,
  failAboveTokens: undefined,
  failOnCategories: [],
  warnOnlyCategories: [],
  estimationMode: 'simple',
  customRules: [],
  severityThresholds: DEFAULT_SEVERITY_THRESHOLDS,
};

const ADVISORY_PRESET: Partial<ContextLevySettings> = {
  commentFormat: 'compact',
  showCostTable: false,
  commentOnHygiene: true,
  tokenThreshold: 2000,
  failOnCategories: [],
  warnOnlyCategories: [],
};

const STRICT_PRESET: Partial<ContextLevySettings> = {
  ...ADVISORY_PRESET,
  failOnCategories: [...HARD_FAIL_CATEGORIES],
  warnOnlyCategories: [...WARN_ONLY_CATEGORIES],
};

const MINIMAL_PRESET: Partial<ContextLevySettings> = {
  commentFormat: 'compact',
  showCostTable: false,
  commentOnHygiene: false,
  tokenThreshold: 20_000,
  failOnCategories: [],
  warnOnlyCategories: [],
};

function getModePreset(mode: ContextLevyMode): Partial<ContextLevySettings> {
  switch (mode) {
    case 'strict':
      return STRICT_PRESET;
    case 'minimal':
      return MINIMAL_PRESET;
    case 'legacy':
      return LEGACY_DEFAULTS;
    default:
      return ADVISORY_PRESET;
  }
}

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

function applyExplicitOverrides(
  base: ContextLevySettings,
  config: ContextLevyConfig,
): ContextLevySettings {
  return {
    mode: config.mode ?? base.mode,
    tokenThreshold: config.tokenThreshold ?? base.tokenThreshold,
    largeFileTokenThreshold: config.largeFileTokenThreshold ?? base.largeFileTokenThreshold,
    maxHighImpactItems: config.maxHighImpactItems ?? base.maxHighImpactItems,
    showCostTable: config.showCostTable ?? base.showCostTable,
    pricingProfiles: config.pricingProfiles ?? base.pricingProfiles,
    commentFormat: config.commentFormat ?? base.commentFormat,
    commentOnHygiene: config.commentOnHygiene ?? base.commentOnHygiene,
    ignorePaths: config.ignorePaths ?? base.ignorePaths,
    allowPaths: config.allowPaths ?? base.allowPaths,
    failOnSeverity: config.failOnSeverity ?? base.failOnSeverity,
    failAboveTokens: config.failAboveTokens ?? base.failAboveTokens,
    failOnCategories: config.failOnCategories ?? base.failOnCategories,
    warnOnlyCategories: config.warnOnlyCategories ?? base.warnOnlyCategories,
    estimationMode: config.estimationMode ?? base.estimationMode,
    customRules: config.customRules ?? base.customRules,
    severityThresholds: resolveSeverityThresholds(
      config.severityThresholds ?? base.severityThresholds,
    ),
  };
}

export function resolveSettings(config: ContextLevyConfig | null): ContextLevySettings {
  const mode = config?.mode ?? 'advisory';
  const preset = getModePreset(mode);

  const base: ContextLevySettings = {
    mode,
    tokenThreshold: preset.tokenThreshold ?? LEGACY_DEFAULTS.tokenThreshold,
    largeFileTokenThreshold:
      preset.largeFileTokenThreshold ?? LEGACY_DEFAULTS.largeFileTokenThreshold,
    maxHighImpactItems: preset.maxHighImpactItems ?? LEGACY_DEFAULTS.maxHighImpactItems,
    showCostTable: preset.showCostTable ?? LEGACY_DEFAULTS.showCostTable,
    pricingProfiles: preset.pricingProfiles ?? LEGACY_DEFAULTS.pricingProfiles,
    commentFormat: preset.commentFormat ?? LEGACY_DEFAULTS.commentFormat,
    commentOnHygiene: preset.commentOnHygiene ?? LEGACY_DEFAULTS.commentOnHygiene,
    ignorePaths: preset.ignorePaths ?? LEGACY_DEFAULTS.ignorePaths,
    allowPaths: preset.allowPaths ?? LEGACY_DEFAULTS.allowPaths,
    failOnSeverity: preset.failOnSeverity,
    failAboveTokens: preset.failAboveTokens,
    failOnCategories: preset.failOnCategories ?? LEGACY_DEFAULTS.failOnCategories,
    warnOnlyCategories: preset.warnOnlyCategories ?? LEGACY_DEFAULTS.warnOnlyCategories,
    estimationMode: preset.estimationMode ?? LEGACY_DEFAULTS.estimationMode,
    customRules: preset.customRules ?? LEGACY_DEFAULTS.customRules,
    severityThresholds: resolveSeverityThresholds(preset.severityThresholds),
  };

  if (!config) {
    return base;
  }

  return applyExplicitOverrides(base, config);
}
