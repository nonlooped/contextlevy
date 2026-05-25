import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_CONFIG_PATHS,
  loadConfigFile,
  loadConfigFromRepository,
} from '../../src/config/load';

describe('loadConfigFile', () => {
  it('loads YAML config with kebab-case keys', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-config-'));
    const configPath = join(dir, 'contextlevy.config.yml');
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
      if (path === '.github/contextlevy.config.yml' && ref === 'base-sha') {
        return 'token-threshold: 42\n';
      }
      return null;
    }, 'base-sha');

    expect(config).toEqual({
      tokenThreshold: 42,
    });
    expect(requested).toContain(`${DEFAULT_CONFIG_PATHS[0]}@base-sha`);
    expect(requested).toContain('.github/contextlevy.config.yml@base-sha');
  });

  it('loads legacy .contextlevy.yml when no contextlevy.config.yml exists', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-config-'));
    writeFileSync(join(dir, '.contextlevy.yml'), 'token-threshold: 900\n');

    expect(loadConfigFile(dir)).toEqual({
      tokenThreshold: 900,
    });
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
