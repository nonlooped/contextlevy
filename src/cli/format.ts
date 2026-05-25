import type { FailDecision } from '../core/fail';
import type { CommentOptions, ContextCategory, PullRequestAnalysis } from '../core/types';
import { formatTerminalCompact, formatTerminalDefault } from '../format/terminal';
import type { CliDiffArgs } from './args';

export interface CliOutputMeta {
  riskLevel: ReturnType<typeof import('../core/severity').getRiskLevel>;
  highImpactCategories: ContextCategory[];
  reviewSummary: string;
  failDecision: FailDecision;
  baseRef?: string;
  configFound?: boolean;
}

export function formatCliOutput(
  analysis: PullRequestAnalysis,
  args: CliDiffArgs,
  options: CommentOptions,
  meta: CliOutputMeta,
): string {
  if (args.format === 'json') {
    return JSON.stringify(
      {
        analysis,
        riskLevel: meta.riskLevel,
        highImpactCategories: meta.highImpactCategories,
        reviewSummary: meta.reviewSummary,
        failDecision: meta.failDecision,
        options,
      },
      null,
      2,
    );
  }

  const terminalMeta = {
    baseRef: meta.baseRef,
    configFound: meta.configFound,
  };

  if (args.format === 'compact') {
    return formatTerminalCompact(analysis, options, terminalMeta);
  }

  return formatTerminalDefault(analysis, options, terminalMeta);
}
