import { describe, expect, it } from 'vitest';
import { resolveSettings } from '../src/settings';

describe('resolveSettings path and fail options', () => {
  it('defaults path and fail settings to disabled', () => {
    expect(resolveSettings(null)).toEqual(
      expect.objectContaining({
        ignorePaths: [],
        allowPaths: [],
        failOnSeverity: undefined,
        failAboveTokens: undefined,
      }),
    );
  });

  it('passes through configured path and fail settings', () => {
    expect(
      resolveSettings({
        ignorePaths: ['docs/**'],
        allowPaths: ['vendor/**'],
        failOnSeverity: 'high',
        failAboveTokens: 25000,
      }),
    ).toEqual(
      expect.objectContaining({
        ignorePaths: ['docs/**'],
        allowPaths: ['vendor/**'],
        failOnSeverity: 'high',
        failAboveTokens: 25000,
      }),
    );
  });
});
