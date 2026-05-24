import { analyzePullRequestFiles } from '../analyze';
import { loadConfigFile } from '../config';
import { shouldFailRun } from '../fail';
import { attachPatches, listChangedFiles } from '../git/diff';
import { resolveSettings } from '../settings';
import type { CliArgs } from './args';
import { formatCliOutput } from './format';

export interface CliResult {
  exitCode: number;
  output: string;
}

export function runCliDiff(args: CliArgs, cwd: string): CliResult {
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

  const output = formatCliOutput(analysis, args, commentOptions);

  const failSettings = args.failOnConfig
    ? {
        failOnSeverity: settings.failOnSeverity,
        failAboveTokens: settings.failAboveTokens,
        severityThresholds: settings.severityThresholds,
      }
    : { failAboveTokens: args.failAboveTokens };

  const failDecision = shouldFailRun(analysis, failSettings, settings.maxHighImpactItems);

  return {
    output,
    exitCode: failDecision.fail ? 1 : 0,
  };
}
