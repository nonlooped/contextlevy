import chalk from 'chalk';
import { resolveSeverityThresholds } from '../config/settings';
import { getHighImpactFiles } from '../core/analyze';
import { estimateSessionCost } from '../core/pricing';
import { getRiskLevel } from '../core/severity';
import { buildReviewSummary, getPrioritizedFindings } from '../core/summary';
import type {
  CommentOptions,
  FileAnalysis,
  PricingProfile,
  PullRequestAnalysis,
} from '../core/types';
import { buildSuggestions } from './comment';
import {
  COMPACT_MAX_FINDINGS,
  COMPACT_MAX_SUGGESTIONS,
  formatCompactTokens,
  formatCostRange,
  formatShortPath,
  formatUsd,
  shortenFixSuggestion,
} from './shared';

const RISK_COLORS = {
  Low: chalk.green,
  Medium: chalk.yellow,
  High: chalk.red,
  Critical: chalk.red.bold,
} as const;

const RISK_EMOJI = {
  Low: '🟢',
  Medium: '🟡',
  High: '🔴',
  Critical: '⛔',
} as const;

function renderInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, (_, value: string) => chalk.bold(value))
    .replace(/`([^`]+)`/g, (_, value: string) => chalk.cyan(value));
}

function getFindings(analysis: PullRequestAnalysis, maxItems: number): FileAnalysis[] {
  return getPrioritizedFindings(analysis, maxItems);
}

function formatRiskBadge(riskLevel: ReturnType<typeof getRiskLevel>, boldLabel = false): string {
  const color = RISK_COLORS[riskLevel];
  const label = boldLabel ? chalk.bold(riskLevel) : riskLevel;
  return `${RISK_EMOJI[riskLevel]} ${color(label)}`;
}

function formatFindingsTable(analysis: PullRequestAnalysis, maxItems: number): string {
  const rows = getFindings(analysis, maxItems);
  if (rows.length === 0) {
    return chalk.dim('No added context detected in this diff.');
  }

  const addedWidth = Math.max(
    5,
    ...rows.map((file) => `+${formatCompactTokens(file.estimatedTokens)}`.length),
  );
  const fileWidth = Math.max(4, ...rows.map((file) => file.filename.length));

  const header = [
    chalk.bold('ADDED'.padStart(addedWidth)),
    chalk.bold('FILE'.padEnd(fileWidth)),
  ].join('  ');

  const divider = [chalk.dim('─'.repeat(addedWidth)), chalk.dim('─'.repeat(fileWidth))].join('  ');

  const body = rows.flatMap((file) => {
    const added = chalk.yellow(
      `+${formatCompactTokens(file.estimatedTokens)}`.padStart(addedWidth),
    );
    const filename = chalk.cyan(file.filename.padEnd(fileWidth));
    const labelIndent = ' '.repeat(addedWidth + 2);
    const label = chalk.dim(`${labelIndent}${file.label}`);
    return [`${added}  ${filename}`, label];
  });

  return [header, divider, ...body].join('\n');
}

function formatPricingSection(
  totalEstimatedTokens: number,
  pricingProfiles: PricingProfile[],
): string {
  const nameWidth = Math.max(
    'Pricing profile'.length,
    ...pricingProfiles.map((profile) => profile.name.length),
  );

  const header = [
    chalk.bold('Pricing profile'.padEnd(nameWidth)),
    chalk.bold('Est. input cost (±50%)'),
  ].join('  ');

  const divider = [chalk.dim('─'.repeat(nameWidth)), chalk.dim('─'.repeat(24))].join('  ');

  const rows = pricingProfiles.map((profile) => {
    const cost = estimateSessionCost(totalEstimatedTokens, profile.inputCostPerMillion);
    return [profile.name.padEnd(nameWidth), `${formatCostRange(cost)}/session`].join('  ');
  });

  return [
    chalk.bold('Estimated worst-case input cost if read by an agent'),
    chalk.dim(
      'Based on configured input-token pricing. Estimates may vary ±50% depending on model tokenizer. Output tokens and caching are not included.',
    ),
    '',
    header,
    divider,
    ...rows,
  ].join('\n');
}

function formatSuggestions(suggestions: string[]): string {
  if (suggestions.length === 0) {
    return chalk.dim('  • No specific suggestions — diff looks context-light.');
  }

  return suggestions
    .map((suggestion) => `  ${chalk.cyan('•')} ${renderInlineMarkdown(suggestion)}`)
    .join('\n');
}

function formatCompactFixSuggestion(suggestion: string): string {
  return shortenFixSuggestion(suggestion).replace(/`/g, '');
}

