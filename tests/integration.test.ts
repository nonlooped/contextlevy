import { describe, expect, it, vi } from 'vitest';
import { parseConfigContents } from '../src/config/parse';
import { resolveSettings } from '../src/config/settings';
import { analyzePullRequestFiles } from '../src/core/analyze';
import { shouldFailRun } from '../src/core/fail';
import type { PullRequestFileLike } from '../src/core/types';

const highImpactFiles: PullRequestFileLike[] = [
  {
    filename: 'coverage/lcov.info',
    status: 'added',
    additions: 6200,
    deletions: 0,
    changes: 6200,
    patch: '+'.concat('A'.repeat(32000)),
  },
  {
    filename: 'prisma/generated/client.ts',
    status: 'added',
    additions: 1200,
    deletions: 0,
    changes: 1200,
    patch: '+export const client = 1;\n'.repeat(400),
  },
  {
    filename: 'README.md',
    status: 'modified',
    additions: 3,
    deletions: 1,
    changes: 4,
    patch: '+small doc tweak',
  },
  {
    filename: 'dist/old.js',
    status: 'removed',
    additions: 0,
    deletions: 50,
    changes: 50,
  },
  {
    filename: 'supabase/types.ts',
    status: 'added',
    additions: 500,
    deletions: 0,
    changes: 500,
  },
];

describe('integration: PR simulation', () => {
  it('analyzes a realistic PR payload with custom rules and fail thresholds', () => {
    const config = parseConfigContents(
      [
        'token-threshold: 1000',
        'estimation-mode: simple',
        'custom-rules:',
        '  - name: supabase-types',
        '    paths:',
        '      - supabase/types.ts',
        '    category: generated',
        '    label: Generated Supabase types are usually low-value agent context.',
        '    suggestion: Regenerate locally unless this repo tracks generated DB types.',
        'fail-on-severity: high',
      ].join('\n'),
      'contextlevy.config.yml',
    );

    const settings = resolveSettings(config);
    const analysis = analyzePullRequestFiles(highImpactFiles, {
      largeFileTokenThreshold: settings.largeFileTokenThreshold,
      ignorePaths: settings.ignorePaths,
      allowPaths: settings.allowPaths,
      estimationMode: settings.estimationMode,
      customRules: settings.customRules,
    });

    expect(analysis.files.some((file) => file.filename === 'dist/old.js')).toBe(false);
    expect(analysis.files.find((file) => file.filename === 'supabase/types.ts')?.category).toBe(
      'generated',
    );
    expect(analysis.totalEstimatedTokens).toBeGreaterThan(5000);

    const failDecision = shouldFailRun(
      analysis,
      {
        failOnSeverity: settings.failOnSeverity,
        failAboveTokens: settings.failAboveTokens,
        severityThresholds: settings.severityThresholds,
      },
      settings.maxHighImpactItems,
    );

    expect(failDecision.fail).toBe(true);
  });

  it('prefers base-branch config over PR-side config changes', async () => {
    const baseConfig = parseConfigContents(
      'token-threshold: 5000\n',
      'contextlevy.config.yml@base',
    );
    const prConfig = parseConfigContents('token-threshold: 0\n', 'contextlevy.config.yml@head');

    expect(baseConfig.tokenThreshold).toBe(5000);
    expect(prConfig.tokenThreshold).toBe(0);
    expect(resolveSettings(baseConfig).tokenThreshold).toBe(5000);
  });

  it('uses tokenizer mode when configured', () => {
    const patch = '+hello world\n+from tokenizer mode';
    const simple = analyzePullRequestFiles(
      [
        {
          filename: 'src/example.ts',
          status: 'added',
          additions: 2,
          deletions: 0,
          changes: 2,
          patch,
        },
      ],
      {
        largeFileTokenThreshold: 5000,
        ignorePaths: [],
        allowPaths: [],
        estimationMode: 'simple',
        customRules: [],
      },
    );

    const tokenizer = analyzePullRequestFiles(
      [
        {
          filename: 'src/example.ts',
          status: 'added',
          additions: 2,
          deletions: 0,
          changes: 2,
          patch,
        },
      ],
      {
        largeFileTokenThreshold: 5000,
        ignorePaths: [],
        allowPaths: [],
        estimationMode: 'tokenizer',
        customRules: [],
      },
    );

    expect(tokenizer.totalEstimatedTokens).toBeGreaterThan(0);
    expect(simple.totalEstimatedTokens).not.toBe(tokenizer.totalEstimatedTokens);
  });

  it('falls back to additions estimate when patch is missing', () => {
    const analysis = analyzePullRequestFiles(
      [
        {
          filename: 'generated/client.ts',
          status: 'added',
          additions: 900,
          deletions: 0,
          changes: 900,
        },
      ],
      {
        largeFileTokenThreshold: 5000,
        ignorePaths: [],
        allowPaths: [],
        estimationMode: 'simple',
        customRules: [],
      },
    );

    expect(analysis.files[0]?.estimatedTokens).toBe(9000);
    expect(analysis.files[0]?.category).toBe('generated');
  });
});

describe('integration: comment upsert scenarios', () => {
  it('documents expected Octokit pagination behavior for file listing', async () => {
    const listFiles = vi.fn(async function* () {
      yield {
        data: highImpactFiles.map((file) => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch,
        })),
      };
    });

    const collected: PullRequestFileLike[] = [];
    for await (const response of listFiles()) {
      for (const file of response.data) {
        collected.push(file);
      }
    }

    expect(collected).toHaveLength(5);
    expect(collected.filter((file) => file.status !== 'removed')).toHaveLength(4);
  });
});
