import { classifyPath } from './rules';
import type { ContextCategory, FileAnalysis } from './types';

export const INDEXABLE_CATEGORIES = new Set<ContextCategory>([
  'generated',
  'coverage',
  'build-output',
  'log',
  'minified',
  'vendor',
  'source-map',
  'dependency-dir',
  'cache-dir',
  'test-output',
  'openapi',
  'protobuf',
]);

function indexablePathForFile(filename: string, category: ContextCategory): string {
  const parts = filename.split('/');

  for (let end = parts.length; end >= 1; end -= 1) {
    const prefixParts = parts.slice(0, end);
    const last = prefixParts[prefixParts.length - 1] ?? filename;

    if (last.includes('.') && end === parts.length) {
      if (classifyPath(filename).category === category) {
        return filename;
      }
      continue;
    }

    const prefix = `${prefixParts.join('/')}/`;
    if (classifyPath(`${prefix}.`).category === category) {
      return prefix;
    }
  }

  const topLevel = parts[0] ?? filename;
  return topLevel.includes('.') && !topLevel.endsWith('/') ? filename : `${topLevel}/`;
}

export function getIndexablePaths(files: FileAnalysis[], maxItems = 4): string[] {
  const seen = new Set<string>();
  const paths: string[] = [];

  for (const file of files) {
    if (!INDEXABLE_CATEGORIES.has(file.category)) {
      continue;
    }
    const candidate = indexablePathForFile(file.filename, file.category);
    if (!seen.has(candidate)) {
      seen.add(candidate);
      paths.push(candidate);
    }
    if (paths.length >= maxItems) {
      break;
    }
  }

  return paths;
}

export function formatIndexingSuggestion(paths: string[]): string | null {
  if (paths.length === 0) {
    return null;
  }

  const examples = paths.map((path) => `- \`${path}\``).join('\n');

  return [
    'Consider excluding these paths from agent indexing (tool-agnostic):',
    examples,
    '',
    'Many tools honor `.gitignore`; others support dedicated ignore files such as `.cursorignore`.',
  ].join('\n');
}
