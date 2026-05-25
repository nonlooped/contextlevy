import { describe, expect, it } from 'vitest';
import { matchesAnyPathPattern, matchesPathPattern } from '../src/core/paths';

describe('matchesPathPattern', () => {
  it('matches exact paths', () => {
    expect(matchesPathPattern('docs/api/openapi.yaml', 'docs/api/openapi.yaml')).toBe(true);
    expect(matchesPathPattern('docs/api/openapi.yaml', 'docs/api/other.yaml')).toBe(false);
  });

  it('matches single-segment wildcards', () => {
    expect(matchesPathPattern('vendor/foo/bar.go', 'vendor/*/bar.go')).toBe(true);
    expect(matchesPathPattern('vendor/foo/baz.go', 'vendor/*/bar.go')).toBe(false);
  });

  it('matches recursive globs', () => {
    expect(matchesPathPattern('coverage/lcov.info', 'coverage/**')).toBe(true);
    expect(matchesPathPattern('src/coverage/out.txt', '**/coverage/**')).toBe(true);
  });
});

describe('matchesAnyPathPattern', () => {
  it('returns true when any pattern matches', () => {
    expect(matchesAnyPathPattern('vendor/lib/foo.go', ['docs/**', 'vendor/**'])).toBe(true);
  });
});
