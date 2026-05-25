export const CONTEXT_CATEGORIES = [
  'generated',
  'coverage',
  'lockfile',
  'build-output',
  'log',
  'snapshot',
  'agent-config',
  'minified',
  'vendor',
  'source-map',
  'protobuf',
  'openapi',
  'dependency-dir',
  'cache-dir',
  'test-output',
  'fixture',
  'binary-asset',
  'large-file',
  'other',
] as const;

export type ContextCategory = (typeof CONTEXT_CATEGORIES)[number];

export interface PullRequestFileLike {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface RuleMatch {
  category: ContextCategory;
  label: string;
  suggestion?: string;
}

export interface FileAnalysis {
  filename: string;
  status: PullRequestFileLike['status'];
  estimatedTokens: number;
  category: ContextCategory;
  label: string;
  suggestion?: string;
}

export interface PullRequestAnalysis {
  totalEstimatedTokens: number;
  files: FileAnalysis[];
  suggestions: string[];
}

export interface CommentOptions {
  maxHighImpactItems: number;
  showCostTable: boolean;
  pricingProfiles: PricingProfile[];
  commentFormat: CommentFormat;
  severityThresholds?: SeverityThresholds;
}

export type CommentFormat = 'default' | 'compact';

export interface PricingProfile {
  name: string;
  inputCostPerMillion: number;
}

export type EstimationMode = 'simple' | 'tokenizer';

export interface CustomRule {
  name?: string;
  paths: string[];
  category: ContextCategory;
  label: string;
  suggestion?: string;
}

export interface SeverityThresholds {
  mediumTokens: number;
  highTokens: number;
  criticalTokens: number;
  mediumHighImpactCount: number;
  highHighImpactCount: number;
  criticalHighImpactCount: number;
}
