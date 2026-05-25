import { describe, expect, it } from 'vitest';
import { resolveSettings } from '../../src/config/settings';

describe('resolveSettings path and fail options', () => {
  it('defaults path and fail settings to disabled', () => {
    expect(resolveSettings(null)).toEqual(
      expect.objectContaining({
        mode: 'advisory',
        ignorePaths: [],
        allowPaths: [],
        failOnSeverity: undefined,
        failAboveTokens: undefined,
        failOnCategories: [],
        warnOnlyCategories: [],
        commentOnHygiene: true,
        commentFormat: 'compact',
        showCostTable: false,
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
  it('uses config values with advisory preset defaults for omitted keys', () => {
    const settings = resolveSettings({
      tokenThreshold: 500,
      maxHighImpactItems: 3,
      showCostTable: false,
    });

    expect(settings).toEqual({
      mode: 'advisory',
      tokenThreshold: 500,
      largeFileTokenThreshold: 5000,
      maxHighImpactItems: 3,
      showCostTable: false,
      pricingProfiles: expect.any(Array),
      commentFormat: 'compact',
      commentOnHygiene: true,
      ignorePaths: [],
      allowPaths: [],
      failOnSeverity: undefined,
      failAboveTokens: undefined,
      failOnCategories: [],
      warnOnlyCategories: [],
      estimationMode: 'simple',
      customRules: [],
      severityThresholds: expect.objectContaining({
        mediumTokens: 5000,
        highTokens: 20000,
        criticalTokens: 100000,
      }),
    });
  });

  it('uses advisory defaults when no config file is present', () => {
    const settings = resolveSettings(null);

    expect(settings.mode).toBe('advisory');
    expect(settings.tokenThreshold).toBe(2000);
    expect(settings.largeFileTokenThreshold).toBe(5000);
    expect(settings.maxHighImpactItems).toBe(5);
    expect(settings.showCostTable).toBe(false);
    expect(settings.commentFormat).toBe('compact');
    expect(settings.commentOnHygiene).toBe(true);
    expect(settings.pricingProfiles.length).toBeGreaterThan(0);
  });

  it('applies strict preset fail categories', () => {
    const settings = resolveSettings({ mode: 'strict' });
    expect(settings.failOnCategories).toContain('build-output');
    expect(settings.warnOnlyCategories).toContain('lockfile');
  });

  it('applies legacy preset defaults', () => {
    const settings = resolveSettings({ mode: 'legacy' });
    expect(settings.tokenThreshold).toBe(1000);
    expect(settings.showCostTable).toBe(true);
    expect(settings.commentFormat).toBe('default');
    expect(settings.commentOnHygiene).toBe(false);
  });
});
