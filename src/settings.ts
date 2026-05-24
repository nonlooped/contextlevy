import type { ContextLevyConfig } from './config';
import { parseCommentFormat, parsePricingProfilesValue } from './config';
import { DEFAULT_PRICING_PROFILES, parseBooleanInput, parsePricingProfiles } from './pricing';
import type { CommentFormat, PricingProfile } from './types';

export interface ContextLevySettings {
  tokenThreshold: number;
  largeFileTokenThreshold: number;
  maxHighImpactItems: number;
  showCostTable: boolean;
  pricingProfiles: PricingProfile[];
  commentFormat: CommentFormat;
}

export interface SettingsInputs {
  tokenThreshold: string;
  largeFileTokenThreshold: string;
  maxHighImpactItems: string;
  showCostTable: string;
  pricingProfiles: string;
  modelPricing: string;
  commentFormat: string;
}

const DEFAULTS: ContextLevySettings = {
  tokenThreshold: 1000,
  largeFileTokenThreshold: 5000,
  maxHighImpactItems: 5,
  showCostTable: true,
  pricingProfiles: DEFAULT_PRICING_PROFILES,
  commentFormat: 'default',
};

function readNumberInput(value: string, fieldName: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }

  return parsed;
}

function resolvePricingProfiles(
  config: ContextLevyConfig | null,
  inputs: SettingsInputs,
): PricingProfile[] {
  const pricingProfilesInput = inputs.pricingProfiles.trim() || inputs.modelPricing.trim();
  if (pricingProfilesInput) {
    return parsePricingProfiles(pricingProfilesInput);
  }

  if (config?.pricingProfiles !== undefined) {
    return config.pricingProfiles;
  }

  return DEFAULTS.pricingProfiles;
}

export function resolveSettings(
  config: ContextLevyConfig | null,
  inputs: SettingsInputs,
): ContextLevySettings {
  const showCostTableInput = inputs.showCostTable.trim();
  const showCostTableDefault =
    config?.showCostTable !== undefined ? config.showCostTable : DEFAULTS.showCostTable;

  return {
    tokenThreshold:
      readNumberInput(inputs.tokenThreshold, 'token-threshold') ??
      config?.tokenThreshold ??
      DEFAULTS.tokenThreshold,
    largeFileTokenThreshold:
      readNumberInput(inputs.largeFileTokenThreshold, 'large-file-token-threshold') ??
      config?.largeFileTokenThreshold ??
      DEFAULTS.largeFileTokenThreshold,
    maxHighImpactItems:
      readNumberInput(inputs.maxHighImpactItems, 'max-high-impact-items') ??
      config?.maxHighImpactItems ??
      DEFAULTS.maxHighImpactItems,
    showCostTable: parseBooleanInput(showCostTableInput, showCostTableDefault),
    pricingProfiles: resolvePricingProfiles(config, inputs),
    commentFormat:
      parseCommentFormat(inputs.commentFormat, 'comment-format') ??
      config?.commentFormat ??
      DEFAULTS.commentFormat,
  };
}
