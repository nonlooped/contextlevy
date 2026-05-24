import { countAddedCharsInPatch, estimateTokensFromPatch, estimateTokensFromAdditions } from '../src/tokens';

describe('countAddedCharsInPatch', () => {
  it('counts characters on added lines only', () => {
    const patch = [
      '@@ -1,2 +1,3 @@',
      ' context',
      '-old',
      '+new line',
      '+second',
    ].join('\n');

    expect(countAddedCharsInPatch(patch)).toBe('new line'.length + 'second'.length);
  });

  it('ignores +++ file headers', () => {
    const patch = '+++ b/src/foo.ts\n+hello';
    expect(countAddedCharsInPatch(patch)).toBe('hello'.length);
  });
});

describe('estimateTokensFromPatch', () => {
  it('uses chars/4 ceiling heuristic', () => {
    const patch = '+abcd\n+efgh';
    expect(estimateTokensFromPatch(patch)).toBe(Math.ceil(8 / 4));
  });

  it('returns 0 for empty patch', () => {
    expect(estimateTokensFromPatch(undefined)).toBe(0);
  });
});

describe('estimateTokensFromAdditions', () => {
  it('uses 10 tokens per added line fallback', () => {
    expect(estimateTokensFromAdditions(620)).toBe(6200);
  });
});
