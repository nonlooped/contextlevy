export type ContextCategory =
  | 'generated'
  | 'coverage'
  | 'lockfile'
  | 'build-output'
  | 'log'
  | 'snapshot'
  | 'agent-config'
  | 'minified'
  | 'large-file'
  | 'other';

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
}

export interface PricingProfile {
  name: string;
  inputCostPerMillion: number;
}

/** @deprecated Use PricingProfile */
export type ModelPricing = PricingProfile;
