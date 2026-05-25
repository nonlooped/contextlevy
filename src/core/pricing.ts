import type { PricingProfile } from './types';

export const DEFAULT_PRICING_PROFILES: PricingProfile[] = [
  { name: 'GPT-5.5', inputCostPerMillion: 5.0 },
  { name: 'Opus 4.7', inputCostPerMillion: 5.0 },
  { name: 'Gemini 3.1 Pro', inputCostPerMillion: 2.0 },
  { name: 'Kimi K2.6', inputCostPerMillion: 0.95 },
];

export function estimateSessionCost(estimatedTokens: number, inputCostPerMillion: number): number {
  return (estimatedTokens / 1_000_000) * inputCostPerMillion;
}
