import type { ModelPricing } from './types';

export const DEFAULT_MODEL_PRICING: ModelPricing[] = [
  { name: 'GPT-5.5', inputCostPerMillion: 2.9 },
  { name: 'Opus 4.7', inputCostPerMillion: 8.0 },
  { name: 'Gemini 3.1 Pro', inputCostPerMillion: 1.5 },
  { name: 'Kimi K2.6', inputCostPerMillion: 0.4 },
];

export function parseModelPricing(input: string): ModelPricing[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return DEFAULT_MODEL_PRICING;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error('model-pricing must be valid JSON.');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('model-pricing must be a non-empty JSON array.');
  }

  return parsed.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`model-pricing[${index}] must be an object.`);
    }

    const record = entry as Record<string, unknown>;
    const name = record.name;
    const inputCostPerMillion = record.inputCostPerMillion;

    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error(`model-pricing[${index}].name must be a non-empty string.`);
    }

    if (typeof inputCostPerMillion !== 'number' || inputCostPerMillion < 0) {
      throw new Error(
        `model-pricing[${index}].inputCostPerMillion must be a non-negative number.`,
      );
    }

    return {
      name: name.trim(),
      inputCostPerMillion,
    };
  });
}

export function estimateSessionCost(
  estimatedTokens: number,
  inputCostPerMillion: number,
): number {
  return (estimatedTokens / 1_000_000) * inputCostPerMillion;
}
