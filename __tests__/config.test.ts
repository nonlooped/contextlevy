import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  DEFAULT_CONFIG_PATHS,
  loadConfigFile,
  loadConfigFromRepository,
  resolveConfigPath,
} from '../src/config';
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

  it('loads the first available config from repository content at a ref', async () => {
    const requested: string[] = [];

    const config = await loadConfigFromRepository(async (path, ref) => {
      requested.push(`${path}@${ref}`);
      if (path === '.github/contextlevy.yml' && ref === 'base-sha') {
        return 'token-threshold: 42\n';
      }
      return null;
    }, 'base-sha');

    expect(config).toEqual({
      tokenThreshold: 42,
    });
    expect(requested).toContain(`${DEFAULT_CONFIG_PATHS[0]}@base-sha`);
    expect(requested).toContain('.github/contextlevy.yml@base-sha');
  });

  it('rejects non-finite numeric config values', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-config-'));
    writeFileSync(join(dir, '.contextlevy.yml'), 'token-threshold: .inf\n');

    expect(() => loadConfigFile(dir)).toThrow(/finite/i);
  });

  it('rejects fractional item limits', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-config-'));
    writeFileSync(join(dir, '.contextlevy.yml'), 'max-high-impact-items: 2.5\n');

    expect(() => loadConfigFile(dir)).toThrow(/integer/i);
  });

  it('loads ignore-paths and allow-paths arrays', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-config-'));
    writeFileSync(
      join(dir, '.contextlevy.yml'),
      [
        'ignore-paths:',
        '  - docs/generated/**',
        'allow-paths:',
        '  - prisma/migrations/**',
        'fail-on-severity: high',
        'fail-above-tokens: 50000',
      ].join('\n'),
    );

    expect(loadConfigFile(dir)).toEqual({
      ignorePaths: ['docs/generated/**'],
      allowPaths: ['prisma/migrations/**'],
      failOnSeverity: 'high',
      failAboveTokens: 50000,
    });
  });

  it('rejects invalid fail-on-severity values', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-config-'));
    writeFileSync(join(dir, '.contextlevy.yml'), 'fail-on-severity: extreme\n');

    expect(() => loadConfigFile(dir)).toThrow(/fail-on-severity/i);
  });

  it('rejects non-string path patterns', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-config-'));
    writeFileSync(join(dir, '.contextlevy.yml'), 'ignore-paths:\n  - 42\n');

    expect(() => loadConfigFile(dir)).toThrow(/ignore-paths/i);
  });

  it('loads estimation mode, custom rules, and severity thresholds', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-config-'));
    writeFileSync(
      join(dir, '.contextlevy.yml'),
      [
        'estimation-mode: tokenizer',
        'custom-rules:',
        '  - paths:',
        '      - supabase/types.ts',
        '    category: generated',
        '    label: Generated Supabase types',
        'severity-thresholds:',
        '  medium: 3000',
        '  high: 12000',
        '  critical: 60000',
      ].join('\n'),
    );

    expect(loadConfigFile(dir)).toEqual({
      estimationMode: 'tokenizer',
      customRules: [
        {
          paths: ['supabase/types.ts'],
          category: 'generated',
          label: 'Generated Supabase types',
        },
      ],
      severityThresholds: {
        mediumTokens: 3000,
        highTokens: 12000,
        criticalTokens: 60000,
      },
    });
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
