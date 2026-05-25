import { describe, expect, it } from 'vitest';
import { resolveSettings } from '../../src/config/settings';

describe('resolveSettings path and fail options', () => {
  it('defaults path and fail settings to disabled', () => {
    expect(resolveSettings(null)).toEqual(
      expect.objectContaining({
        ignorePaths: [],
        allowPaths: [],
        failOnSeverity: undefined,
        failAboveTokens: undefined,
      }),
    );
  });

  it('passes through configured path and fail settings', () => {
    expect(
      resolveSettings({
        ignorePaths: ['docs/**'],
        allowPaths: ['vendor/**'],
        failOnSeverity: 'high',
        failAboveTokens: 25000,
      }),
    ).toEqual(
      expect.objectContaining({
        ignorePaths: ['docs/**'],
        allowPaths: ['vendor/**'],
        failOnSeverity: 'high',
        failAboveTokens: 25000,
      }),
    );
  });
});

describe('resolveSettings', () => {
  it('uses config values with defaults for omitted keys', () => {
    const settings = resolveSettings({
      tokenThreshold: 500,
      maxHighImpactItems: 3,
      showCostTable: false,
    });

    expect(settings).toEqual({
      tokenThreshold: 500,
      largeFileTokenThreshold: 5000,
      maxHighImpactItems: 3,
      showCostTable: false,
      pricingProfiles: expect.any(Array),
      commentFormat: 'default',
      ignorePaths: [],
      allowPaths: [],
      failOnSeverity: undefined,
      failAboveTokens: undefined,
      estimationMode: 'simple',
      customRules: [],
      severityThresholds: expect.objectContaining({
        mediumTokens: 5000,
        highTokens: 20000,
        criticalTokens: 100000,
      }),
    });
  });

  it('uses built-in defaults when no config file is present', () => {
    const settings = resolveSettings(null);

    expect(settings.tokenThreshold).toBe(1000);
    expect(settings.largeFileTokenThreshold).toBe(5000);
    expect(settings.maxHighImpactItems).toBe(5);
    expect(settings.showCostTable).toBe(true);
    expect(settings.commentFormat).toBe('default');
    expect(settings.pricingProfiles.length).toBeGreaterThan(0);
  });
});
