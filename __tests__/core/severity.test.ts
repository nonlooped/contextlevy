import { getRiskLevel } from '../../src/core/severity';

describe('getRiskLevel', () => {
  it('marks large high-impact PRs as High', () => {
    expect(getRiskLevel(37_891, 2)).toBe('High');
  });
});
