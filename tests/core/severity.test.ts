import { describe, expect, it } from 'vitest';
import { getRiskLevel } from '../../src/core/severity';
import type { FileAnalysis } from '../../src/core/types';

const coverageFile: FileAnalysis = {
  filename: 'coverage/lcov.info',
  status: 'added',
  estimatedTokens: 32_000,
  category: 'coverage',
  label: 'Coverage output',
};

const generatedFile: FileAnalysis = {
  filename: 'generated/client.ts',
  status: 'added',
  estimatedTokens: 5_792,
  category: 'generated',
  label: 'Generated code',
};

describe('getRiskLevel', () => {
  it('marks large high-impact PRs as High', () => {
    expect(getRiskLevel(37_891, [coverageFile, generatedFile])).toBe('High');
  });

  it('marks agent-config-only changes as Medium', () => {
    expect(
      getRiskLevel(3, [
        {
          filename: '.cursorrules',
          status: 'modified',
          estimatedTokens: 3,
          category: 'agent-config',
          label: 'Agent instructions',
        },
      ]),
    ).toBe('Medium');
  });

  it('keeps small lockfile-only changes Low', () => {
    expect(
      getRiskLevel(500, [
        {
          filename: 'package-lock.json',
          status: 'modified',
          estimatedTokens: 500,
          category: 'lockfile',
          label: 'Lockfile churn',
        },
      ]),
    ).toBe('Low');
  });
});
