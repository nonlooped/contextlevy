import { getHighImpactFiles } from './analyze';
import type { CommentOptions, PullRequestAnalysis } from './types';

export const COMMENT_MARKER = '<!-- contextlevy -->';

function formatTokenCount(value: number): string {
  return value.toLocaleString('en-US');
}

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatHighImpactSection(
  analysis: PullRequestAnalysis,
  maxItems: number,
): string {
  const highImpact = getHighImpactFiles(analysis, maxItems);

  if (highImpact.length === 0) {
    return 'No high-risk path patterns detected — mostly ordinary source changes.';
  }

  const lines = highImpact.flatMap((file) => [
    `  +${formatTokenCount(file.estimatedTokens).padStart(6)}  ${file.filename}`,
    `           ${file.label}`,
    '',
  ]);

  return lines.join('\n').trimEnd();
}

export function formatComment(
  analysis: PullRequestAnalysis,
  options: CommentOptions,
): string {
  const worstCaseCost =
    (analysis.totalEstimatedTokens / 1_000_000) * options.costPerMillionTokens;

  const suggestionLines =
    analysis.suggestions.length > 0
      ? analysis.suggestions.map((s) => `  - ${s}`).join('\n')
      : '  - No specific suggestions — diff looks context-light.';

  return [
    COMMENT_MARKER,
    '🤖 **ContextLevy**',
    '',
    `This PR adds **~${formatTokenCount(analysis.totalEstimatedTokens)} estimated AI-context tokens** (heuristic; not exact billing).`,
    '',
    '**High impact:**',
    formatHighImpactSection(analysis, options.maxHighImpactItems),
    '',
    `**Estimated worst-case input cost if read by an agent:** ~${formatUsd(worstCaseCost)}/session`,
    '',
    '_Different models tokenize differently, and agents may not read every changed file._',
    '',
    '**Suggestions:**',
    suggestionLines,
  ].join('\n');
}
