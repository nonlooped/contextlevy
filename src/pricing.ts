import type { PricingProfile } from './types';
import { parsePricingProfilesValue } from './config';

export const DEFAULT_PRICING_PROFILES: PricingProfile[] = [
  { name: 'GPT-5.5', inputCostPerMillion: 2.9 },
  { name: 'Opus 4.7', inputCostPerMillion: 8.0 },
  { name: 'Gemini 3.1 Pro', inputCostPerMillion: 1.5 },
  { name: 'Kimi K2.6', inputCostPerMillion: 0.4 },
];

function readProfileName(record: Record<string, unknown>, index: number): string {
  const name = record.name ?? record.profile;

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error(
      `pricing-profiles[${index}] must include a non-empty "name" or "profile" string.`,
    );
  }

  return name.trim();
}

export function parsePricingProfiles(input: string): PricingProfile[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return DEFAULT_PRICING_PROFILES;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('pricing-profiles must be valid JSON.');
  }

  return parsePricingProfilesValue(parsed);
}

/** @deprecated Use parsePricingProfiles */
export function parseModelPricing(input: string): PricingProfile[] {
  return parsePricingProfiles(input);
}

/** @deprecated Use DEFAULT_PRICING_PROFILES */
export const DEFAULT_MODEL_PRICING = DEFAULT_PRICING_PROFILES;

export function estimateSessionCost(
  estimatedTokens: number,
  inputCostPerMillion: number,
): number {
  return (estimatedTokens / 1_000_000) * inputCostPerMillion;
}

export function parseBooleanInput(value: string, defaultValue: boolean): boolean {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return defaultValue;
  }
  if (['true', '1', 'yes'].includes(trimmed)) {
    return true;
  }
  if (['false', '0', 'no'].includes(trimmed)) {
    return false;
  }
  throw new Error(`Invalid boolean value: "${value}". Use true or false.`);
}
