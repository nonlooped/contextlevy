import { resolveSeverityThresholds } from '../config/settings';
import { getHighImpactFiles } from '../core/analyze';
import {
  formatIndexingSuggestion,
  getIndexablePaths,
  INDEXABLE_CATEGORIES,
} from '../core/indexing';
import { estimateSessionCost } from '../core/pricing';
import { formatRiskLevel, getRiskLevel, RISK_LEVEL_EMOJI } from '../core/severity';
import { buildReviewSummary, getPrioritizedFindings } from '../core/summary';
import type {
  CommentOptions,
  FileAnalysis,
  PricingProfile,
  PullRequestAnalysis,
} from '../core/types';
import {
  COMPACT_MAX_FINDINGS,
  COMPACT_MAX_SUGGESTIONS,
  formatCompactTokens,
  formatCostRange,
  formatShortPath,
  formatUsd,
  shortenFixSuggestion,
} from './shared';

export const COMMENT_MARKER = '<!-- contextlevy -->';

const COMPACT_RISK_LEVEL_EMOJI: Record<ReturnType<typeof getRiskLevel>, string> = {
  ...RISK_LEVEL_EMOJI,
  Critical: '🔴',
};

function formatCompactRiskLevel(riskLevel: ReturnType<typeof getRiskLevel>): string {
  return `${COMPACT_RISK_LEVEL_EMOJI[riskLevel]} **${riskLevel}**`;
}

