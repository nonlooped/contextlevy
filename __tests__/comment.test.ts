import {
  buildSuggestions,
  COMMENT_MARKER,
  formatComment,
  formatCompactTokens,
  getRiskLevel,
} from '../src/comment';
import { DEFAULT_MODEL_PRICING } from '../src/pricing';
import type { PullRequestAnalysis } from '../src/types';

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

describe('formatCompactTokens', () => {
  it('formats large counts with one decimal k suffix', () => {
    expect(formatCompactTokens(37_891)).toBe('37.9k');
    expect(formatCompactTokens(32_000)).toBe('32.0k');
    expect(formatCompactTokens(5_792)).toBe('5.8k');
  });
});

describe('getRiskLevel', () => {
  it('marks large high-impact PRs as High', () => {
    expect(getRiskLevel(37_891, 2)).toBe('High');
  });
});

describe('buildSuggestions', () => {
  it('adds indexing guidance for generated and coverage artifacts', () => {
    const suggestions = buildSuggestions(analysis);

    expect(suggestions).toContain('Add `coverage/` to `.gitignore`.');
    expect(suggestions).toContain('Avoid committing generated output unless required.');
    expect(suggestions).toContain(
      'Exclude generated/coverage artifacts from agent-specific indexing where supported.',
    );
  });
});

describe('formatComment', () => {
  it('matches the redesigned comment layout', () => {
    const body = formatComment(analysis, {
      maxHighImpactItems: 5,
      modelPricing: DEFAULT_MODEL_PRICING,
    });

    expect(body).toContain('🤖 **ContextLevy**');
    expect(body).toContain('**~37.9k estimated AI-context tokens**');
    expect(body).toContain('**Risk level:** High');
    expect(body).toContain('| Added context | Path | Why it matters |');
    expect(body).toContain('| +32.0k | `examples/high-impact-pr/coverage/lcov.info` |');
    expect(body).toContain('| +5.8k | `examples/high-impact-pr/prisma/generated/client.ts` |');
    expect(body).toContain('| GPT-5.5 | ~$0.11/session |');
    expect(body).toContain('| Opus 4.7 |');
    expect(body).toContain('| Gemini 3.1 Pro |');
    expect(body).toContain('| Kimi K2.6 |');
    expect(body).toContain('**Suggestions**');
    expect(body).toContain('ContextLevy estimates context risk, not exact billing.');
    expect(body).toContain('ContextLevy runs locally in CI and does not send code to an external API.');
    expect(body.endsWith(COMMENT_MARKER)).toBe(true);
  });

  it('supports custom model pricing', () => {
    const body = formatComment(analysis, {
      maxHighImpactItems: 5,
      modelPricing: [{ name: 'Local 70B', inputCostPerMillion: 0.2 }],
    });

    expect(body).toContain('| Local 70B | ~$0.01/session |');
    expect(body).not.toContain('GPT-5.5');
  });
});
