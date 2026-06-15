import { sortFilesByDisplayPriority } from './categories';
import { matchesAnyPathPattern } from './paths';
import { classifyPath, DEFAULT_MATCH, largeFileMatch } from './rules';
import { estimateTokensFromAdditions, estimateTokensFromPatch } from './tokens';
import type {
  CustomRule,
  EstimationMode,
  FileAnalysis,
  PullRequestAnalysis,
  PullRequestFileLike,
  RuleMatch,
} from './types';

export interface AnalyzeOptions {
  largeFileTokenThreshold: number;
  ignorePaths: string[];
  allowPaths: string[];
  estimationMode: EstimationMode;
  customRules: CustomRule[];
}

export interface ClassifyFileOptions {
  largeFileTokenThreshold: number;
  allowPaths: string[];
  customRules: CustomRule[];
}

export function resolveFileClassification(
  filename: string,
  estimatedTokens: number,
  options: ClassifyFileOptions,
): RuleMatch {
  let rule = classifyPath(filename, options.customRules);

  if (matchesAnyPathPattern(filename, options.allowPaths)) {
    rule = DEFAULT_MATCH;
  }

  if (estimatedTokens >= options.largeFileTokenThreshold && rule.category === 'other') {
    rule = largeFileMatch();
  }

  return rule;
}

export function uniqueSuggestions(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }

  return out;
}

export function analyzePullRequestFiles(
  files: PullRequestFileLike[],
  options: AnalyzeOptions,
): PullRequestAnalysis {
  const analyzed: FileAnalysis[] = [];

  for (const file of files) {
    if (file.status === 'removed') {
      continue;
    }

    if (matchesAnyPathPattern(file.filename, options.ignorePaths)) {
      continue;
    }

    const fromPatch = estimateTokensFromPatch(file.patch, options.estimationMode);
    const estimatedTokens =
      fromPatch > 0 || file.patch ? fromPatch : estimateTokensFromAdditions(file.additions);

    if (estimatedTokens <= 0) {
      continue;
    }

    const rule = resolveFileClassification(file.filename, estimatedTokens, options);

    analyzed.push({
      filename: file.filename,
      status: file.status,
      estimatedTokens,
      category: rule.category,
      label: rule.label,
      suggestion: rule.suggestion,
    });
  }

  analyzed.sort((a, b) => b.estimatedTokens - a.estimatedTokens);

  const totalEstimatedTokens = analyzed.reduce((sum, file) => sum + file.estimatedTokens, 0);

  return {
    totalEstimatedTokens,
    files: analyzed,
    suggestions: uniqueSuggestions(analyzed.map((file) => file.suggestion)),
  };
}

export function getHighImpactFiles(
  analysis: PullRequestAnalysis,
  maxItems: number,
): FileAnalysis[] {
  const highImpact = analysis.files.filter((file) => file.category !== 'other');
  return sortFilesByDisplayPriority(highImpact).slice(0, maxItems);
}
