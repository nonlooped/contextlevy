import { getHighImpactFiles } from './analyze';
import { estimateSessionCost } from './pricing';
import type {
  CommentOptions,
  FileAnalysis,
  PricingProfile,
  PullRequestAnalysis,
} from './types';

export const COMMENT_MARKER = '<!-- contextlevy -->';
const COMPACT_MAX_FINDINGS = 3;
const COMPACT_MAX_SUGGESTIONS = 2;

const INDEXING_SUGGESTION =
  'Exclude generated/coverage artifacts from agent-specific indexing where supported.';

export function formatCompactTokens(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return value.toLocaleString('en-US');
}

export function getRiskLevel(
  totalTokens: number,
  highImpactCount: number,
): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (totalTokens >= 100_000 || highImpactCount >= 8) {
    return 'Critical';
  }
  if (totalTokens >= 20_000 || highImpactCount >= 3) {
    return 'High';
  }
  if (totalTokens >= 5_000 || highImpactCount >= 1) {
    return 'Medium';
  }
  return 'Low';
}

const RISK_LEVEL_EMOJI: Record<ReturnType<typeof getRiskLevel>, string> = {
  Low: '🟢',
  Medium: '🟡',
  High: '🔴',
  Critical: '⛔',
};

export function formatRiskLevel(riskLevel: ReturnType<typeof getRiskLevel>): string {
  return `${RISK_LEVEL_EMOJI[riskLevel]} ${riskLevel}`;
}

const COMPACT_RISK_LEVEL_EMOJI: Record<ReturnType<typeof getRiskLevel>, string> = {
  ...RISK_LEVEL_EMOJI,
  Critical: '🔴',
};

function formatCompactRiskLevel(riskLevel: ReturnType<typeof getRiskLevel>): string {
  return `${COMPACT_RISK_LEVEL_EMOJI[riskLevel]} **${riskLevel}**`;
}

function blockquote(lines: string[]): string {
  return lines
    .map((line) => (line.length === 0 ? '>' : `> ${line}`))
    .join('\n');
}

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shouldSuggestIndexing(analysis: PullRequestAnalysis): boolean {
  return analysis.files.some((file) =>
    ['generated', 'coverage', 'build-output', 'log', 'minified'].includes(file.category),
  );
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

  if (shouldSuggestIndexing(analysis) && !seen.has(INDEXING_SUGGESTION)) {
    suggestions.push(INDEXING_SUGGESTION);
  }

  return suggestions;
}

function formatFindingCell(filename: string, label: string): string {
  return `\`${filename}\`<br/>${label}`;
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

function formatCompactFindings(files: FileAnalysis[], maxItems: number): string | null {
  const limit = Math.min(maxItems, COMPACT_MAX_FINDINGS);
  const shown = files.slice(0, limit);
  if (shown.length === 0) {
    return null;
  }

  const parts = shown.map(
    (file) =>
      `\`${formatShortPath(file.filename)}\` **+${formatCompactTokens(file.estimatedTokens)}**`,
  );
  const remaining = files.length - shown.length;
  if (remaining > 0) {
    parts.push(`**+${remaining} more**`);
  }

  return parts.join(' · ');
}

function formatCompactFixSuggestion(suggestion: string): string {
  if (/keep build output out of version control/i.test(suggestion)) {
    return 'remove build output';
  }
  if (/add `coverage\/` to `\.gitignore`/i.test(suggestion)) {
    return 'add `coverage/` to `.gitignore`';
  }
  if (/avoid committing generated output unless required/i.test(suggestion)) {
    return 'avoid generated output';
  }
  if (/add `\*\.log` and `logs\/` to `\.gitignore`/i.test(suggestion)) {
    return 'add logs to `.gitignore`';
  }
  if (/exclude generated\/coverage artifacts/i.test(suggestion)) {
    return 'exclude artifacts from agent indexing';
  }

  return suggestion.replace(/\.$/, '');
}

function formatCompactFixLine(suggestions: string[]): string | null {
  if (suggestions.length === 0) {
    return null;
  }

  return suggestions
    .slice(0, COMPACT_MAX_SUGGESTIONS)
    .map((suggestion) => formatCompactFixSuggestion(suggestion))
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

function formatCompactComment(
  analysis: PullRequestAnalysis,
  options: CommentOptions,
): string {
  const highImpact = getHighImpactFiles(analysis, options.maxHighImpactItems);
  const riskLevel = getRiskLevel(analysis.totalEstimatedTokens, highImpact.length);
  const findings = getFindings(analysis, options.maxHighImpactItems);
  const findingsLine = formatCompactFindings(findings, options.maxHighImpactItems);
  const costLine = options.showCostTable
    ? formatCompactCostRange(analysis.totalEstimatedTokens, options.pricingProfiles)
    : null;
  const fixLine = formatCompactFixLine(buildSuggestions(analysis));

  const quoteLines: string[] = [
    `🤖 **ContextLevy** · ${formatCompactRiskLevel(riskLevel)} · **+${formatCompactTokens(analysis.totalEstimatedTokens)} estimated context tokens**`,
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

function formatContextTable(
  analysis: PullRequestAnalysis,
  maxItems: number,
): string {
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

export function formatPricingCostSection(
  totalEstimatedTokens: number,
  pricingProfiles: PricingProfile[],
): string {
  const rows = pricingProfiles.map((profile) => {
    const cost = estimateSessionCost(totalEstimatedTokens, profile.inputCostPerMillion);
    return `| ${profile.name} | ~${formatUsd(cost)}/session |`;
  });

  return [
    '**Estimated worst-case input cost if read by an agent**',
    '_Based on configured input-token pricing. Output tokens and caching are not included._',
    '',
    '| Pricing profile | Est. input cost |',
    '|---|---:|',
    ...rows,
  ].join('\n');
}

export function formatComment(
  analysis: PullRequestAnalysis,
  options: CommentOptions,
): string {
  if (options.commentFormat === 'compact') {
    return formatCompactComment(analysis, options);
  }

  return formatDefaultComment(analysis, options);
}

function formatDefaultComment(
  analysis: PullRequestAnalysis,
  options: CommentOptions,
): string {
  const highImpact = getHighImpactFiles(analysis, options.maxHighImpactItems);
  const riskLevel = getRiskLevel(analysis.totalEstimatedTokens, highImpact.length);
  const suggestions = buildSuggestions(analysis);

  const suggestionLines =
    suggestions.length > 0
      ? suggestions.map((s) => `- ${s}`).join('\n')
      : '- No specific suggestions — diff looks context-light.';

  const sections = [
    '🤖 **ContextLevy**',
    '',
    `This PR adds **~${formatCompactTokens(analysis.totalEstimatedTokens)} estimated net-new AI-context tokens**.`,
    '',
    `**Risk level:** ${formatRiskLevel(riskLevel)}`,
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
