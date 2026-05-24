import { formatComment } from '../comment';
import type { CommentOptions, PullRequestAnalysis } from '../types';
import type { CliArgs } from './args';

export function formatCliOutput(
  analysis: PullRequestAnalysis,
  args: CliArgs,
  options: CommentOptions,
): string {
  if (args.format === 'json') {
    return JSON.stringify({ analysis, options }, null, 2);
  }

  return formatComment(analysis, {
    ...options,
    commentFormat: args.format === 'compact' ? 'compact' : 'default',
  });
}
