import type { ContextLevyConfig } from './config';
import { DEFAULT_PRICING_PROFILES } from './pricing';
import type { CommentFormat, PricingProfile } from './types';

export interface ContextLevySettings {
  tokenThreshold: number;
  largeFileTokenThreshold: number;
  maxHighImpactItems: number;
  showCostTable: boolean;
  pricingProfiles: PricingProfile[];
  commentFormat: CommentFormat;
}

const DEFAULTS: ContextLevySettings = {
  tokenThreshold: 1000,
  largeFileTokenThreshold: 5000,
  maxHighImpactItems: 5,
  showCostTable: true,
  pricingProfiles: DEFAULT_PRICING_PROFILES,
  commentFormat: 'default',
};

export function resolveSettings(config: ContextLevyConfig | null): ContextLevySettings {
  return {
    tokenThreshold: config?.tokenThreshold ?? DEFAULTS.tokenThreshold,
    largeFileTokenThreshold: config?.largeFileTokenThreshold ?? DEFAULTS.largeFileTokenThreshold,
    maxHighImpactItems: config?.maxHighImpactItems ?? DEFAULTS.maxHighImpactItems,
    showCostTable: config?.showCostTable ?? DEFAULTS.showCostTable,
    pricingProfiles: config?.pricingProfiles ?? DEFAULTS.pricingProfiles,
    commentFormat: config?.commentFormat ?? DEFAULTS.commentFormat,
  };
}
