import { describe, expect, it } from 'vitest';
import { resolveCheckConclusion } from '../../src/github/check';

describe('resolveCheckConclusion', () => {
  it('fails when fail thresholds are exceeded', () => {
    expect(resolveCheckConclusion({ fail: true, reason: 'too high' }, 'High')).toBe('failure');
  });

  it('uses neutral for high-risk advisory runs', () => {
    expect(resolveCheckConclusion({ fail: false }, 'High')).toBe('neutral');
    expect(resolveCheckConclusion({ fail: false }, 'Critical')).toBe('neutral');
  });

  it('uses success for low-risk runs', () => {
    expect(resolveCheckConclusion({ fail: false }, 'Low')).toBe('success');
    expect(resolveCheckConclusion({ fail: false }, 'Medium')).toBe('success');
  });
});
