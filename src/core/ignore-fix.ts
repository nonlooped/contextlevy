import { getIndexablePaths } from './indexing';
import { matchesPathPattern } from './paths';
import type { ContextCategory, FileAnalysis } from './types';

export const IGNORE_FILE_MARKER = '# ContextLevy — suggested ignore patterns';

const CATEGORY_IGNORE_DEFAULTS: Partial<Record<ContextCategory, readonly string[]>> = {
  coverage: ['coverage/', 'htmlcov/', '*.lcov'],
  'build-output': ['dist/', 'build/', 'out/', '.next/'],
  log: ['*.log', 'logs/'],
  'cache-dir': ['.cache/', '.turbo/', '.pytest_cache/'],
  'test-output': ['playwright-report/', 'test-results/'],
  'dependency-dir': ['node_modules/'],
  minified: ['*.min.js', '*.min.css'],
  'source-map': ['*.map'],
  generated: ['generated/'],
  vendor: ['vendor/'],
};

function normalizePattern(pattern: string): string {
  return pattern.trim();
}

export function extractIgnorePatterns(content: string): string[] {
  const patterns: string[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const withoutComment = trimmed.split(/\s+#/, 1)[0]?.trim() ?? '';
    if (withoutComment) {
      patterns.push(withoutComment);
    }
  }

  return patterns;
}

function probePathForPattern(pattern: string): string {
  const normalized = normalizePattern(pattern);
  if (normalized.endsWith('/')) {
    return `${normalized}probe.txt`;
  }
  return normalized;
}

export function isPatternCovered(pattern: string, existingPatterns: string[]): boolean {
  const normalized = normalizePattern(pattern);
  if (!normalized) {
    return true;
  }

  if (existingPatterns.some((existing) => normalizePattern(existing) === normalized)) {
    return true;
  }

  const probePath = probePathForPattern(normalized);
  return existingPatterns.some((existing) => {
    const candidate = normalizePattern(existing);
    if (!candidate) {
      return false;
    }

    if (
      candidate.endsWith('/') &&
      (probePath.startsWith(candidate) || normalized.startsWith(candidate))
    ) {
      return true;
    }

    if (normalized.endsWith('/') && candidate.endsWith('/') && normalized.startsWith(candidate)) {
      return true;
    }

    return (
      matchesPathPattern(probePath, candidate) ||
      matchesPathPattern(normalized, candidate) ||
      matchesPathPattern(`${normalized}/probe.txt`, candidate)
    );
  });
}

export function suggestIgnorePatterns(files: FileAnalysis[], maxPatterns = 20): string[] {
  const seen = new Set<string>();
  const patterns: string[] = [];

  const addPattern = (pattern: string): void => {
    const normalized = normalizePattern(pattern);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    patterns.push(normalized);
  };

  for (const path of getIndexablePaths(files, maxPatterns)) {
    addPattern(path);
  }

  const categories = new Set(files.map((file) => file.category));
  for (const category of categories) {
    const defaults = CATEGORY_IGNORE_DEFAULTS[category];
    if (!defaults) {
      continue;
    }
    for (const pattern of defaults) {
      addPattern(pattern);
      if (patterns.length >= maxPatterns) {
        return patterns;
      }
    }
  }

  return patterns.slice(0, maxPatterns);
}

export function filterNewIgnorePatterns(
  patterns: string[],
  existingPatterns: string[],
): { added: string[]; skipped: string[] } {
  const added: string[] = [];
  const skipped: string[] = [];
  const currentPatterns = [...existingPatterns];

  for (const pattern of patterns) {
    if (isPatternCovered(pattern, currentPatterns)) {
      skipped.push(pattern);
      continue;
    }
    added.push(pattern);
    currentPatterns.push(pattern);
  }

  return { added, skipped };
}

export function mergeIgnoreFileContents(
  existingContent: string | null,
  patterns: string[],
): { content: string; added: string[]; skipped: string[] } {
  const existingPatterns = existingContent ? extractIgnorePatterns(existingContent) : [];
  const { added, skipped } = filterNewIgnorePatterns(patterns, existingPatterns);

  if (added.length === 0) {
    return {
      content: existingContent ?? '',
      added,
      skipped,
    };
  }

  const block = [IGNORE_FILE_MARKER, ...added, ''].join('\n');
  const base = existingContent?.trimEnd() ?? '';
  const content = base.length > 0 ? `${base}\n\n${block}` : `${block}\n`;

  return { content, added, skipped };
}
