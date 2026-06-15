import { parseArgs } from 'node:util';
import type { ContextLevyMode } from '../config/types';

export interface CliDiffArgs {
  command: 'diff' | 'check';
  base: string;
  staged: boolean;
  format: 'default' | 'compact' | 'json';
  failOnConfig: boolean;
  strict: boolean;
  failAboveTokens?: number;
}

export interface CliInitArgs {
  command: 'init';
  mode: ContextLevyMode;
  workflow: boolean;
  full: boolean;
  hookPreCommit: boolean;
  dryRun: boolean;
  force: boolean;
}

export interface CliScanArgs {
  command: 'scan';
  format: 'default' | 'compact' | 'json';
}

export interface CliFixArgs {
  command: 'fix';
  write: boolean;
  target: 'gitignore' | 'cursorignore' | 'both';
  from: 'scan' | 'check';
  base: string;
  staged: boolean;
}

export interface CliHookInstallArgs {
  command: 'hook-install';
  prePush: boolean;
  preCommit: boolean;
  base: string;
  dryRun: boolean;
  force: boolean;
}

export interface CliBadgeArgs {
  command: 'badge';
  style: 'risk' | 'debt' | 'tokens';
  from: 'scan' | 'check';
  format: 'markdown' | 'url' | 'json';
  base: string;
  staged: boolean;
  input?: string;
}

export type CliArgs =
  | CliDiffArgs
  | CliInitArgs
  | CliScanArgs
  | CliFixArgs
  | CliHookInstallArgs
  | CliBadgeArgs;

const MODES: ContextLevyMode[] = ['advisory', 'strict', 'minimal', 'legacy'];

function parseMode(value: string): ContextLevyMode {
  const normalized = value.trim().toLowerCase() as ContextLevyMode;
  if (!MODES.includes(normalized)) {
    throw new Error('--mode must be advisory, strict, minimal, or legacy.');
  }
  return normalized;
}

function parseFormat(value: string): 'default' | 'compact' | 'json' {
  if (!['default', 'compact', 'json'].includes(value)) {
    throw new Error('--format must be default, compact, or json');
  }
  return value as 'default' | 'compact' | 'json';
}

function parseFixTarget(value: string): CliFixArgs['target'] {
  const normalized = value.trim().toLowerCase();
  if (!['gitignore', 'cursorignore', 'both'].includes(normalized)) {
    throw new Error('--target must be gitignore, cursorignore, or both.');
  }
  return normalized as CliFixArgs['target'];
}

function parseFixFrom(value: string): CliFixArgs['from'] {
  const normalized = value.trim().toLowerCase();
  if (!['scan', 'check'].includes(normalized)) {
    throw new Error('--from must be scan or check.');
  }
  return normalized as CliFixArgs['from'];
}

export function parseCliArgs(argv: string[]): CliArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: false,
    options: {
      base: { type: 'string', default: 'main' },
      staged: { type: 'boolean', default: false },
      format: { type: 'string', default: 'default' },
      'fail-on-config': { type: 'boolean', default: false },
      strict: { type: 'boolean', default: false },
      'fail-above-tokens': { type: 'string' },
      mode: { type: 'string', default: 'advisory' },
      workflow: { type: 'boolean', default: false },
      full: { type: 'boolean', default: false },
      'pre-commit': { type: 'boolean', default: false },
      'pre-push': { type: 'boolean', default: false },
      'no-pre-push': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      write: { type: 'boolean', default: false },
      target: { type: 'string', default: 'both' },
      from: { type: 'string', default: 'scan' },
      style: { type: 'string', default: 'risk' },
      input: { type: 'string' },
    },
  });

  const command = positionals[0];

  if (command === 'hook' && positionals[1] === 'install') {
    const preCommit = Boolean(values['pre-commit']);
    const prePush = values['no-pre-push'] ? false : Boolean(values['pre-push']) || !preCommit;

    return {
      command: 'hook-install',
      prePush,
      preCommit,
      base: String(values.base),
      dryRun: Boolean(values['dry-run']),
      force: Boolean(values.force),
    };
  }

  if (command === 'init') {
    return {
      command: 'init',
      mode: parseMode(String(values.mode)),
      workflow: Boolean(values.workflow),
      full: Boolean(values.full),
      hookPreCommit: Boolean(values['pre-commit']),
      dryRun: Boolean(values['dry-run']),
      force: Boolean(values.force),
    };
  }

  if (command === 'scan') {
    return {
      command: 'scan',
      format: parseFormat(String(values.format)),
    };
  }

  if (command === 'fix') {
    return {
      command: 'fix',
      write: Boolean(values.write),
      target: parseFixTarget(String(values.target)),
      from: parseFixFrom(String(values.from)),
      base: String(values.base),
      staged: Boolean(values.staged),
    };
  }

  if (command === 'badge') {
    const style = String(values.style).trim().toLowerCase();
    if (!['risk', 'debt', 'tokens'].includes(style)) {
      throw new Error('--style must be risk, debt, or tokens.');
    }

    let format = String(values.format);
    if (format === 'default') {
      format = 'markdown';
    }
    if (!['markdown', 'url', 'json'].includes(format)) {
      throw new Error('--format must be markdown, url, or json');
    }

    return {
      command: 'badge',
      style: style as CliBadgeArgs['style'],
      from: parseFixFrom(String(values.from)),
      format: format as CliBadgeArgs['format'],
      base: String(values.base),
      staged: Boolean(values.staged),
      input: values.input ? String(values.input) : undefined,
    };
  }

  if (command !== 'diff' && command !== 'check') {
    throw new Error(
      'Usage: contextlevy <check|diff|init|scan|fix|badge|hook> [options]\n' +
        '  check|diff      Analyze changes against a base ref\n' +
        '  init            Scaffold contextlevy.config.yml\n' +
        '  scan            Baseline scan of tracked files and context debt score\n' +
        '  fix             Suggest or append .gitignore / .cursorignore patterns\n' +
        '  badge           Generate README/PR badge markdown\n' +
        '  hook install    Install pre-push or pre-commit hooks',
    );
  }

  const failOnConfig = Boolean(values['fail-on-config']) || Boolean(values.strict);

  return {
    command,
    base: String(values.base),
    staged: Boolean(values.staged),
    format: parseFormat(String(values.format)),
    failOnConfig,
    strict: Boolean(values.strict),
    failAboveTokens: values['fail-above-tokens'] ? Number(values['fail-above-tokens']) : undefined,
  };
}
