import { describe, expect, it } from 'vitest';
import type { PullRequestAnalysis } from '../../src/core/types';
import { buildSarifReport } from '../../src/format/sarif';

const analysis: PullRequestAnalysis = {
  totalEstimatedTokens: 12_000,
  suggestions: [],
  files: [
    {
      filename: 'coverage/lcov.info',
      status: 'added',
      estimatedTokens: 10_000,
      category: 'coverage',
      label: 'Coverage output is usually noisy and should not be committed.',
    },
    {
      filename: 'src/index.ts',
      status: 'modified',
      estimatedTokens: 50,
      category: 'other',
      label: 'Added/changed file content may be read by coding agents.',
    },
  ],
};

describe('buildSarifReport', () => {
  it('includes SARIF metadata and high-impact results only', () => {
    const sarif = buildSarifReport(analysis) as {
      version: string;
      runs: Array<{
        tool: { driver: { name: string; rules: Array<{ id: string }> } };
        results: Array<{
          ruleId: string;
          locations: Array<{ physicalLocation: { artifactLocation: { uri: string } } }>;
        }>;
      }>;
    };

    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0]?.tool.driver.name).toBe('ContextLevy');
    expect(sarif.runs[0]?.results).toHaveLength(1);
    expect(sarif.runs[0]?.results[0]?.ruleId).toBe('contextlevy/coverage');
    expect(sarif.runs[0]?.results[0]?.locations[0]?.physicalLocation.artifactLocation.uri).toBe(
      'coverage/lcov.info',
    );
  });
});
