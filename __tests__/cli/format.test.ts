import { describe, expect, it } from 'vitest';
import { formatCliOutput } from '../../src/cli/format';
import { DEFAULT_PRICING_PROFILES } from '../../src/pricing';
import type { PullRequestAnalysis } from '../../src/types';

const analysis: PullRequestAnalysis = {
  totalEstimatedTokens: 37_891,
  suggestions: ['Add coverage/ to .gitignore.', 'Avoid committing generated output unless required.'],
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

describe('formatCliOutput', () => {
  it('renders default terminal output without markdown tables', () => {
    const output = formatCliOutput(
      analysis,
      { command: 'diff', base: 'main', staged: false, format: 'default', failOnConfig: false },
      commentOptions,
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
      { command: 'diff', base: 'main', staged: false, format: 'compact', failOnConfig: false },
      commentOptions,
    );

    expect(output).toContain('ContextLevy');
    expect(output).toContain('estimated context tokens');
    expect(output).not.toContain('blockquote');
    expect(output).not.toContain('**');
  });

  it('returns JSON unchanged', () => {
    const output = formatCliOutput(
      analysis,
      { command: 'diff', base: 'main', staged: false, format: 'json', failOnConfig: false },
      commentOptions,
    );

    expect(JSON.parse(output).analysis.totalEstimatedTokens).toBe(37_891);
  });
});
