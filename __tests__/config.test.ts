import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfigFile, resolveConfigPath } from '../src/config';
import { resolveSettings } from '../src/settings';

describe('loadConfigFile', () => {
  it('loads YAML config with kebab-case keys', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-config-'));
    const configPath = join(dir, '.contextlevy.yml');
    writeFileSync(
      configPath,
      [
        'token-threshold: 500',
        'large-file-token-threshold: 4000',
        'max-high-impact-items: 3',
        'show-cost-table: false',
        'pricing-profiles:',
        '  - name: Local 70B',
        '    inputCostPerMillion: 0.2',
      ].join('\n'),
    );

    expect(loadConfigFile(dir)).toEqual({
      tokenThreshold: 500,
      largeFileTokenThreshold: 4000,
      maxHighImpactItems: 3,
      showCostTable: false,
      pricingProfiles: [{ name: 'Local 70B', inputCostPerMillion: 0.2 }],
    });
  });

  it('loads JSON config with camelCase keys', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-config-'));
    const configPath = join(dir, 'contextlevy.json');
    writeFileSync(
      configPath,
      JSON.stringify({
        tokenThreshold: 2500,
        showCostTable: true,
      }),
    );

    expect(loadConfigFile(dir)).toEqual({
      tokenThreshold: 2500,
      showCostTable: true,
    });
  });

  it('returns null when no config file exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-config-'));
    expect(loadConfigFile(dir)).toBeNull();
  });

  it('loads a custom config path when provided', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-config-'));
    const configDir = join(dir, 'config');
    mkdirSync(configDir);
    const configPath = join(configDir, 'contextlevy.yaml');
    writeFileSync(configPath, 'token-threshold: 750\n');

    expect(resolveConfigPath(dir, 'config/contextlevy.yaml')).toBe(configPath);
    expect(loadConfigFile(dir, 'config/contextlevy.yaml')).toEqual({
      tokenThreshold: 750,
    });
  });
});

describe('resolveSettings', () => {
  it('uses config values when action inputs are empty', () => {
    const settings = resolveSettings(
      {
        tokenThreshold: 500,
        maxHighImpactItems: 3,
        showCostTable: false,
      },
      {
        tokenThreshold: '',
        largeFileTokenThreshold: '',
        maxHighImpactItems: '',
        showCostTable: '',
        pricingProfiles: '',
        modelPricing: '',
        commentFormat: '',
      },
    );

    expect(settings).toEqual({
      tokenThreshold: 500,
      largeFileTokenThreshold: 5000,
      maxHighImpactItems: 3,
      showCostTable: false,
      pricingProfiles: expect.any(Array),
      commentFormat: 'default',
    });
  });

  it('lets action inputs override config values', () => {
    const settings = resolveSettings(
      {
        tokenThreshold: 500,
        maxHighImpactItems: 3,
      },
      {
        tokenThreshold: '1500',
        largeFileTokenThreshold: '',
        maxHighImpactItems: '8',
        showCostTable: '',
        pricingProfiles: '',
        modelPricing: '',
        commentFormat: 'compact',
      },
    );

    expect(settings.tokenThreshold).toBe(1500);
    expect(settings.maxHighImpactItems).toBe(8);
    expect(settings.commentFormat).toBe('compact');
  });
});
