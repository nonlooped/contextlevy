import { getHighImpactFiles } from '../core/analyze';
import { sarifLevelForCategory } from '../core/categories';
import type { ContextCategory, FileAnalysis, PullRequestAnalysis } from '../core/types';
import { formatCompactTokens } from './shared';

const SARIF_SCHEMA = 'https://json.schemastore.org/sarif-2.1.0.json';
const TOOL_URI = 'https://github.com/nonlooped/contextlevy';

const RULE_DESCRIPTIONS: Partial<Record<ContextCategory, string>> = {
  generated: 'Generated code adds repetitive, low-value agent context.',
  coverage: 'Coverage artifacts are noisy and rarely useful for coding agents.',
  'build-output': 'Build artifacts are poor context for agent-assisted review.',
  lockfile: 'Lockfile churn can dominate agent context in dependency PRs.',
  'agent-config': 'Agent instruction changes affect future agent behavior.',
  snapshot: 'Snapshot files are often large and repetitive in agent context.',
  log: 'Log files are accidental noise in repository context.',
  minified: 'Minified assets are poor context for text-based coding agents.',
  vendor: 'Vendored trees are bulky and rarely useful as agent context.',
  'source-map': 'Source maps add bulk without helping coding agents.',
  'dependency-dir': 'Dependency directories should not be committed.',
  'cache-dir': 'Cache directories are ephemeral build state.',
  'test-output': 'Test output directories should not be committed.',
  fixture: 'Large fixtures can dominate agent context.',
  'binary-asset': 'Binary assets add diff noise without helping text agents.',
  openapi: 'Generated API clients are often huge and repetitive.',
  protobuf: 'Protobuf generated files are better regenerated locally.',
  'large-file': 'Large added diffs carry high context cost for agents.',
};

function ruleIdForCategory(category: ContextCategory): string {
  return `contextlevy/${category}`;
}

function buildRules(files: FileAnalysis[]) {
  const categories = new Set(files.map((file) => file.category));
  return [...categories].map((category) => ({
    id: ruleIdForCategory(category),
    shortDescription: {
      text: category,
    },
    fullDescription: {
      text: RULE_DESCRIPTIONS[category] ?? 'File may add avoidable agent context overhead.',
    },
    helpUri: `${TOOL_URI}#what-it-catches`,
  }));
}

function buildResult(file: FileAnalysis) {
  return {
    ruleId: ruleIdForCategory(file.category),
    level: sarifLevelForCategory(file.category),
    message: {
      text: `${file.label} (+${formatCompactTokens(file.estimatedTokens)} estimated tokens)`,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: file.filename,
          },
          // Category-level finding — no line-specific location in diff/scan analysis.
          region: {
            startLine: 1,
            startColumn: 1,
          },
        },
      },
    ],
  };
}

export interface SarifBuildOptions {
  maxResults?: number;
}

export function buildSarifReport(
  analysis: PullRequestAnalysis,
  options: SarifBuildOptions = {},
): Record<string, unknown> {
  const maxResults = options.maxResults ?? 50;
  const findings = getHighImpactFiles(analysis, analysis.files.length).slice(0, maxResults);

  return {
    version: '2.1.0',
    $schema: SARIF_SCHEMA,
    runs: [
      {
        tool: {
          driver: {
            name: 'ContextLevy',
            informationUri: TOOL_URI,
            rules: buildRules(findings),
          },
        },
        results: findings.map(buildResult),
      },
    ],
  };
}
