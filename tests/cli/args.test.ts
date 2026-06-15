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
      full: false,
      hookPreCommit: false,
      dryRun: false,
      force: false,
    });
  });

  it('treats --strict as fail-on-config', () => {
    const args = parseCliArgs(['check', '--strict']);
    expect(args.command).toBe('check');
    if (args.command !== 'check' && args.command !== 'diff') {
      throw new Error('expected diff/check');
    }
    expect(args.failOnConfig).toBe(true);
    expect(args.strict).toBe(true);
  });

  it('parses scan command', () => {
    expect(parseCliArgs(['scan', '--format', 'json'])).toEqual({
      command: 'scan',
      format: 'json',
    });
  });

  it('parses fix command', () => {
    expect(parseCliArgs(['fix', '--write', '--target', 'gitignore', '--from', 'check'])).toEqual({
      command: 'fix',
      write: true,
      target: 'gitignore',
      from: 'check',
      base: 'main',
      staged: false,
    });
  });

  it('parses hook install command', () => {
    expect(parseCliArgs(['hook', 'install', '--pre-commit', '--no-pre-push'])).toEqual({
      command: 'hook-install',
      prePush: false,
      preCommit: true,
      base: 'main',
      dryRun: false,
      force: false,
    });
  });

  it('parses init --full', () => {
    expect(parseCliArgs(['init', '--full', '--mode', 'strict'])).toEqual({
      command: 'init',
      mode: 'strict',
      workflow: false,
      full: true,
      hookPreCommit: false,
      dryRun: false,
      force: false,
    });
  });
});
