import { formatComment, COMMENT_MARKER } from '../src/comment';
import type { PullRequestAnalysis } from '../src/types';

const analysis: PullRequestAnalysis = {
  totalEstimatedTokens: 24600,
  suggestions: ['Add coverage/ to .gitignore.', 'Do not commit generated output unless required.'],
  files: [
    {
      filename: 'prisma/generated/client/index.js',
      status: 'added',
      estimatedTokens: 18400,
      category: 'generated',
      label: 'Generated code. Usually low-value context for coding agents.',
      suggestion: 'Do not commit generated output unless required.',
    },
    {
      filename: 'coverage/lcov.info',
      status: 'added',
      estimatedTokens: 6200,
      category: 'coverage',
      label: 'Coverage output is usually noisy and should not be committed.',
      suggestion: 'Add coverage/ to .gitignore.',
    },
  ],
};

describe('formatComment', () => {
  it('includes marker, total, high impact items, cost estimate, and suggestions', () => {
    const body = formatComment(analysis, {
      costPerMillionTokens: 3,
      maxHighImpactItems: 5,
    });

    expect(body).toContain(COMMENT_MARKER);
    expect(body).toContain('~24,600 estimated AI-context tokens');
    expect(body).toContain('prisma/generated/client/index.js');
    expect(body).toContain('coverage/lcov.info');
    expect(body).toContain('~$0.07/session');
    expect(body).toContain('Add coverage/ to .gitignore.');
  });

  it('states estimates are heuristic', () => {
    const body = formatComment(analysis, {
      costPerMillionTokens: 3,
      maxHighImpactItems: 5,
    });

    expect(body.toLowerCase()).toContain('estimate');
  });
});
