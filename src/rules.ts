import type { RuleMatch } from './types';

interface PathRule {
  test: (filename: string) => boolean;
  match: RuleMatch;
}

function basename(filename: string): string {
  const parts = filename.split('/');
  return parts[parts.length - 1] ?? filename;
}

function segmentIncludes(filename: string, segment: string): boolean {
  return filename.split('/').includes(segment);
}

const RULES: PathRule[] = [
  {
    test: (f) => /(?:^|\/)generated(?:\/|$)/i.test(f) || /\.gen\.[jt]sx?$/.test(f),
    match: {
      category: 'generated',
      label: 'Generated code is usually low-value context for coding agents.',
      suggestion: 'Avoid committing generated output unless required.',
    },
  },
  {
    test: (f) =>
      segmentIncludes(f, 'coverage') ||
      /\.(lcov|coverage|cov)$/i.test(f) ||
      /lcov\.info$/i.test(f),
    match: {
      category: 'coverage',
      label: 'Coverage output is usually noisy and should not be committed.',
      suggestion: 'Add coverage/ to .gitignore.',
    },
  },
  {
    test: (f) =>
      /(?:^|\/)(?:dist|build|out|\.next|target\/debug|target\/release)(?:\/|$)/.test(f),
    match: {
      category: 'build-output',
      label: 'Build artifacts are rarely useful agent context.',
      suggestion: 'Keep build output out of version control.',
    },
  },
  {
    test: (f) => /(?:^|\/)__snapshots__(?:\/|$)/.test(f) || /\.snap$/i.test(f),
    match: {
      category: 'snapshot',
      label: 'Snapshot files can be large and repetitive in agent context.',
      suggestion: 'Commit snapshots only when they are the source of truth for the test.',
    },
  },
  {
    test: (f) => /\.(?:log|logs)$/i.test(f) || segmentIncludes(f, 'logs'),
    match: {
      category: 'log',
      label: 'Log files are noisy and usually accidental commits.',
      suggestion: 'Add *.log and logs/ to .gitignore.',
    },
  },
  {
    test: (f) =>
      /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|Gemfile\.lock)$/.test(
        f,
      ),
    match: {
      category: 'lockfile',
      label: 'Lockfiles add bulk context; agents often need dependency names but not every resolved URL.',
      suggestion: 'Commit lockfiles when your team policy requires reproducible installs — just expect higher context cost.',
    },
  },
  {
    test: (f) =>
      /(?:^|\/)\.agents(?:\/|$)/.test(f) ||
      basename(f) === 'AGENTS.md' ||
      basename(f) === '.cursorrules' ||
      /^\.cursor\/rules\//.test(f) ||
      /^\.github\/copilot-instructions\.md$/.test(f),
    match: {
      category: 'agent-config',
      label: 'Agent instruction files are high-signal but add persistent context overhead.',
      suggestion: 'Keep agent instructions concise and scoped to what agents must know.',
    },
  },
  {
    test: (f) => /\.min\.(?:js|css)$/i.test(f),
    match: {
      category: 'minified',
      label: 'Minified files are poor context for coding agents.',
      suggestion: 'Do not commit minified assets unless they are release artifacts.',
    },
  },
];

const DEFAULT_MATCH: RuleMatch = {
  category: 'other',
  label: 'Added/changed file content may be read by coding agents.',
};

export function classifyPath(filename: string): RuleMatch {
  for (const rule of RULES) {
    if (rule.test(filename)) {
      return rule.match;
    }
  }
  return DEFAULT_MATCH;
}

export function largeFileMatch(): RuleMatch {
  return {
    category: 'large-file',
    label: 'Large added diff — high context cost if an agent reads the full file.',
    suggestion: 'Split large changes or exclude bulky paths from agent indexing where supported.',
  };
}
