import {
  buildSuggestions,
  COMMENT_MARKER,
  formatComment,
  formatCompactTokens,
  getRiskLevel,
} from '../src/comment';
import { DEFAULT_PRICING_PROFILES } from '../src/pricing';
import type { PullRequestAnalysis } from '../src/types';

const defaultCommentOptions = {
  maxHighImpactItems: 5,
  showCostTable: true,
  pricingProfiles: DEFAULT_PRICING_PROFILES,
  commentFormat: 'default' as const,
};

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
    const body = formatComment(analysis, defaultCommentOptions);

    expect(body).toContain('🤖 **ContextLevy**');
    expect(body).toContain('**~37.9k estimated net-new AI-context tokens**');
    expect(body).toContain('**Risk level:** 🔴 High');
    expect(body).toContain('| Added | Finding |');
    expect(body).toContain(
      '| **+32.0k** | `examples/high-impact-pr/coverage/lcov.info`<br/>Coverage output is usually noisy and should not be committed. |',
    );
    expect(body).toContain(
      '| **+5.8k** | `examples/high-impact-pr/prisma/generated/client.ts`<br/>Generated code is usually low-value context for coding agents. |',
    );
    expect(body).toContain('**Estimated worst-case input cost if read by an agent**');
    expect(body).toContain(
      '_Based on configured input-token pricing. Output tokens and caching are not included._',
    );
    expect(body).toContain('| Pricing profile | Est. input cost |');
    expect(body).toContain('| GPT-5.5 | ~$0.19/session |');
    expect(body).toContain('| Opus 4.7 |');
    expect(body).toContain('| Gemini 3.1 Pro |');
    expect(body).toContain('| Kimi K2.6 |');
    expect(body).toContain('**Suggestions**');
    expect(body).toContain('ContextLevy estimates context risk, not exact billing.');
    expect(body).toContain('ContextLevy runs locally in CI and does not send code to an external API.');
    expect(body.endsWith(COMMENT_MARKER)).toBe(true);
  });

  it('supports custom pricing profiles', () => {
    const body = formatComment(analysis, {
      ...defaultCommentOptions,
      pricingProfiles: [{ name: 'Local 70B', inputCostPerMillion: 0.2 }],
    });

    expect(body).toContain('| Local 70B | ~$0.01/session |');
    expect(body).not.toContain('GPT-5.5');
  });

  it('omits the cost table when disabled', () => {
    const body = formatComment(analysis, {
      ...defaultCommentOptions,
      showCostTable: false,
    });

    expect(body).not.toContain('Estimated worst-case input cost');
    expect(body).not.toContain('| Pricing profile | Est. input cost |');
  });

  it('omits the cost table when pricing profiles are empty', () => {
    const body = formatComment(analysis, {
      ...defaultCommentOptions,
      pricingProfiles: [],
    });

    expect(body).not.toContain('Estimated worst-case input cost');
  });

  it('renders a genuinely compact comment layout', () => {
    const body = formatComment(analysis, {
      ...defaultCommentOptions,
      commentFormat: 'compact',
    });

    expect(body).toBe(
      [
        COMMENT_MARKER,
        '> 🤖 **ContextLevy** · 🔴 **High** · **+37.9k estimated context tokens**',
        '>',
        '> `coverage/lcov.info` **+32.0k** · `generated/client.ts` **+5.8k**',
        '>',
        '> **Worst-case input cost:** ~$0.04–$0.19/session  ',
        '> **Fix:** add `coverage/` to `.gitignore` · avoid generated output',
        '>',
        '> <sub>Estimated context risk only. Agents may not read every changed file.</sub>',
      ].join('\n'),
    );
    expect(body.startsWith(COMMENT_MARKER)).toBe(true);
    expect(body).not.toContain('| Added | Finding |');
    expect(body).not.toContain('**Suggestions**');
    expect(body).not.toContain('ContextLevy runs locally in CI');
  });
});
