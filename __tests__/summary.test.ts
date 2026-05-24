import { describe, expect, it, vi } from 'vitest';
import { writeJobSummary } from '../src/summary';
import type { PullRequestAnalysis } from '../src/types';
import { resolveSettings } from '../src/settings';

vi.mock('@actions/core', () => {
  const chain = {
    addHeading: vi.fn().mockReturnThis(),
    addRaw: vi.fn().mockReturnThis(),
    addEOL: vi.fn().mockReturnThis(),
    addTable: vi.fn().mockReturnThis(),
    write: vi.fn(async () => undefined),
  };

  return {
    summary: chain,
  };
});

const analysis: PullRequestAnalysis = {
  totalEstimatedTokens: 12_000,
  suggestions: [],
  files: [
    {
      filename: 'coverage/lcov.info',
      status: 'added',
      estimatedTokens: 10_000,
      category: 'coverage',
      label: 'Coverage output',
    },
  ],
};

describe('writeJobSummary', () => {
  it('writes risk level and findings to the job summary', async () => {
    const settings = resolveSettings({
      tokenThreshold: 1000,
      estimationMode: 'tokenizer',
    });

    await writeJobSummary(analysis, settings, { fail: false });

    const { summary } = await import('@actions/core');
    expect(summary.addHeading).toHaveBeenCalledWith('ContextLevy');
    expect(summary.addTable).toHaveBeenCalled();
    expect(summary.write).toHaveBeenCalled();
  });
});
