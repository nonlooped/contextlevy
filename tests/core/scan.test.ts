import { describe, expect, it } from 'vitest';
import {
  analyzeRepositoryFiles,
  buildCategoryBreakdown,
  computeRepoContextDebt,
} from '../../src/core/scan';

describe('analyzeRepositoryFiles', () => {
  it('classifies tracked coverage artifacts as high-impact', () => {
    const analysis = analyzeRepositoryFiles(
      [
        {
          filename: 'coverage/lcov.info',
          content: 'A'.repeat(4000),
          byteSize: 4000,
        },
        {
          filename: 'src/index.ts',
          content: 'export const ok = true;\n',
          byteSize: 24,
        },
      ],
      {
        largeFileTokenThreshold: 5000,
        ignorePaths: [],
        allowPaths: [],
        estimationMode: 'simple',
        customRules: [],
      },
    );

    const coverage = analysis.files.find((file) => file.filename === 'coverage/lcov.info');
    expect(coverage?.category).toBe('coverage');
    expect(coverage?.estimatedTokens).toBeGreaterThan(900);
    expect(analysis.totalEstimatedTokens).toBeGreaterThan(900);
  });

  it('respects ignore-paths during repository scans', () => {
    const analysis = analyzeRepositoryFiles(
      [
        {
          filename: 'vendor/lib.js',
          content: 'A'.repeat(1000),
          byteSize: 1000,
        },
      ],
      {
        largeFileTokenThreshold: 5000,
        ignorePaths: ['vendor/**'],
        allowPaths: [],
        estimationMode: 'simple',
        customRules: [],
      },
    );

    expect(analysis.files).toHaveLength(0);
  });
});

describe('computeRepoContextDebt', () => {
  it('returns higher debt for indexable artifact-heavy repos', () => {
    const analysis = analyzeRepositoryFiles(
      [
        {
          filename: 'coverage/lcov.info',
          content: 'A'.repeat(20_000),
          byteSize: 20_000,
        },
        {
          filename: 'dist/index.js',
          content: 'B'.repeat(20_000),
          byteSize: 20_000,
        },
      ],
      {
        largeFileTokenThreshold: 5000,
        ignorePaths: [],
        allowPaths: [],
        estimationMode: 'simple',
        customRules: [],
      },
    );

    const debt = computeRepoContextDebt(analysis, 2);

    expect(debt.score).toBeGreaterThan(25);
    expect(['C', 'D', 'F']).toContain(debt.grade);
    expect(debt.indexableTokens).toBeGreaterThan(9000);
    expect(debt.highImpactFileCount).toBe(2);
    expect(debt.categoryBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'coverage' }),
        expect.objectContaining({ category: 'build-output' }),
      ]),
    );
  });

  it('returns low debt for context-light tracked files', () => {
    const analysis = analyzeRepositoryFiles(
      [
        {
          filename: 'src/index.ts',
          content: 'export const ok = true;\n',
          byteSize: 24,
        },
      ],
      {
        largeFileTokenThreshold: 5000,
        ignorePaths: [],
        allowPaths: [],
        estimationMode: 'simple',
        customRules: [],
      },
    );

    const debt = computeRepoContextDebt(analysis, 1);

    expect(debt.score).toBeLessThanOrEqual(10);
    expect(debt.grade).toBe('A');
    expect(debt.indexableTokens).toBe(0);
  });
});

describe('buildCategoryBreakdown', () => {
  it('aggregates tokens and file counts by category', () => {
    const analysis = analyzeRepositoryFiles(
      [
        {
          filename: 'coverage/a.info',
          content: 'A'.repeat(100),
          byteSize: 100,
        },
        {
          filename: 'coverage/b.info',
          content: 'B'.repeat(200),
          byteSize: 200,
        },
      ],
      {
        largeFileTokenThreshold: 5000,
        ignorePaths: [],
        allowPaths: [],
        estimationMode: 'simple',
        customRules: [],
      },
    );

    const breakdown = buildCategoryBreakdown(analysis.files);
    expect(breakdown).toEqual([
      {
        category: 'coverage',
        fileCount: 2,
        estimatedTokens: 75,
      },
    ]);
  });
});
