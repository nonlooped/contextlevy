import { describe, expect, it } from 'vitest';
import { shouldFailRun } from '../src/core/fail';
import type { PullRequestAnalysis } from '../src/core/types';

const analysis: PullRequestAnalysis = {
  totalEstimatedTokens: 25_000,
  files: [
    {
      filename: 'coverage/lcov.info',
      status: 'added',
      estimatedTokens: 25_000,
      category: 'coverage',
      label: 'Coverage output',
      suggestion: 'Add coverage/ to .gitignore.',
    },
  ],
  suggestions: [],
};

describe('shouldFailRun', () => {
  it('does not fail when no fail settings configured', () => {
    expect(shouldFailRun(analysis, {})).toEqual({ fail: false });
  });

  it('fails when severity threshold is met', () => {
    expect(shouldFailRun(analysis, { failOnSeverity: 'high' })).toEqual({
      fail: true,
      reason: expect.stringMatching(/risk level/i),
    });
  });

  it('fails when token threshold is exceeded', () => {
    expect(shouldFailRun(analysis, { failAboveTokens: 20_000 })).toEqual({
      fail: true,
      reason: expect.stringMatching(/25,?000/),
    });
  });

  it('does not fail below configured token threshold', () => {
    expect(shouldFailRun(analysis, { failAboveTokens: 30_000 })).toEqual({ fail: false });
  });
});
