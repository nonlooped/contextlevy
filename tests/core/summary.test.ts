import { describe, expect, it } from 'vitest';
import { buildReviewSummary, getPrioritizedFindings } from '../../src/core/summary';
import type { PullRequestAnalysis } from '../../src/core/types';

const analysis: PullRequestAnalysis = {
  totalEstimatedTokens: 17_000,
  suggestions: [],
  files: [
    {
      filename: 'coverage/lcov.info',
      status: 'added',
      estimatedTokens: 9246,
      category: 'coverage',
      label: 'Coverage output',
    },
    {
      filename: 'prisma/generated/client.ts',
      status: 'added',
      estimatedTokens: 5792,
      category: 'generated',
      label: 'Generated code',
    },
    {
      filename: 'package-lock.json',
      status: 'modified',
      estimatedTokens: 2000,
      category: 'lockfile',
      label: 'Lockfile churn',
    },
    {
      filename: '.cursorrules',
      status: 'modified',
      estimatedTokens: 14,
      category: 'agent-config',
      label: 'Agent instructions',
    },
  ],
};

describe('buildReviewSummary', () => {
  it('describes combined review noise', () => {
    const summary = buildReviewSummary(analysis);
    expect(summary.headline).toContain('noisy agent review');
    expect(summary.categories).toContain('agent-config');
    expect(summary.expectation).toBe('critical');
  });
});

describe('getPrioritizedFindings', () => {
  it('ranks agent-config ahead of lockfile', () => {
    const findings = getPrioritizedFindings(analysis, 4);
    expect(findings[0]?.category).toBe('agent-config');
    expect(findings.some((file) => file.category === 'lockfile')).toBe(true);
  });
});
