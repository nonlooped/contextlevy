import { getHighImpactFiles } from './analyze';
import { estimateSessionCost } from './pricing';
import type { CommentOptions, PricingProfile, PullRequestAnalysis } from './types';

export const COMMENT_MARKER = '<!-- contextlevy -->';

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

function formatContextTable(
  analysis: PullRequestAnalysis,
  maxItems: number,
): string {
  const rows = getHighImpactFiles(analysis, maxItems);
  const tableHeader = ['| Added | Finding |', '|---:|---|'];

  if (rows.length === 0) {
    const topFiles = analysis.files.slice(0, maxItems);
    if (topFiles.length === 0) {
      return 'No added context detected in this PR diff.';
    }

    const fallbackRows = topFiles.map(
      (file) =>
        `| **+${formatCompactTokens(file.estimatedTokens)}** | ${formatFindingCell(file.filename, file.label)} |`,
    );

    return [...tableHeader, ...fallbackRows].join('\n');
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
