import { formatCompactTokens } from '../../src/format/shared';

describe('formatCompactTokens', () => {
  it('formats large counts with one decimal k suffix', () => {
    expect(formatCompactTokens(37_891)).toBe('37.9k');
    expect(formatCompactTokens(32_000)).toBe('32.0k');
    expect(formatCompactTokens(5_792)).toBe('5.8k');
  });
});
