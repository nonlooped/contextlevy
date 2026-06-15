import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../../src/cli/args';
import { buildDebtBadgeUrl, buildRiskBadgeUrl } from '../../src/format/badge';

describe('badge CLI', () => {
  it('parses badge command with markdown default format', () => {
    expect(parseCliArgs(['badge', '--style', 'debt'])).toEqual({
      command: 'badge',
      style: 'debt',
      from: 'scan',
      format: 'markdown',
      base: 'main',
      staged: false,
      input: undefined,
    });
  });

  it('builds shields URLs used by badge command', () => {
    expect(buildRiskBadgeUrl('Medium', 5000)).toContain('Medium');
    expect(buildDebtBadgeUrl(10, 'A')).toContain('A');
  });
});
