import pc from 'picocolors';
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
  Low: pc.green,
  Medium: pc.yellow,
  High: pc.red,
  Critical: (text: string) => pc.red(pc.bold(text)),
} as const;

const RISK_EMOJI = {
  Low: '🟢',
  Medium: '🟡',
  High: '🔴',
  Critical: '⛔',
} as const;

function renderInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, (_, value: string) => pc.bold(value))
    .replace(/`([^`]+)`/g, (_, value: string) => pc.cyan(value));
}

function getFindings(analysis: PullRequestAnalysis, maxItems: number): FileAnalysis[] {
  return getPrioritizedFindings(analysis, maxItems);
}

function formatRiskBadge(riskLevel: ReturnType<typeof getRiskLevel>, boldLabel = false): string {
  const color = RISK_COLORS[riskLevel];
  const label = boldLabel ? pc.bold(riskLevel) : riskLevel;
  return `${RISK_EMOJI[riskLevel]} ${color(label)}`;
}

function formatFindingsTable(analysis: PullRequestAnalysis, maxItems: number): string {
  const rows = getFindings(analysis, maxItems);
  if (rows.length === 0) {
    return pc.dim('No added context detected in this diff.');
  }

  const addedWidth = Math.max(
    5,
    ...rows.map((file) => `+${formatCompactTokens(file.estimatedTokens)}`.length),
  );
  const fileWidth = Math.max(4, ...rows.map((file) => file.filename.length));

  const header = [pc.bold('ADDED'.padStart(addedWidth)), pc.bold('FILE'.padEnd(fileWidth))].join(
    '  ',
  );

  const divider = [pc.dim('─'.repeat(addedWidth)), pc.dim('─'.repeat(fileWidth))].join('  ');

  const body = rows.flatMap((file) => {
    const added = pc.yellow(`+${formatCompactTokens(file.estimatedTokens)}`.padStart(addedWidth));
    const filename = pc.cyan(file.filename.padEnd(fileWidth));
    const labelIndent = ' '.repeat(addedWidth + 2);
    const label = pc.dim(`${labelIndent}${file.label}`);
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
    pc.bold('Pricing profile'.padEnd(nameWidth)),
    pc.bold('Est. input cost (±50%)'),
  ].join('  ');

  const divider = [pc.dim('─'.repeat(nameWidth)), pc.dim('─'.repeat(24))].join('  ');

  const rows = pricingProfiles.map((profile) => {
    const cost = estimateSessionCost(totalEstimatedTokens, profile.inputCostPerMillion);
    return [profile.name.padEnd(nameWidth), `${formatCostRange(cost)}/session`].join('  ');
  });

  return [
    pc.bold('Estimated worst-case input cost if read by an agent'),
    pc.dim(
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
    return pc.dim('  • No specific suggestions — diff looks context-light.');
  }

  return suggestions
    .map((suggestion) => `  ${pc.cyan('•')} ${renderInlineMarkdown(suggestion)}`)
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
    const path = pc.cyan(formatShortPath(file.filename));
    const tokens = pc.yellow(`+${formatCompactTokens(file.estimatedTokens)}`);
    return `${path} ${tokens}`;
  });

  const remaining = files.length - shown.length;
  if (remaining > 0) {
    parts.push(pc.dim(`+${remaining} more`));
  }

  return parts.join(pc.dim(' · '));
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
    return `${pc.bold('Worst-case input cost:')} ~${formatUsd(min)}/session`;
  }

  return `${pc.bold('Worst-case input cost:')} ~${formatUsd(min)}–${formatUsd(max)}/session`;
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
    `${pc.bold('🤖 ContextLevy')}`,
    '',
    reviewSummary.headline,
    '',
    `${pc.bold('Risk level:')} ${formatRiskBadge(riskLevel)} · ${pc.bold(`~${formatCompactTokens(analysis.totalEstimatedTokens)} estimated context tokens`)}`,
    '',
    pc.bold('Findings'),
    formatFindingsTable(analysis, options.maxHighImpactItems),
  ];

  if (options.showCostTable && options.pricingProfiles.length > 0) {
    sections.push('', formatPricingSection(analysis.totalEstimatedTokens, options.pricingProfiles));
  }

  sections.push(
    '',
    pc.bold('Suggestions'),
    formatSuggestions(suggestions),
    '',
    pc.dim(
      'Different models tokenize differently, and agents may not read every changed file. ContextLevy estimates context risk, not exact billing.',
    ),
    pc.dim('ContextLevy runs locally and does not send code to an external API.'),
  );

  if (meta?.baseRef) {
    sections.push(
      '',
      pc.dim(`Scanned ${analysis.files.length} changed file(s) against ${meta.baseRef}.`),
    );
  }

  if (meta?.configFound === false) {
    sections.push(pc.dim('No contextlevy.config.yml found. Run: npx contextlevy init'));
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
    .join(pc.dim(' · '));

  const header = [pc.bold('🤖 ContextLevy'), formatRiskBadge(riskLevel, true)].join(pc.dim(' · '));

  const lines = [
    header,
    '',
    reviewSummary.headline,
    '',
    pc.bold(`+${formatCompactTokens(analysis.totalEstimatedTokens)} estimated context tokens`),
  ];

  if (findingsLine) {
    lines.push('', `  ${findingsLine}`);
  }

  const detailLines: string[] = [];
  if (costLine) {
    detailLines.push(`  ${costLine}`);
  }
  if (fixLine) {
    detailLines.push(`  ${pc.bold('Fix:')} ${renderInlineMarkdown(fixLine)}`);
  }

  if (detailLines.length > 0) {
    lines.push('', ...detailLines);
  }

  lines.push('', pc.dim('Estimated context risk only. Agents may not read every changed file.'));

  if (meta?.configFound === false) {
    lines.push(pc.dim('No contextlevy.config.yml found. Run: npx contextlevy init'));
  }

  return lines.join('\n');
}
