import {
  DEFAULT_MODEL_PRICING,
  estimateSessionCost,
  parseModelPricing,
} from '../src/pricing';

describe('parseModelPricing', () => {
  it('returns defaults when input is empty', () => {
    expect(parseModelPricing('')).toEqual(DEFAULT_MODEL_PRICING);
  });

  it('parses custom model pricing', () => {
    const input = JSON.stringify([
      { name: 'Local LLM', inputCostPerMillion: 0.25 },
      { name: 'Team Model', inputCostPerMillion: 1.2 },
    ]);

    expect(parseModelPricing(input)).toEqual([
      { name: 'Local LLM', inputCostPerMillion: 0.25 },
      { name: 'Team Model', inputCostPerMillion: 1.2 },
    ]);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseModelPricing('not-json')).toThrow(/valid JSON/i);
  });
});

describe('estimateSessionCost', () => {
  it('computes worst-case session cost from token estimate', () => {
    expect(estimateSessionCost(37_891, 2.9)).toBeCloseTo(0.1098839, 5);
  });
});
