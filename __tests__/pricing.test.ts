import {
  DEFAULT_PRICING_PROFILES,
  estimateSessionCost,
  parseBooleanInput,
  parsePricingProfiles,
} from '../src/pricing';

describe('parsePricingProfiles', () => {
  it('returns defaults when input is empty', () => {
    expect(parsePricingProfiles('')).toEqual(DEFAULT_PRICING_PROFILES);
  });

  it('parses custom pricing profiles', () => {
    const input = JSON.stringify([
      { profile: 'Local LLM', inputCostPerMillion: 0.25 },
      { name: 'Team Model', inputCostPerMillion: 1.2 },
    ]);

    expect(parsePricingProfiles(input)).toEqual([
      { name: 'Local LLM', inputCostPerMillion: 0.25 },
      { name: 'Team Model', inputCostPerMillion: 1.2 },
    ]);
  });

  it('allows an empty array to disable default profiles', () => {
    expect(parsePricingProfiles('[]')).toEqual([]);
  });

  it('rejects invalid JSON', () => {
    expect(() => parsePricingProfiles('not-json')).toThrow(/valid JSON/i);
  });
});

describe('parseBooleanInput', () => {
  it('parses common boolean strings', () => {
    expect(parseBooleanInput('', true)).toBe(true);
    expect(parseBooleanInput('false', true)).toBe(false);
    expect(parseBooleanInput('yes', false)).toBe(true);
  });
});

describe('estimateSessionCost', () => {
  it('computes worst-case session cost from token estimate', () => {
    expect(estimateSessionCost(37_891, 2.9)).toBeCloseTo(0.1098839, 5);
  });
});
