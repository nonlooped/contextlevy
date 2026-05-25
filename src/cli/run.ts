import { loadConfigFile } from '../config/load';
import { resolveSettings } from '../config/settings';
import { analyzePullRequestFiles, getHighImpactFiles } from '../core/analyze';
import { HARD_FAIL_CATEGORIES, WARN_ONLY_CATEGORIES } from '../core/categories';
import { type FailSettings, shouldFailRun } from '../core/fail';
import { getHighImpactCategories, getRiskLevel } from '../core/severity';
import { buildReviewSummary } from '../core/summary';
import { attachPatches, listChangedFiles } from '../git/diff';
import type { CliDiffArgs } from './args';
import { formatCliOutput } from './format';

export interface CliResult {
  exitCode: number;
  output: string;
}

export function runCliDiff(args: CliDiffArgs, cwd: string): CliResult {
  const config = loadConfigFile(cwd);
  const settings = resolveSettings(config);

  const files = attachPatches(
    args.base,
    listChangedFiles(args.base, args.staged, cwd),
    args.staged,
    cwd,
  );

  const analysis = analyzePullRequestFiles(files, {
    largeFileTokenThreshold: settings.largeFileTokenThreshold,
    ignorePaths: settings.ignorePaths,
    allowPaths: settings.allowPaths,
    estimationMode: settings.estimationMode,
    customRules: settings.customRules,
  });

  const commentOptions = {
    maxHighImpactItems: settings.maxHighImpactItems,
    showCostTable: settings.showCostTable,
    pricingProfiles: settings.pricingProfiles,
    commentFormat: settings.commentFormat,
    severityThresholds: settings.severityThresholds,
  };

  const highImpact = getHighImpactFiles(analysis, analysis.files.length);
  const riskLevel = getRiskLevel(
    analysis.totalEstimatedTokens,
    highImpact,
    settings.severityThresholds,
  );
  const reviewSummary = buildReviewSummary(analysis);

  let failSettings: FailSettings = args.failOnConfig
    ? {
        failOnSeverity: settings.failOnSeverity,
        failAboveTokens: settings.failAboveTokens,
        failOnCategories: settings.failOnCategories,
        warnOnlyCategories: settings.warnOnlyCategories,
        severityThresholds: settings.severityThresholds,
      }
    : { failAboveTokens: args.failAboveTokens };

  if (args.strict) {
    failSettings = {
      ...failSettings,
      failOnCategories: settings.failOnCategories.length
        ? settings.failOnCategories
        : [...HARD_FAIL_CATEGORIES],
      warnOnlyCategories: settings.warnOnlyCategories.length
        ? settings.warnOnlyCategories
        : [...WARN_ONLY_CATEGORIES],
    };
  }

  const failDecision = shouldFailRun(analysis, failSettings, settings.maxHighImpactItems);

  const output = formatCliOutput(analysis, args, commentOptions, {
    riskLevel,
    highImpactCategories: getHighImpactCategories(highImpact),
    reviewSummary: reviewSummary.headline,
    failDecision,
    baseRef: args.base,
    configFound: config !== null,
  });

  return {
    output,
    exitCode: failDecision.fail ? 1 : 0,
  };
}
