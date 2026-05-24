import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../../src/cli/args';

describe('parseCliArgs', () => {
  it('defaults base to main', () => {
    expect(parseCliArgs(['diff'])).toEqual({
      command: 'diff',
      base: 'main',
      staged: false,
      format: 'default',
      failOnConfig: false,
    });
  });

  it('parses flags', () => {
    expect(
      parseCliArgs([
        'diff',
        '--base',
        'origin/main',
        '--staged',
        '--format',
        'json',
        '--fail-on-config',
      ]),
    ).toEqual({
      command: 'diff',
      base: 'origin/main',
      staged: true,
      format: 'json',
      failOnConfig: true,
    });
  });
});
