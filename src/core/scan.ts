import { resolveFileClassification, uniqueSuggestions } from './analyze';
import { sortFilesByDisplayPriority } from './categories';
import { INDEXABLE_CATEGORIES } from './indexing';
import { matchesAnyPathPattern } from './paths';
import { estimateTokensFromText } from './tokens';
import type {
  ContextCategory,
  CustomRule,
  EstimationMode,
  FileAnalysis,
  PullRequestAnalysis,
} from './types';

export interface ScanOptions {
  largeFileTokenThreshold: number;
  ignorePaths: string[];
  allowPaths: string[];
  estimationMode: EstimationMode;
  customRules: CustomRule[];
}

export interface CategoryDebtBreakdown {
  category: ContextCategory;
  fileCount: number;
  estimatedTokens: number;
}

export type RepoDebtGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface RepoContextDebt {
  /** 0–100; higher means more agent-context debt in tracked files. */
  score: number;
  grade: RepoDebtGrade;
  totalEstimatedTokens: number;
  indexableTokens: number;
  highImpactFileCount: number;
  trackedFileCount: number;
  analyzedFileCount: number;
  categoryBreakdown: CategoryDebtBreakdown[];
}

export interface TrackedFileLike {
  filename: string;
  content: string;
  byteSize: number;
}

/** Indexable-token volume is capped at this many tokens for the 55-point component. */
const DEBT_INDEXABLE_CAP_TOKENS = 20_000;
const DEBT_INDEXABLE_WEIGHT = 55;
/** Each high-impact file adds this many points toward the 30-point breadth component. */
const DEBT_BREADTH_FACTOR = 1.5;
const DEBT_BREADTH_WEIGHT = 30;
/** Total estimated tokens are capped at this volume for the 15-point component. */
const DEBT_VOLUME_CAP_TOKENS = 100_000;
const DEBT_VOLUME_WEIGHT = 15;

function debtGradeFromScore(score: number): RepoDebtGrade {
  if (score <= 10) {
    return 'A';
  }
  if (score <= 25) {
    return 'B';
  }
  if (score <= 45) {
    return 'C';
  }
  if (score <= 70) {
    return 'D';
  }
  return 'F';
}

export function buildCategoryBreakdown(files: FileAnalysis[]): CategoryDebtBreakdown[] {
  const byCategory = new Map<ContextCategory, CategoryDebtBreakdown>();

  for (const file of files) {
    if (file.category === 'other') {
      continue;
    }

    const existing = byCategory.get(file.category);
    if (existing) {
      existing.fileCount += 1;
      existing.estimatedTokens += file.estimatedTokens;
      continue;
    }

    byCategory.set(file.category, {
      category: file.category,
      fileCount: 1,
      estimatedTokens: file.estimatedTokens,
    });
  }

  return [...byCategory.values()].sort((a, b) => b.estimatedTokens - a.estimatedTokens);
}

export function computeRepoContextDebt(
  analysis: PullRequestAnalysis,
  trackedFileCount: number,
): RepoContextDebt {
  const indexableTokens = analysis.files.reduce((sum, file) => {
    if (!INDEXABLE_CATEGORIES.has(file.category)) {
      return sum;
    }
    return sum + file.estimatedTokens;
  }, 0);

  const highImpactFileCount = analysis.files.filter((file) => file.category !== 'other').length;
  const categoryBreakdown = buildCategoryBreakdown(analysis.files);

  const indexableComponent = Math.min(
    DEBT_INDEXABLE_WEIGHT,
    (indexableTokens / DEBT_INDEXABLE_CAP_TOKENS) * DEBT_INDEXABLE_WEIGHT,
  );
  const breadthComponent = Math.min(DEBT_BREADTH_WEIGHT, highImpactFileCount * DEBT_BREADTH_FACTOR);
  const volumeComponent = Math.min(
    DEBT_VOLUME_WEIGHT,
    (analysis.totalEstimatedTokens / DEBT_VOLUME_CAP_TOKENS) * DEBT_VOLUME_WEIGHT,
  );
  const score = Math.round(indexableComponent + breadthComponent + volumeComponent);

  return {
    score,
    grade: debtGradeFromScore(score),
    totalEstimatedTokens: analysis.totalEstimatedTokens,
    indexableTokens,
    highImpactFileCount,
    trackedFileCount,
    analyzedFileCount: analysis.files.length,
    categoryBreakdown,
  };
}

export function analyzeRepositoryFiles(
  files: TrackedFileLike[],
  options: ScanOptions,
): PullRequestAnalysis {
  const analyzed: FileAnalysis[] = [];

  for (const file of files) {
    if (matchesAnyPathPattern(file.filename, options.ignorePaths)) {
      continue;
    }

    const estimatedTokens =
      file.content.length > 0
        ? estimateTokensFromText(file.content, options.estimationMode)
        : file.byteSize > 0
          ? Math.ceil(file.byteSize / 4)
          : 0;

    if (estimatedTokens <= 0) {
      continue;
    }

    const rule = resolveFileClassification(file.filename, estimatedTokens, options);

    analyzed.push({
      filename: file.filename,
      status: 'unchanged',
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

export function getTopDebtFiles(analysis: PullRequestAnalysis, maxItems: number): FileAnalysis[] {
  const highImpact = analysis.files.filter((file) => file.category !== 'other');
  if (highImpact.length === 0) {
    return analysis.files.slice(0, maxItems);
  }
  return sortFilesByDisplayPriority(highImpact).slice(0, maxItems);
}
