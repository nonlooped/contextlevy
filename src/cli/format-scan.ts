import pc from 'picocolors';
import { resolveSeverityThresholds } from '../config/settings';
import type { RepoContextDebt } from '../core/scan';
import { getRiskLevel } from '../core/severity';
import type { EstimationMode, FileAnalysis, PullRequestAnalysis } from '../core/types';
import { formatCompactTokens } from '../format/shared';
import type { CliScanArgs } from './args';

export interface CliScanFormatOptions {
  maxHighImpactItems: number;
  severityThresholds?: import('../core/types').SeverityThresholds;
  estimationMode: EstimationMode;
  reviewSummary: string;
  topFiles: FileAnalysis[];
  configFound?: boolean;
}

const GRADE_COLORS = {
  A: pc.green,
  B: pc.green,
  C: pc.yellow,
  D: pc.red,
  F: (text: string) => pc.red(pc.bold(text)),
} as const;

function formatDebtGrade(grade: RepoContextDebt['grade']): string {
  const color = GRADE_COLORS[grade];
  return color(pc.bold(grade));
}

function formatCategoryTable(debt: RepoContextDebt): string {
  if (debt.categoryBreakdown.length === 0) {
    return pc.dim('No high-impact categories detected in tracked files.');
  }

  const categoryWidth = Math.max(
    8,
    ...debt.categoryBreakdown.map((entry) => entry.category.length),
  );
  const filesWidth = Math.max(
    5,
    ...debt.categoryBreakdown.map((entry) => String(entry.fileCount).length),
  );
  const tokensWidth = Math.max(
    6,
    ...debt.categoryBreakdown.map((entry) => formatCompactTokens(entry.estimatedTokens).length + 1),
  );

  const header = [
    pc.bold('CATEGORY'.padEnd(categoryWidth)),
    pc.bold('FILES'.padStart(filesWidth)),
    pc.bold('TOKENS'.padStart(tokensWidth)),
  ].join('  ');

  const divider = [
    pc.dim('─'.repeat(categoryWidth)),
    pc.dim('─'.repeat(filesWidth)),
    pc.dim('─'.repeat(tokensWidth)),
  ].join('  ');

  const rows = debt.categoryBreakdown.map((entry) => {
    const category = entry.category.padEnd(categoryWidth);
    const fileCount = String(entry.fileCount).padStart(filesWidth);
    const tokens = pc.yellow(
      `+${formatCompactTokens(entry.estimatedTokens)}`.padStart(tokensWidth),
    );
    return `${category}  ${fileCount}  ${tokens}`;
  });

  return [header, divider, ...rows].join('\n');
}

function formatTopFilesTable(files: FileAnalysis[]): string {
  if (files.length === 0) {
    return pc.dim('No tracked files with estimated context cost.');
  }

  const addedWidth = Math.max(
    5,
    ...files.map((file) => `+${formatCompactTokens(file.estimatedTokens)}`.length),
  );
  const fileWidth = Math.max(4, ...files.map((file) => file.filename.length));

  const header = [pc.bold('TOKENS'.padStart(addedWidth)), pc.bold('FILE'.padEnd(fileWidth))].join(
    '  ',
  );

  const divider = [pc.dim('─'.repeat(addedWidth)), pc.dim('─'.repeat(fileWidth))].join('  ');

  const body = files.flatMap((file) => {
    const tokens = pc.yellow(`+${formatCompactTokens(file.estimatedTokens)}`.padStart(addedWidth));
    const filename = pc.cyan(file.filename.padEnd(fileWidth));
    const labelIndent = ' '.repeat(addedWidth + 2);
    const label = pc.dim(`${labelIndent}${file.category} · ${file.label}`);
    return [`${tokens}  ${filename}`, label];
  });

  return [header, divider, ...body].join('\n');
}

function formatScanDefault(
  _analysis: PullRequestAnalysis,
  debt: RepoContextDebt,
  options: CliScanFormatOptions,
): string {
  const severityThresholds = resolveSeverityThresholds(options.severityThresholds);
  const riskLevel = getRiskLevel(debt.totalEstimatedTokens, options.topFiles, severityThresholds);

  const sections = [
    `${pc.bold('🤖 ContextLevy scan')}`,
    '',
    options.reviewSummary,
    '',
    `${pc.bold('Context debt score:')} ${debt.score}/100 · grade ${formatDebtGrade(debt.grade)} · risk ${riskLevel}`,
    `${pc.bold('Indexable junk tokens:')} ~${formatCompactTokens(debt.indexableTokens)} · ${pc.bold('High-impact files:')} ${debt.highImpactFileCount}`,
    `${pc.bold('Tracked files:')} ${debt.trackedFileCount} · ${pc.bold('Analyzed:')} ${debt.analyzedFileCount} · ${pc.bold('Total tokens:')} ~${formatCompactTokens(debt.totalEstimatedTokens)}`,
    '',
    pc.bold('Category breakdown'),
    formatCategoryTable(debt),
    '',
    pc.bold('Top context-heavy paths'),
    formatTopFilesTable(options.topFiles),
    '',
    pc.dim(
      'Debt score weights indexable artifact tokens (55%), high-impact file breadth (30%), and total volume (15%).',
    ),
    pc.dim(
      `Estimation mode: ${options.estimationMode}. Scan uses tracked files only (git ls-files).`,
    ),
  ];

  if (options.configFound === false) {
    sections.push(pc.dim('No contextlevy.config.yml found. Run: npx contextlevy init'));
  }

  return sections.join('\n');
}

function formatScanCompact(
  _analysis: PullRequestAnalysis,
  debt: RepoContextDebt,
  options: CliScanFormatOptions,
): string {
  const lines = [
    [pc.bold('🤖 ContextLevy scan'), `debt ${debt.score}/100`, formatDebtGrade(debt.grade)].join(
      pc.dim(' · '),
    ),
    '',
    options.reviewSummary,
    '',
    `${pc.bold('Indexable junk:')} ~${formatCompactTokens(debt.indexableTokens)} · ${pc.bold('High-impact files:')} ${debt.highImpactFileCount} · ${pc.bold('Tracked:')} ${debt.trackedFileCount}`,
  ];

  if (options.topFiles.length > 0) {
    const top = options.topFiles
      .slice(0, 3)
      .map(
        (file) =>
          `${pc.cyan(file.filename)} ${pc.yellow(`+${formatCompactTokens(file.estimatedTokens)}`)}`,
      )
      .join(pc.dim(' · '));
    lines.push('', `  ${top}`);
  }

  lines.push('', pc.dim('Tracked-file baseline scan. Use contextlevy check before opening a PR.'));

  if (options.configFound === false) {
    lines.push(pc.dim('No contextlevy.config.yml found. Run: npx contextlevy init'));
  }

  return lines.join('\n');
}

export function formatCliScanOutput(
  analysis: PullRequestAnalysis,
  debt: RepoContextDebt,
  args: CliScanArgs,
  options: CliScanFormatOptions,
): string {
  if (args.format === 'json') {
    const severityThresholds = resolveSeverityThresholds(options.severityThresholds);
    const riskLevel = getRiskLevel(debt.totalEstimatedTokens, options.topFiles, severityThresholds);

    return JSON.stringify(
      {
        scan: {
          debt,
          riskLevel,
          reviewSummary: options.reviewSummary,
          topFiles: options.topFiles,
          estimationMode: options.estimationMode,
        },
        analysis,
      },
      null,
      2,
    );
  }

  if (args.format === 'compact') {
    return formatScanCompact(analysis, debt, options);
  }

  return formatScanDefault(analysis, debt, options);
}
