import { parseArgs } from 'node:util';

export interface CliArgs {
  command: 'diff';
  base: string;
  staged: boolean;
  format: 'default' | 'compact' | 'json';
  failOnConfig: boolean;
  failAboveTokens?: number;
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
      'fail-above-tokens': { type: 'string' },
    },
  });

  const command = positionals[0];
  if (command !== 'diff') {
    throw new Error(
      'Usage: contextlevy diff [--base ref] [--staged] [--format default|compact|json]',
    );
  }

  const format = String(values.format);
  if (!['default', 'compact', 'json'].includes(format)) {
    throw new Error('--format must be default, compact, or json');
  }

  return {
    command: 'diff',
    base: String(values.base),
    staged: Boolean(values.staged),
    format: format as CliArgs['format'],
    failOnConfig: Boolean(values['fail-on-config']),
    failAboveTokens: values['fail-above-tokens']
      ? Number(values['fail-above-tokens'])
      : undefined,
  };
}
