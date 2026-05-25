import { getCategoryNarrativeLabel, sortFilesByDisplayPriority } from './categories';
import type { ContextCategory, FileAnalysis, PullRequestAnalysis } from './types';

export type ReviewExpectation = 'quiet' | 'noisy' | 'critical';

export interface ReviewSummary {
  headline: string;
  categories: ContextCategory[];
  expectation: ReviewExpectation;
}

const CRITICAL_CATEGORIES = new Set<ContextCategory>([
  'dependency-dir',
  'build-output',
  'coverage',
  'cache-dir',
  'test-output',
]);

const NOISY_CATEGORIES = new Set<ContextCategory>([
  'generated',
  'lockfile',
  'agent-config',
  'snapshot',
  'log',
  'minified',
  'source-map',
  'vendor',
  'openapi',
  'protobuf',
  'fixture',
  'large-file',
]);

function uniqueCategories(files: FileAnalysis[]): ContextCategory[] {
  const seen = new Set<ContextCategory>();
  const ordered: ContextCategory[] = [];
  for (const file of sortFilesByDisplayPriority(files)) {
    if (file.category === 'other' || seen.has(file.category)) {
      continue;
    }
    seen.add(file.category);
    ordered.push(file.category);
  }
  return ordered;
}

function deriveExpectation(categories: ContextCategory[]): ReviewExpectation {
  if (categories.some((category) => CRITICAL_CATEGORIES.has(category))) {
    return 'critical';
  }
  if (categories.some((category) => NOISY_CATEGORIES.has(category))) {
    return 'noisy';
  }
  return 'quiet';
}

function formatCategoryList(categories: ContextCategory[]): string {
  const labels = categories.map((category) => getCategoryNarrativeLabel(category));
  if (labels.length === 0) {
    return '';
  }
  if (labels.length === 1) {
    return labels[0] ?? '';
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function buildHeadline(categories: ContextCategory[], expectation: ReviewExpectation): string {
  if (categories.length === 0) {
    return 'This diff looks context-light for agent-assisted review.';
  }

  const list = formatCategoryList(categories);
  const hasAgentConfig = categories.includes('agent-config');

  if (expectation === 'critical') {
    if (hasAgentConfig) {
      return `This PR adds ${list} — expect a noisy agent review. Agent instructions also changed.`;
    }
    return `This PR adds ${list} — expect a noisy agent review.`;
  }

  if (expectation === 'noisy') {
    if (hasAgentConfig && categories.length > 1) {
      const withoutAgent = categories.filter((c) => c !== 'agent-config');
      const mainList = formatCategoryList(withoutAgent);
      return `This PR adds ${mainList}; agent instructions also changed — expect a noisier agent review.`;
    }
    return `This PR adds ${list} — agent-assisted review may be noisier than usual.`;
  }

  return `This diff adds ${list}.`;
}

export function buildReviewSummary(analysis: PullRequestAnalysis): ReviewSummary {
  const hygieneFiles = analysis.files.filter((file) => file.category !== 'other');
  const categories = uniqueCategories(hygieneFiles);
  const expectation = deriveExpectation(categories);

  return {
    headline: buildHeadline(categories, expectation),
    categories,
    expectation,
  };
}

export function getPrioritizedFindings(
  analysis: PullRequestAnalysis,
  maxItems: number,
): FileAnalysis[] {
  const highImpact = analysis.files.filter((file) => file.category !== 'other');
  if (highImpact.length === 0) {
    return analysis.files.slice(0, maxItems);
  }
  return sortFilesByDisplayPriority(highImpact).slice(0, maxItems);
}
