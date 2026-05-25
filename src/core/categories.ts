import type { ContextCategory } from './types';

/** Categories that indicate committed repo junk — strict mode fails on these. */
export const HARD_FAIL_CATEGORIES: readonly ContextCategory[] = [
  'build-output',
  'dependency-dir',
  'coverage',
  'cache-dir',
  'test-output',
  'log',
  'source-map',
  'minified',
] as const;

/** Categories that are often intentional — warn in comments, never fail alone. */
export const WARN_ONLY_CATEGORIES: readonly ContextCategory[] = [
  'lockfile',
  'agent-config',
  'generated',
  'snapshot',
] as const;

const DISPLAY_PRIORITY: Partial<Record<ContextCategory, number>> = {
  'agent-config': 0,
  'dependency-dir': 1,
  'build-output': 2,
  coverage: 3,
  generated: 4,
  lockfile: 10,
  snapshot: 11,
  fixture: 12,
  log: 5,
  minified: 6,
  'source-map': 7,
  vendor: 8,
  'cache-dir': 9,
  'test-output': 5,
  'binary-asset': 13,
  openapi: 14,
  protobuf: 15,
  'large-file': 16,
  other: 99,
};

const NARRATIVE_LABELS: Partial<Record<ContextCategory, string>> = {
  generated: 'generated output',
  coverage: 'coverage artifacts',
  'build-output': 'build artifacts',
  lockfile: 'lockfile churn',
  'agent-config': 'agent instruction changes',
  snapshot: 'snapshot changes',
  log: 'log files',
  minified: 'minified assets',
  'source-map': 'source maps',
  vendor: 'vendored dependencies',
  'dependency-dir': 'dependency directories',
  'cache-dir': 'cache directories',
  'test-output': 'test output',
  fixture: 'large fixtures',
  'binary-asset': 'binary assets',
  openapi: 'OpenAPI/generated API clients',
  protobuf: 'protobuf generated files',
  'large-file': 'large file changes',
};

function getCategoryDisplayPriority(category: ContextCategory): number {
  return DISPLAY_PRIORITY[category] ?? 50;
}

export function getCategoryNarrativeLabel(category: ContextCategory): string {
  return NARRATIVE_LABELS[category] ?? category;
}

export function sortFilesByDisplayPriority<
  T extends { category: ContextCategory; estimatedTokens: number },
>(files: T[]): T[] {
  return [...files].sort((a, b) => {
    const priorityDiff =
      getCategoryDisplayPriority(a.category) - getCategoryDisplayPriority(b.category);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return b.estimatedTokens - a.estimatedTokens;
  });
}
