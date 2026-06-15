import { computeRepoContextDebt, getTopDebtFiles } from '../core/scan';
import { buildReviewSummary } from '../core/summary';
import { loadAnalysis } from './analysis';
import type { CliScanArgs } from './args';
import { formatCliScanOutput } from './format-scan';

export interface CliScanResult {
  exitCode: number;
  output: string;
}

function formatRepoScanHeadline(headline: string): string {
  return headline
    .replace(/^This PR adds/, 'Tracked files include')
    .replace(/^This diff adds/, 'Tracked files include')
    .replace(/^This diff looks/, 'This repo looks');
}

export function runCliScan(args: CliScanArgs, cwd: string): CliScanResult {
  const { analysis, configFound, settings, trackedFileCount } = loadAnalysis({
    source: 'scan',
    base: 'main',
    staged: false,
    cwd,
  });

  const debt = computeRepoContextDebt(analysis, trackedFileCount ?? 0);
  const reviewSummary = formatRepoScanHeadline(buildReviewSummary(analysis).headline);
  const topFiles = getTopDebtFiles(analysis, settings.maxHighImpactItems);

  const output = formatCliScanOutput(analysis, debt, args, {
    maxHighImpactItems: settings.maxHighImpactItems,
    severityThresholds: settings.severityThresholds,
    estimationMode: settings.estimationMode,
    reviewSummary,
    topFiles,
    configFound,
  });

  return {
    output,
    exitCode: 0,
  };
}