function formatCompactFindings(files: FileAnalysis[], maxItems: number): string | null {
  const limit = Math.min(maxItems, COMPACT_MAX_FINDINGS);
  const shown = files.slice(0, limit);
  if (shown.length === 0) {
    return null;
  }

  const parts = shown.map((file) => {
    const path = chalk.cyan(formatShortPath(file.filename));
    const tokens = chalk.yellow(`+${formatCompactTokens(file.estimatedTokens)}`);
    return `${path} ${tokens}`;
  });

  const remaining = files.length - shown.length;
  if (remaining > 0) {
    parts.push(chalk.dim(`+${remaining} more`));
  }

  return parts.join(chalk.dim(' · '));
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
    return `${chalk.bold('Worst-case input cost:')} ~${formatUsd(min)}/session`;
  }

  return `${chalk.bold('Worst-case input cost:')} ~${formatUsd(min)}–${formatUsd(max)}/session`;
}

export function formatTerminalDefault(
  analysis: PullRequestAnalysis,
  options: CommentOptions,
  meta?: { baseRef?: string; configFound?: boolean },
): string {
  const severityThresholds = resolveSeverityThresholds(options.severityThresholds);
  const highImpact = getHighImpactFiles(analysis, analysis.files.length);
  const reviewSummary = buildReviewSummary(analysis);
  const riskLevel = getRiskLevel(analysis.totalEstimatedTokens, highImpact, severityThresholds);
  const suggestions = buildSuggestions(analysis);

  const sections = [
    `${chalk.bold('🤖 ContextLevy')}`,
    '',
    reviewSummary.headline,
    '',
    `${chalk.bold('Risk level:')} ${formatRiskBadge(riskLevel)} · ${chalk.bold(`~${formatCompactTokens(analysis.totalEstimatedTokens)} estimated context tokens`)}`,
    '',
    chalk.bold('Findings'),
    formatFindingsTable(analysis, options.maxHighImpactItems),
  ];

  if (options.showCostTable && options.pricingProfiles.length > 0) {
    sections.push('', formatPricingSection(analysis.totalEstimatedTokens, options.pricingProfiles));
  }

  sections.push(
    '',
    chalk.bold('Suggestions'),
    formatSuggestions(suggestions),
    '',
    chalk.dim(
      'Different models tokenize differently, and agents may not read every changed file. ContextLevy estimates context risk, not exact billing.',
    ),
    chalk.dim('ContextLevy runs locally and does not send code to an external API.'),
  );

  if (meta?.baseRef) {
    sections.push(
      '',
      chalk.dim(`Scanned ${analysis.files.length} changed file(s) against ${meta.baseRef}.`),
    );
  }

  if (meta?.configFound === false) {
    sections.push(chalk.dim('No contextlevy.config.yml found. Run: npx contextlevy init'));
  }

  return sections.join('\n');
}

export function formatTerminalCompact(
  analysis: PullRequestAnalysis,
  options: CommentOptions,
  meta?: { baseRef?: string; configFound?: boolean },
): string {
  const severityThresholds = resolveSeverityThresholds(options.severityThresholds);
  const highImpact = getHighImpactFiles(analysis, analysis.files.length);
  const reviewSummary = buildReviewSummary(analysis);
  const riskLevel = getRiskLevel(analysis.totalEstimatedTokens, highImpact, severityThresholds);
  const findings = getFindings(analysis, options.maxHighImpactItems);
  const findingsLine = formatCompactFindings(findings, options.maxHighImpactItems);
  const costLine = options.showCostTable
    ? formatCompactCostRange(analysis.totalEstimatedTokens, options.pricingProfiles)
    : null;
  const fixLine = buildSuggestions(analysis)
    .slice(0, COMPACT_MAX_SUGGESTIONS)
    .map((suggestion) => formatCompactFixSuggestion(suggestion))
    .join(chalk.dim(' · '));

  const header = [chalk.bold('🤖 ContextLevy'), formatRiskBadge(riskLevel, true)].join(
    chalk.dim(' · '),
  );

  const lines = [
    header,
    '',
    reviewSummary.headline,
    '',
    chalk.bold(`+${formatCompactTokens(analysis.totalEstimatedTokens)} estimated context tokens`),
  ];

  if (findingsLine) {
    lines.push('', `  ${findingsLine}`);
  }

  const detailLines: string[] = [];
  if (costLine) {
    detailLines.push(`  ${costLine}`);
  }
  if (fixLine) {
    detailLines.push(`  ${chalk.bold('Fix:')} ${renderInlineMarkdown(fixLine)}`);
  }

  if (detailLines.length > 0) {
    lines.push('', ...detailLines);
  }

  lines.push('', chalk.dim('Estimated context risk only. Agents may not read every changed file.'));

  if (meta?.configFound === false) {
    lines.push(chalk.dim('No contextlevy.config.yml found. Run: npx contextlevy init'));
  }

  return lines.join('\n');
}
