import type { CommentOptions, PullRequestAnalysis } from '../types';
import type { CliArgs } from './args';
import { formatTerminalCompact, formatTerminalDefault } from './terminal';

export function formatCliOutput(
  analysis: PullRequestAnalysis,
  args: CliArgs,
  options: CommentOptions,
): string {
  if (args.format === 'json') {
    return JSON.stringify({ analysis, options }, null, 2);
  }

  if (args.format === 'compact') {
    return formatTerminalCompact(analysis, options);
  }

  return formatTerminalDefault(analysis, options);
}