function blockquote(lines: string[]): string {
  return lines.map((line) => (line.length === 0 ? '>' : `> ${line}`)).join('\n');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeMarkdownTableCell(value: string): string {
  return escapeHtml(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/`/g, '\\`')
    .replace(/\r?\n/g, ' ');
}

function formatInlineCodeInTable(value: string): string {
  return `\`${escapeMarkdownTableCell(value)}\``;
}

function shouldSuggestIndexing(analysis: PullRequestAnalysis): boolean {
  return analysis.files.some((file) => INDEXABLE_CATEGORIES.has(file.category));
}

function normalizeSuggestion(suggestion: string): string {
  if (/add coverage\/ to \.gitignore/i.test(suggestion)) {
    return 'Add `coverage/` to `.gitignore`.';
  }
  if (/do not commit generated output unless required/i.test(suggestion)) {
    return 'Avoid committing generated output unless required.';
  }
  if (/keep build output out of version control/i.test(suggestion)) {
    return 'Keep build output out of version control.';
  }
  if (/add \*\.log and logs\/ to \.gitignore/i.test(suggestion)) {
    return 'Add `*.log` and `logs/` to `.gitignore`.';
  }
  return suggestion;
}

export function buildSuggestions(analysis: PullRequestAnalysis): string[] {
  const seen = new Set<string>();
  const suggestions: string[] = [];

  for (const suggestion of analysis.suggestions) {
    const normalized = normalizeSuggestion(suggestion);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      suggestions.push(normalized);
    }
  }

  if (shouldSuggestIndexing(analysis)) {
    const indexingSuggestion = formatIndexingSuggestion(getIndexablePaths(analysis.files));
    if (indexingSuggestion && !seen.has(indexingSuggestion)) {
      seen.add(indexingSuggestion);
      suggestions.push(indexingSuggestion);
    }
  }

  return suggestions;
}

function formatFindingCell(filename: string, label: string): string {
  return `${formatInlineCodeInTable(filename)}<br/>${escapeMarkdownTableCell(label)}`;
}

function getFindings(analysis: PullRequestAnalysis, maxItems: number): FileAnalysis[] {
  return getPrioritizedFindings(analysis, maxItems);
}

function formatCompactFindings(files: FileAnalysis[], maxItems: number): string | null {
  const limit = Math.min(maxItems, COMPACT_MAX_FINDINGS);
  const shown = files.slice(0, limit);
  if (shown.length === 0) {
    return null;
  }

  const parts = shown.map(
    (file) =>
      `\`${escapeMarkdownTableCell(formatShortPath(file.filename))}\` **+${formatCompactTokens(file.estimatedTokens)}**`,
  );
  const remaining = files.length - shown.length;
  if (remaining > 0) {
    parts.push(`**+${remaining} more**`);
  }

  return parts.join(' · ');
}

function formatCompactFixLine(suggestions: string[]): string | null {
  if (suggestions.length === 0) {
    return null;
  }

  return suggestions
    .slice(0, COMPACT_MAX_SUGGESTIONS)
    .map((suggestion) => shortenFixSuggestion(suggestion))
    .join(' · ');
}

function formatCompactCostRange(
  totalEstimatedTokens: number,
  pricingProfiles: PricingProfile[],
): string | null {
  if (pricingProfiles.length === 0) {
    return null;
  }

  const costs = pricingProfiles.map((profile) =>
    estimateSessionCost(totalEstimatedTokens, profile.inputCostPerMillion),
  );
  const min = Math.min(...costs);
  const max = Math.max(...costs);

  if (min === max) {
    return `**Worst-case input cost:** ~${formatUsd(min)}/session`;
  }

  return `**Worst-case input cost:** ~${formatUsd(min)}–${formatUsd(max)}/session`;
}

function formatCompactComment(analysis: PullRequestAnalysis, options: CommentOptions): string {
  const severityThresholds = resolveSeverityThresholds(options.severityThresholds);
  const highImpact = getHighImpactFiles(analysis, analysis.files.length);
  const reviewSummary = buildReviewSummary(analysis);
  const riskLevel = getRiskLevel(analysis.totalEstimatedTokens, highImpact, severityThresholds);
  const findings = getFindings(analysis, options.maxHighImpactItems);
  const findingsLine = formatCompactFindings(findings, options.maxHighImpactItems);
  const costLine = options.showCostTable
    ? formatCompactCostRange(analysis.totalEstimatedTokens, options.pricingProfiles)
    : null;
  const fixLine = formatCompactFixLine(buildSuggestions(analysis));

  const quoteLines: string[] = [
    `🤖 **ContextLevy** · ${formatCompactRiskLevel(riskLevel)}`,
    '',
    reviewSummary.headline,
    '',
    `**+${formatCompactTokens(analysis.totalEstimatedTokens)} estimated context tokens**`,
    '',
  ];

  if (findingsLine) {
    quoteLines.push(findingsLine, '');
  }

  const detailLines: string[] = [];
  if (costLine) {
    detailLines.push(`${costLine}  `);
  }
  if (fixLine) {
    detailLines.push(`**Fix:** ${fixLine}`);
  }

  if (detailLines.length > 0) {
    quoteLines.push(...detailLines, '');
  }

  quoteLines.push(
    '<sub>Estimated context risk only. Agents may not read every changed file.</sub>',
  );

  return [COMMENT_MARKER, blockquote(quoteLines)].join('\n');
}

function formatContextTable(analysis: PullRequestAnalysis, maxItems: number): string {
  const rows = getFindings(analysis, maxItems);
  const tableHeader = ['| Added | Finding |', '|---:|---|'];

  if (rows.length === 0) {
    return 'No added context detected in this PR diff.';
  }

  const tableRows = rows.map(
    (file) =>
      `| **+${formatCompactTokens(file.estimatedTokens)}** | ${formatFindingCell(file.filename, file.label)} |`,
  );

  return [...tableHeader, ...tableRows].join('\n');
}

function formatPricingCostSection(
  totalEstimatedTokens: number,
  pricingProfiles: PricingProfile[],
): string {
  const rows = pricingProfiles.map((profile) => {
    const cost = estimateSessionCost(totalEstimatedTokens, profile.inputCostPerMillion);
    return `| ${escapeMarkdownTableCell(profile.name)} | ${formatCostRange(cost)}/session |`;
  });

  return [
    '**Estimated worst-case input cost if read by an agent**',
    '_Illustrative only — agents may not read every changed file. Not billing-grade._',
    '',
    '| Pricing profile | Est. input cost (±50%) |',
    '|---|---:|',
    ...rows,
  ].join('\n');
}

export function formatComment(analysis: PullRequestAnalysis, options: CommentOptions): string {
  if (options.commentFormat === 'compact') {
    return formatCompactComment(analysis, options);
  }

  return formatDefaultComment(analysis, options);
}

function formatDefaultComment(analysis: PullRequestAnalysis, options: CommentOptions): string {
  const severityThresholds = resolveSeverityThresholds(options.severityThresholds);
  const highImpact = getHighImpactFiles(analysis, analysis.files.length);
  const reviewSummary = buildReviewSummary(analysis);
  const riskLevel = getRiskLevel(analysis.totalEstimatedTokens, highImpact, severityThresholds);
  const suggestions = buildSuggestions(analysis);

  const suggestionLines =
    suggestions.length > 0
      ? suggestions.map((s) => `- ${s}`).join('\n')
      : '- No specific suggestions — diff looks context-light.';

  const sections = [
    '🤖 **ContextLevy**',
    '',
    reviewSummary.headline,
    '',
    `**Risk level:** ${formatRiskLevel(riskLevel)} · **~${formatCompactTokens(analysis.totalEstimatedTokens)} estimated context tokens**`,
    '',
    formatContextTable(analysis, options.maxHighImpactItems),
  ];

  if (options.showCostTable && options.pricingProfiles.length > 0) {
    sections.push(
      '',
      formatPricingCostSection(analysis.totalEstimatedTokens, options.pricingProfiles),
    );
  }

  sections.push(
    '',
    '**Suggestions**',
    suggestionLines,
    '',
    '_Different models tokenize differently, and agents may not read every changed file. ContextLevy estimates context risk, not exact billing._',
    '',
    '_ContextLevy runs locally in CI and does not send code to an external API._',
    '',
    COMMENT_MARKER,
  );

  return sections.join('\n');
}
