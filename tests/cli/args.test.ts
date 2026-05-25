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
      strict: false,
      failAboveTokens: undefined,
    });
  });

  it('accepts check as an alias for diff', () => {
    expect(parseCliArgs(['check', '--base', 'main']).command).toBe('check');
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
      strict: false,
      failAboveTokens: undefined,
    });
  });

  it('parses init command', () => {
    expect(parseCliArgs(['init', '--mode', 'strict', '--workflow'])).toEqual({
      command: 'init',
      mode: 'strict',
      workflow: true,
      dryRun: false,
      force: false,
    });
  });

  it('treats --strict as fail-on-config', () => {
    const args = parseCliArgs(['check', '--strict']);
    expect(args.command).not.toBe('init');
    if (args.command === 'init') {
      throw new Error('expected diff/check');
    }
    expect(args.failOnConfig).toBe(true);
    expect(args.strict).toBe(true);
  });
});
