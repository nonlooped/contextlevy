import { analyzePullRequestFiles } from '../src/analyze';
import type { PullRequestFileLike } from '../src/types';

describe('analyzePullRequestFiles', () => {
  it('aggregates estimated tokens across added and modified files', () => {
    const files: PullRequestFileLike[] = [
      {
        filename: 'coverage/lcov.info',
        status: 'added',
        additions: 100,
        deletions: 0,
        changes: 100,
        patch: '+'.repeat(400),
      },
      {
        filename: 'src/index.ts',
        status: 'modified',
        additions: 4,
        deletions: 1,
        changes: 5,
        patch: '+abcd',
      },
    ];

    const result = analyzePullRequestFiles(files, { largeFileTokenThreshold: 5000 });

    expect(result.totalEstimatedTokens).toBeGreaterThan(0);
    expect(result.files).toHaveLength(2);
    expect(result.files[0]?.category).toBe('coverage');
    expect(result.suggestions.some((s) => s.includes('.gitignore'))).toBe(true);
  });

  it('skips removed files', () => {
    const files: PullRequestFileLike[] = [
      {
        filename: 'old.txt',
        status: 'removed',
        additions: 0,
        deletions: 999,
        changes: 999,
      },
    ];

    const result = analyzePullRequestFiles(files, { largeFileTokenThreshold: 5000 });
    expect(result.files).toHaveLength(0);
    expect(result.totalEstimatedTokens).toBe(0);
  });

  it('uses additions fallback when patch missing', () => {
    const files: PullRequestFileLike[] = [
      {
        filename: 'assets/image.png',
        status: 'added',
        additions: 50,
        deletions: 0,
        changes: 50,
      },
    ];

    const result = analyzePullRequestFiles(files, { largeFileTokenThreshold: 5000 });
    expect(result.files[0]?.estimatedTokens).toBe(500);
  });

  it('overrides category to large-file above threshold', () => {
    const longLine = '+' + 'x'.repeat(20000);
    const files: PullRequestFileLike[] = [
      {
        filename: 'src/normal.ts',
        status: 'added',
        additions: 1,
        deletions: 0,
        changes: 1,
        patch: longLine,
      },
    ];

    const result = analyzePullRequestFiles(files, { largeFileTokenThreshold: 1000 });
    expect(result.files[0]?.category).toBe('large-file');
  });
});
