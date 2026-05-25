import { DEFAULT_PRICING_PROFILES } from '../../src/core/pricing';
import type { PullRequestAnalysis } from '../../src/core/types';
import { buildSuggestions, COMMENT_MARKER, formatComment } from '../../src/format/comment';

const defaultCommentOptions = {
  maxHighImpactItems: 5,
  showCostTable: true,
  pricingProfiles: DEFAULT_PRICING_PROFILES,
  commentFormat: 'default' as const,
};

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

describe('buildSuggestions', () => {
  it('adds indexing guidance for generated and coverage artifacts', () => {
    const suggestions = buildSuggestions(analysis);

    expect(suggestions).toContain('Add `coverage/` to `.gitignore`.');
    expect(suggestions).toContain('Avoid committing generated output unless required.');

    const indexingSuggestion = suggestions.find((s) => /agent indexing/i.test(s));
    expect(indexingSuggestion).toBeDefined();
    expect(indexingSuggestion).toMatch(/coverage\//);
    expect(indexingSuggestion).toMatch(/\.gitignore/);
    expect(indexingSuggestion).toMatch(/\.cursorignore/);
    expect(indexingSuggestion).toContain('\n');
  });
});

describe('formatComment', () => {
  it('matches the redesigned comment layout', () => {
    const body = formatComment(analysis, defaultCommentOptions);

    expect(body).toContain('🤖 **ContextLevy**');
    expect(body).toContain('expect a noisy agent review');
    expect(body).toContain('**Risk level:** 🔴 High · **~37.9k estimated context tokens**');
    expect(body).toContain('| Added | Finding |');
    expect(body).toContain(
      '| **+32.0k** | `examples/high-impact-pr/coverage/lcov.info`<br/>Coverage output is usually noisy and should not be committed. |',
    );
    expect(body).toContain(
      '| **+5.8k** | `examples/high-impact-pr/prisma/generated/client.ts`<br/>Generated code is usually low-value context for coding agents. |',
    );
    expect(body).toContain('**Estimated worst-case input cost if read by an agent**');
    expect(body).toContain('Illustrative only — agents may not read every changed file');
    expect(body).toContain('| Pricing profile | Est. input cost (±50%) |');
    expect(body).toContain('| GPT-5.5 |');
    expect(body).toMatch(/\$0\.\d{2}–\$0\.\d{2}\/session \|/);
    expect(body).toContain('| Opus 4.7 |');
    expect(body).toContain('| Gemini 3.1 Pro |');
    expect(body).toContain('| Kimi K2.6 |');
    expect(body).toContain('**Suggestions**');
    expect(body).toContain('ContextLevy estimates context risk, not exact billing.');
    expect(body).toContain(
      'ContextLevy runs locally in CI and does not send code to an external API.',
    );
    expect(body.endsWith(COMMENT_MARKER)).toBe(true);
  });

  it('supports custom pricing profiles', () => {
    const body = formatComment(analysis, {
      ...defaultCommentOptions,
      pricingProfiles: [{ name: 'Local 70B', inputCostPerMillion: 0.2 }],
    });

    expect(body).toContain('| Local 70B |');
    expect(body).toMatch(/\$0\.0\d–\$0\.0\d\/session \|/);
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
        '> 🤖 **ContextLevy** · 🔴 **High**',
        '>',
        '> This PR adds coverage artifacts and generated output — expect a noisy agent review.',
        '>',
        '> **+37.9k estimated context tokens**',
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

  it('escapes markdown table control characters in default comments', () => {
    const body = formatComment(
      {
        totalEstimatedTokens: 1000,
        suggestions: [],
        files: [
          {
            filename: 'docs/a|b`c<br>.md',
            status: 'added',
            estimatedTokens: 1000,
            category: 'large-file',
            label: 'Large | label',
          },
        ],
      },
      defaultCommentOptions,
    );

    expect(body).toContain('`docs/a\\|b\\`c&lt;br&gt;.md`<br/>Large \\| label');
    expect(body).not.toContain('`docs/a|b`c<br>.md`');
  });

  it('escapes markdown table control characters in pricing profile names', () => {
    const body = formatComment(analysis, {
      ...defaultCommentOptions,
      pricingProfiles: [{ name: 'Model | <script>', inputCostPerMillion: 1 }],
    });

    expect(body).toContain('| Model \\| &lt;script&gt; |');
    expect(body).not.toContain('| Model | <script> |');
  });
});
