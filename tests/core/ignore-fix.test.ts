import { describe, expect, it } from 'vitest';
import {
  filterNewIgnorePatterns,
  isPatternCovered,
  mergeIgnoreFileContents,
  suggestIgnorePatterns,
} from '../../src/core/ignore-fix';
import type { FileAnalysis } from '../../src/core/types';

const coverageFile: FileAnalysis = {
  filename: 'coverage/lcov.info',
  status: 'unchanged',
  estimatedTokens: 1000,
  category: 'coverage',
  label: 'Coverage output',
};

const distFile: FileAnalysis = {
  filename: 'dist/bundle.js',
  status: 'unchanged',
  estimatedTokens: 2000,
  category: 'build-output',
  label: 'Build artifacts',
};

describe('suggestIgnorePatterns', () => {
  it('suggests indexable paths and category defaults', () => {
    const patterns = suggestIgnorePatterns([coverageFile, distFile]);
    expect(patterns).toEqual(expect.arrayContaining(['coverage/', 'dist/', 'htmlcov/', '*.lcov']));
  });
});

describe('isPatternCovered', () => {
  it('detects exact and broader existing patterns', () => {
    expect(isPatternCovered('coverage/', ['coverage/'])).toBe(true);
    expect(isPatternCovered('dist/bundle.js', ['dist/'])).toBe(true);
    expect(isPatternCovered('vendor/lib/', ['node_modules/'])).toBe(false);
  });
});

describe('mergeIgnoreFileContents', () => {
  it('appends only missing patterns with marker block', () => {
    const merged = mergeIgnoreFileContents('node_modules/\n', ['coverage/', 'node_modules/']);

    expect(merged.added).toEqual(['coverage/']);
    expect(merged.skipped).toEqual(['node_modules/']);
    expect(merged.content).toContain('ContextLevy');
    expect(merged.content).toContain('coverage/');
    expect(merged.content.startsWith('node_modules/\n')).toBe(true);
  });

  it('returns unchanged content when all patterns exist', () => {
    const merged = mergeIgnoreFileContents('coverage/\n', ['coverage/']);
    expect(merged.added).toEqual([]);
    expect(merged.content).toBe('coverage/\n');
  });
});

describe('filterNewIgnorePatterns', () => {
  it('tracks newly added patterns for subsequent coverage checks', () => {
    const result = filterNewIgnorePatterns(['dist/', 'build/', 'dist/bundle.js'], []);
    expect(result.added).toEqual(['dist/', 'build/']);
    expect(result.skipped).toContain('dist/bundle.js');
  });
});
