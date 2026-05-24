import { matchesAnyPathPattern } from './paths';
import type { CustomRule, RuleMatch } from './types';

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
    test: (f) => /\.map$/i.test(f),
    match: {
      category: 'source-map',
      label: 'Source maps are poor context for coding agents.',
      suggestion: 'Keep source maps out of version control unless they are release artifacts.',
    },
  },
  {
    test: (f) =>
      /(?:^|\/)openapi(?:\/|$)/i.test(f) ||
      /(?:^|\/)swagger(?:\/|$)/i.test(f) ||
      /(?:^|\/)api-docs(?:\/|$)/i.test(f) ||
      /(?:^|\/)generated[-_]?(?:openapi|swagger|clients?)(?:\/|$)/i.test(f) ||
      /(?:^|\/)swagger\.(?:json|ya?ml|yaml)$/i.test(f),
    match: {
      category: 'openapi',
      label: 'OpenAPI/Swagger generated clients and dumps are often huge and repetitive.',
      suggestion: 'Generate API clients locally instead of committing generated output.',
    },
  },
  {
    test: (f) =>
      /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|tar|gz|7z|mp4|mp3|woff2?|ttf|eot|wasm)$/i.test(f),
    match: {
      category: 'binary-asset',
      label: 'Binary assets add diff noise without helping text-based coding agents.',
      suggestion: 'Store large binaries outside git or in release assets when possible.',
    },
  },
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
    test: (f) => /(?:^|\/)(?:vendor|third_party|third-party)(?:\/|$)/.test(f),
    match: {
      category: 'vendor',
      label: 'Vendored dependencies are bulky and rarely useful as agent context.',
      suggestion: 'Prefer lockfiles and package managers over committing vendor trees when possible.',
    },
  },
  {
    test: (f) =>
      /(?:^|\/)node_modules(?:\/|$)/.test(f) ||
      /(?:^|\/)(?:\.venv|venv|\.tox|\.eggs)(?:\/|$)/.test(f),
    match: {
      category: 'dependency-dir',
      label: 'Dependency directories should not be committed.',
      suggestion: 'Add node_modules/, .venv/, or equivalent directories to `.gitignore`.',
    },
  },
  {
    test: (f) =>
      /(?:^|\/)(?:\.turbo|\.parcel-cache|\.cache|\.pytest_cache|\.mypy_cache|\.terraform|\.next\/cache)(?:\/|$)/.test(
        f,
      ),
    match: {
      category: 'cache-dir',
      label: 'Cache directories are ephemeral build state, not source context.',
      suggestion: 'Add cache directories to `.gitignore`.',
    },
  },
  {
    test: (f) =>
      /(?:^|\/)(?:playwright-report|test-results|htmlcov|\.nyc_output)(?:\/|$)/.test(f),
    match: {
      category: 'test-output',
      label: 'Test output is noisy and should not be committed.',
      suggestion: 'Add test output directories to `.gitignore`.',
    },
  },
  {
    test: (f) =>
      /\.(?:pb|grpc)\.[a-z0-9]+$/i.test(f) ||
      /(?:^|\/)[^/]*_pb2\.py$/i.test(f) ||
      /(?:^|\/)proto\/gen(?:\/|$)/i.test(f),
    match: {
      category: 'protobuf',
      label: 'Protobuf/gRPC generated files are repetitive and better regenerated locally.',
      suggestion: 'Avoid committing generated protobuf output unless your workflow requires it.',
    },
  },
  {
    test: (f) =>
      /(?:^|\/)fixtures?(?:\/|$)/i.test(f) &&
      /\.(?:json|csv|xml|yaml|yml|txt|ndjson)$/i.test(f),
    match: {
      category: 'fixture',
      label: 'Large fixture files can dominate agent context.',
      suggestion: 'Keep fixtures minimal or load them from external test data when possible.',
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

export const DEFAULT_MATCH: RuleMatch = {
  category: 'other',
  label: 'Added/changed file content may be read by coding agents.',
};

function matchCustomRule(filename: string, customRules: CustomRule[]): RuleMatch | null {
  for (const rule of customRules) {
    if (matchesAnyPathPattern(filename, rule.paths)) {
      return {
        category: rule.category,
        label: rule.label,
        suggestion: rule.suggestion,
      };
    }
  }

  return null;
}

export function classifyPath(filename: string, customRules: CustomRule[] = []): RuleMatch {
  const customMatch = matchCustomRule(filename, customRules);
  if (customMatch) {
    return customMatch;
  }

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
