import { describe, expect, it } from 'vitest';
import { formatCliOutput } from '../../src/cli/format';
import { DEFAULT_PRICING_PROFILES } from '../../src/core/pricing';
import type { ContextCategory, PullRequestAnalysis } from '../../src/core/types';

const analysis: PullRequestAnalysis = {
  totalEstimatedTokens: 37_891,
  suggestions: [
    'Add coverage/ to .gitignore.',
    'Avoid committing generated output unless required.',
  ],
  files: [
    {
      filename: 'examples/high-impact-pr/coverage/lcov.info',
      status: 'added',
      estimatedTokens: 32_000,
      category: 'coverage',
      label: 'Coverage output is usually noisy and should not be committed.',
      suggestion: 'Add coverage/ to .gitignore.',
    },
    {
      filename: 'examples/high-impact-pr/prisma/generated/client.ts',
      status: 'added',
      estimatedTokens: 5_792,
      category: 'generated',
      label: 'Generated code is usually low-value context for coding agents.',
      suggestion: 'Avoid committing generated output unless required.',
    },
  ],
};

const commentOptions = {
  maxHighImpactItems: 5,
  showCostTable: true,
  pricingProfiles: DEFAULT_PRICING_PROFILES,
  commentFormat: 'default' as const,
};

const meta = {
  riskLevel: 'High' as const,
  highImpactCategories: ['coverage', 'generated'] as ContextCategory[],
  reviewSummary:
    'This PR adds coverage artifacts and generated output — expect a noisy agent review.',
  failDecision: { fail: false },
  baseRef: 'main',
  configFound: true,
};

describe('formatCliOutput', () => {
  it('renders default terminal output without markdown tables', () => {
    const output = formatCliOutput(
      analysis,
      {
        command: 'diff',
        base: 'main',
        staged: false,
        format: 'default',
        failOnConfig: false,
        strict: false,
      },
      commentOptions,
      meta,
    );

    expect(output).toContain('ContextLevy');
    expect(output).toContain('Findings');
    expect(output).toContain('coverage/lcov.info');
    expect(output).toContain('Suggestions');
    expect(output).not.toContain('| Added | Finding |');
    expect(output).not.toContain('<br/>');
    expect(output).not.toContain('<!-- contextlevy -->');
    expect(output).not.toContain('**');
  });

  it('renders compact terminal output on one summary line', () => {
    const output = formatCliOutput(
      analysis,
      {
        command: 'check',
        base: 'main',
        staged: false,
        format: 'compact',
        failOnConfig: false,
        strict: false,
      },
      commentOptions,
      meta,
    );

    expect(output).toContain('ContextLevy');
    expect(output).toContain('estimated context tokens');
    expect(output).not.toContain('blockquote');
    expect(output).not.toContain('**');
  });

  it('returns enriched JSON output', () => {
    const output = formatCliOutput(
      analysis,
      {
        command: 'diff',
        base: 'main',
        staged: false,
        format: 'json',
        failOnConfig: false,
        strict: false,
      },
      commentOptions,
      meta,
    );

    const parsed = JSON.parse(output);
    expect(parsed.analysis.totalEstimatedTokens).toBe(37_891);
    expect(parsed.riskLevel).toBe('High');
    expect(parsed.highImpactCategories).toEqual(['coverage', 'generated']);
    expect(parsed.reviewSummary).toContain('noisy agent review');
    expect(parsed.failDecision.fail).toBe(false);
  });
});
