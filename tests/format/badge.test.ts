import { describe, expect, it } from 'vitest';
import { buildBadgeMarkdown, buildDebtBadgeUrl, buildRiskBadgeUrl } from '../../src/format/badge';

describe('badge formatting', () => {
  it('builds risk badge URLs with encoded labels', () => {
    const url = buildRiskBadgeUrl('High', 42_100);
    expect(url).toContain('img.shields.io');
    expect(url).toContain('context%20risk');
    expect(url).toContain('High');
  });

  it('builds debt badge URLs from score and grade', () => {
    const url = buildDebtBadgeUrl(32, 'C');
    expect(url).toContain('context%20debt');
    expect(url).toContain('C');
  });

  it('wraps badge URLs in markdown', () => {
    expect(buildBadgeMarkdown('https://example.test/badge', 'Context risk')).toBe(
      '![Context risk](https://example.test/badge)',
    );
  });
});
