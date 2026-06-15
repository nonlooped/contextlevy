import { loadConfigFile } from '../config/load';
import { type ContextLevySettings, resolveSettings } from '../config/settings';
import { analyzePullRequestFiles } from '../core/analyze';
import { analyzeRepositoryFiles } from '../core/scan';
import type { PullRequestAnalysis } from '../core/types';
import { attachPatches, listChangedFiles } from '../git/diff';
import { assertGitRef, assertGitRepo } from '../git/repo';
import { loadTrackedFiles } from '../git/scan';

export interface LoadAnalysisOptions {
  source: 'scan' | 'check';
  base: string;
  staged: boolean;
  cwd: string;
  settings?: ContextLevySettings;
}

export function loadAnalysis(options: LoadAnalysisOptions): {
  analysis: PullRequestAnalysis;
  configFound: boolean;
  settings: ContextLevySettings;
  trackedFileCount?: number;
} {
  assertGitRepo(options.cwd);

  const config = loadConfigFile(options.cwd);
  const settings = options.settings ?? resolveSettings(config);

  const analyzeOptions = {
    largeFileTokenThreshold: settings.largeFileTokenThreshold,
    ignorePaths: settings.ignorePaths,
    allowPaths: settings.allowPaths,
    estimationMode: settings.estimationMode,
    customRules: settings.customRules,
  };

  if (options.source === 'check') {
    assertGitRef(options.base, options.cwd);

    const files = attachPatches(
      options.base,
      listChangedFiles(options.base, options.staged, options.cwd),
      options.staged,
      options.cwd,
    );

    return {
      analysis: analyzePullRequestFiles(files, analyzeOptions),
      configFound: config !== null,
      settings,
    };
  }

  const { filenames, files } = loadTrackedFiles(options.cwd);
  return {
    analysis: analyzeRepositoryFiles(files, analyzeOptions),
    configFound: config !== null,
    settings,
    trackedFileCount: filenames.length,
  };
}
