import { describe, expect, it } from 'vitest';
import { resolveSettings } from '../../src/config/settings';
import { shouldPostComment } from '../../src/core/comment-gate';
import type { PullRequestAnalysis } from '../../src/core/types';

const agentConfigAnalysis: PullRequestAnalysis = {
  totalEstimatedTokens: 3,
  suggestions: [],
  files: [
    {
      filename: '.cursorrules',
      status: 'modified',
      estimatedTokens: 3,
      category: 'agent-config',
      label: 'Agent instruction files are high-signal but add persistent context overhead.',
    },
  ],
};

describe('shouldPostComment', () => {
  it('posts when agent-config changes even below token threshold', () => {
    const settings = resolveSettings(null);
    expect(shouldPostComment(agentConfigAnalysis, settings)).toBe(true);
  });

  it('skips clean diffs in advisory mode', () => {
    const settings = resolveSettings(null);
    const clean: PullRequestAnalysis = {
      totalEstimatedTokens: 50,
      suggestions: [],
      files: [
        {
          filename: 'src/index.ts',
          status: 'modified',
          estimatedTokens: 50,
          category: 'other',
          label: 'Added/changed file content may be read by coding agents.',
        },
      ],
    };
    expect(shouldPostComment(clean, settings)).toBe(false);
  });

  it('posts on hygiene categories when comment-on-hygiene is enabled', () => {
    const settings = resolveSettings(null);
    const coverageOnly: PullRequestAnalysis = {
      totalEstimatedTokens: 100,
      suggestions: [],
      files: [
        {
          filename: 'coverage/lcov.info',
          status: 'added',
          estimatedTokens: 100,
          category: 'coverage',
          label: 'Coverage output',
        },
      ],
    };
    expect(shouldPostComment(coverageOnly, settings)).toBe(true);
  });

  it('uses legacy token-only gate', () => {
    const settings = resolveSettings({ mode: 'legacy' });
    expect(shouldPostComment(agentConfigAnalysis, settings)).toBe(false);
  });
});
