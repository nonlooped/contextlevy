import { describe, expect, it } from 'vitest';
import { parseNumstatLine, patchToEstimatedTokens } from '../../src/git/diff';

describe('parseNumstatLine', () => {
  it('parses added file numstat', () => {
    expect(parseNumstatLine('120\t0\tcoverage/lcov.info')).toEqual({
      additions: 120,
      deletions: 0,
      changes: 120,
      filename: 'coverage/lcov.info',
      status: 'added',
    });
  });
});

describe('patchToEstimatedTokens', () => {
  it('delegates to existing token estimator', () => {
    expect(patchToEstimatedTokens('+++ b/foo.ts\n+hello\n')).toBeGreaterThan(0);
  });
});
