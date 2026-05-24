import chalk from 'chalk';
import { getHighImpactFiles } from '../analyze';
import {
  buildSuggestions,
  formatCompactTokens,
  getRiskLevel,
} from '../comment';
import { estimateSessionCost } from '../pricing';
import type {
  CommentOptions,
  FileAnalysis,
  PricingProfile,
  PullRequestAnalysis,
  SeverityThresholds,
} from '../types';
import { DEFAULT_SEVERITY_THRESHOLDS } from '../settings';

const COMPACT_MAX_FINDINGS = 3;
const COMPACT_MAX_SUGGESTIONS = 2;

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

function resolveSeverityThresholds(options: {
  severityThresholds?: SeverityThresholds;
}): SeverityThresholds {
  return options.severityThresholds ?? DEFAULT_SEVERITY_THRESHOLDS;
}

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCostRange(cost: number): string {
  const low = cost * 0.5;
  const high = cost * 1.5;
  if (Math.abs(low - high) < 0.005) {
    return `~${formatUsd(cost)}`;
  }
  return `~${formatUsd(low)}–${formatUsd(high)}`;
}

function renderInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, (_, value: string) => chalk.bold(value))
    .replace(/`([^`]+)`/g, (_, value: string) => chalk.cyan(value));
}

function formatShortPath(filename: string): string {
  const parts = filename.split('/');
  if (parts.length <= 2) {
    return filename;
  }
  return parts.slice(-2).join('/');
}

function getFindings(
  analysis: PullRequestAnalysis,
  maxItems: number,
): FileAnalysis[] {
  const rows = getHighImpactFiles(analysis, maxItems);
  if (rows.length > 0) {
    return rows;
  }
  return analysis.files.slice(0, maxItems);
}

function formatRiskBadge(
  riskLevel: ReturnType<typeof getRiskLevel>,
  boldLabel = false,
): string {
  const color = RISK_COLORS[riskLevel];
  const label = boldLabel ? chalk.bold(riskLevel) : riskLevel;
  return `${RISK_EMOJI[riskLevel]} ${color(label)}`;
}

function formatFindingsTable(
  analysis: PullRequestAnalysis,
  maxItems: number,
): string {
  const rows = getFindings(analysis, maxItems);
  if (rows.length === 0) {
    return chalk.dim('No added context detected in this diff.');
  }

  const addedWidth = Math.max(
    5,
    ...rows.map((file) => `+${formatCompactTokens(file.estimatedTokens)}`.length),
  );
  const fileWidth = Math.max(
    4,
    ...rows.map((file) => file.filename.length),
  );

  const header = [
    chalk.bold('ADDED'.padStart(addedWidth)),
    chalk.bold('FILE'.padEnd(fileWidth)),
  ].join('  ');

  const divider = [
    chalk.dim('─'.repeat(addedWidth)),
    chalk.dim('─'.repeat(fileWidth)),
  ].join('  ');

  const body = rows.flatMap((file) => {
    const added = chalk.yellow(`+${formatCompactTokens(file.estimatedTokens)}`.padStart(addedWidth));
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

  const divider = [
    chalk.dim('─'.repeat(nameWidth)),
    chalk.dim('─'.repeat(24)),
  ].join('  ');

  const rows = pricingProfiles.map((profile) => {
    const cost = estimateSessionCost(totalEstimatedTokens, profile.inputCostPerMillion);
    return [
      profile.name.padEnd(nameWidth),
      `${formatCostRange(cost)}/session`,
    ].join('  ');
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

  return suggestions.map((suggestion) => `  ${chalk.cyan('•')} ${renderInlineMarkdown(suggestion)}`).join('\n');
}

function formatCompactFixSuggestion(suggestion: string): string {
  if (/keep build output out of version control/i.test(suggestion)) {
    return 'remove build output';
  }
  if (/add `coverage\/` to `\.gitignore`/i.test(suggestion)) {
    return 'add coverage/ to .gitignore';
  }
  if (/avoid committing generated output unless required/i.test(suggestion)) {
    return 'avoid generated output';
  }
  if (/add `\*\.log` and `logs\/` to `\.gitignore`/i.test(suggestion)) {
    return 'add logs to .gitignore';
  }
  if (/consider excluding these paths from agent indexing/i.test(suggestion)) {
    return 'exclude artifacts from agent indexing';
  }

  return suggestion.replace(/`/g, '').replace(/\.$/, '');
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
): string {
  const severityThresholds = resolveSeverityThresholds(options);
  const highImpact = getHighImpactFiles(analysis, options.maxHighImpactItems);
  const riskLevel = getRiskLevel(
    analysis.totalEstimatedTokens,
    highImpact.length,
    severityThresholds,
  );
  const suggestions = buildSuggestions(analysis);

  const sections = [
    `${chalk.bold('🤖 ContextLevy')}`,
    '',
    `This diff adds ${chalk.bold(`~${formatCompactTokens(analysis.totalEstimatedTokens)} estimated net-new AI-context tokens`)}.`,
    '',
    `${chalk.bold('Risk level:')} ${formatRiskBadge(riskLevel)}`,
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

  return sections.join('\n');
}

export function formatTerminalCompact(
  analysis: PullRequestAnalysis,
  options: CommentOptions,
): string {
  const severityThresholds = resolveSeverityThresholds(options);
  const highImpact = getHighImpactFiles(analysis, options.maxHighImpactItems);
  const riskLevel = getRiskLevel(
    analysis.totalEstimatedTokens,
    highImpact.length,
    severityThresholds,
  );
  const findings = getFindings(analysis, options.maxHighImpactItems);
  const findingsLine = formatCompactFindings(findings, options.maxHighImpactItems);
  const costLine = options.showCostTable
    ? formatCompactCostRange(analysis.totalEstimatedTokens, options.pricingProfiles)
    : null;
  const fixLine = buildSuggestions(analysis)
    .slice(0, COMPACT_MAX_SUGGESTIONS)
    .map((suggestion) => formatCompactFixSuggestion(suggestion))
    .join(chalk.dim(' · '));

  const header = [
    chalk.bold('🤖 ContextLevy'),
    formatRiskBadge(riskLevel, true),
    chalk.bold(`+${formatCompactTokens(analysis.totalEstimatedTokens)} estimated context tokens`),
  ].join(chalk.dim(' · '));

  const lines = [header];

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

  lines.push(
    '',
    chalk.dim('Estimated context risk only. Agents may not read every changed file.'),
  );

  return lines.join('\n');
}
