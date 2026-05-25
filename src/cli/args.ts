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
  dryRun: boolean;
  force: boolean;
}

export type CliArgs = CliDiffArgs | CliInitArgs;

const MODES: ContextLevyMode[] = ['advisory', 'strict', 'minimal', 'legacy'];

function parseMode(value: string): ContextLevyMode {
  const normalized = value.trim().toLowerCase() as ContextLevyMode;
  if (!MODES.includes(normalized)) {
    throw new Error('--mode must be advisory, strict, minimal, or legacy.');
  }
  return normalized;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      base: { type: 'string', default: 'main' },
      staged: { type: 'boolean', default: false },
      format: { type: 'string', default: 'default' },
      'fail-on-config': { type: 'boolean', default: false },
      strict: { type: 'boolean', default: false },
      'fail-above-tokens': { type: 'string' },
      mode: { type: 'string', default: 'advisory' },
      workflow: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
    },
  });

  const command = positionals[0];
  if (command === 'init') {
    return {
      command: 'init',
      mode: parseMode(String(values.mode)),
      workflow: Boolean(values.workflow),
      dryRun: Boolean(values['dry-run']),
      force: Boolean(values.force),
    };
  }

  if (command !== 'diff' && command !== 'check') {
    throw new Error(
      'Usage: contextlevy <check|diff|init> [options]\n' +
        '  check|diff  Analyze changes against a base ref\n' +
        '  init        Scaffold contextlevy.config.yml',
    );
  }

  const format = String(values.format);
  if (!['default', 'compact', 'json'].includes(format)) {
    throw new Error('--format must be default, compact, or json');
  }

  const failOnConfig = Boolean(values['fail-on-config']) || Boolean(values.strict);

  return {
    command,
    base: String(values.base),
    staged: Boolean(values.staged),
    format: format as CliDiffArgs['format'],
    failOnConfig,
    strict: Boolean(values.strict),
    failAboveTokens: values['fail-above-tokens'] ? Number(values['fail-above-tokens']) : undefined,
  };
}
