# ContextLevy v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a TypeScript GitHub Action that comments on pull requests with an honest **estimated AI-context token delta** for newly added/changed file content, grouped by high-impact categories (generated code, coverage, lockfiles, etc.), with zero external API calls and no LLM key.

**Architecture:** Fetch changed files from the GitHub Pull Request Files API, estimate added-context tokens from each file's unified diff patch (fallback: `additions × 10` when patch is missing), classify paths with a small ordered rule list, aggregate totals, and upsert a single PR comment marked with an HTML comment anchor. Bundle with `@vercel/ncc` into `dist/index.js` for `node20` runners.

**Tech Stack:** TypeScript, `@actions/core`, `@actions/github`, Vitest, `@vercel/ncc`, GitHub Actions (`pull_request` workflow)

---

## File Structure

| File | Responsibility |
|------|----------------|
| `action.yml` | Action metadata, inputs, outputs |
| `package.json` | Scripts, deps, `"type": "commonjs"` |
| `tsconfig.json` | Strict TS for Node 20 |
| `vitest.config.ts` | Test runner config |
| `src/types.ts` | Shared interfaces |
| `src/tokens.ts` | Patch parsing + token heuristics |
| `src/rules.ts` | Path matchers, categories, suggestion text |
| `src/analyze.ts` | Per-file + PR-level aggregation |
| `src/comment.ts` | Markdown comment renderer |
| `src/index.ts` | Action entry: fetch files, analyze, upsert comment |
| `__tests__/tokens.test.ts` | Token estimation tests |
| `__tests__/rules.test.ts` | Rule matching tests |
| `__tests__/analyze.test.ts` | End-to-end analysis on fixtures |
| `__tests__/comment.test.ts` | Comment formatting tests |
| `.github/workflows/ci.yml` | Test + build on push/PR |
| `.github/workflows/contextlevy.yml` | Dogfood action on PRs to this repo |
| `dist/index.js` | NCC bundle (committed) |
| `README.md` | Usage, philosophy, limitations |

---

## Design Notes (read once)

**Token heuristic (not billing):** `estimatedTokens = ceil(addedChars / 4)`. This mirrors the common "~4 characters per token" rule of thumb. Every user-facing string says **estimated** or **context-risk delta**.

**What counts as "added context":** Only lines in the patch that start with `+` (excluding `+++` hunk headers). For files without a patch (binary/large/truncated), use `additions * 10` tokens (~40 chars/line ÷ 4).

**PR delta only:** Ignore deletions. Skip files with `status === 'removed'`. For `renamed`, treat as added content in the new path.

**No whole-repo scan:** Only `octokit.rest.pulls.listFiles`.

**Comment upsert:** Search existing issue comments for `<!-- contextlevy -->`. Update if found; create otherwise.

**Skip quiet PRs:** If total estimated tokens `< token-threshold` input (default `1000`), post nothing and log an info message.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "contextlevy",
  "version": "0.1.0",
  "description": "GitHub Action: estimate AI agent context overhead from PR diffs",
  "main": "dist/index.js",
  "scripts": {
    "build": "ncc build src/index.ts -o dist --license licenses.txt",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "all": "npm run typecheck && npm run test && npm run build"
  },
  "dependencies": {
    "@actions/core": "^1.11.1",
    "@actions/github": "^6.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "@vercel/ncc": "^0.38.4",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "__tests__"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
*.log
.DS_Store
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors

- [ ] **Step 6: Commit**

```bash
git init
git add package.json tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: scaffold ContextLevy TypeScript action project"
```

---

### Task 2: Shared Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write `src/types.ts`**

```typescript
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
  costPerMillionTokens: number;
  maxHighImpactItems: number;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared analysis types"
```

---

### Task 3: Token Estimation

**Files:**
- Create: `src/tokens.ts`
- Test: `__tests__/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/tokens.test.ts`:

```typescript
import { countAddedCharsInPatch, estimateTokensFromPatch, estimateTokensFromAdditions } from '../src/tokens';

describe('countAddedCharsInPatch', () => {
  it('counts characters on added lines only', () => {
    const patch = [
      '@@ -1,2 +1,3 @@',
      ' context',
      '-old',
      '+new line',
      '+second',
    ].join('\n');

    expect(countAddedCharsInPatch(patch)).toBe('new line'.length + 'second'.length);
  });

  it('ignores +++ file headers', () => {
    const patch = '+++ b/src/foo.ts\n+hello';
    expect(countAddedCharsInPatch(patch)).toBe('hello'.length);
  });
});

describe('estimateTokensFromPatch', () => {
  it('uses chars/4 ceiling heuristic', () => {
    const patch = '+abcd\n+efgh';
    expect(estimateTokensFromPatch(patch)).toBe(Math.ceil(8 / 4));
  });

  it('returns 0 for empty patch', () => {
    expect(estimateTokensFromPatch(undefined)).toBe(0);
  });
});

describe('estimateTokensFromAdditions', () => {
  it('uses 10 tokens per added line fallback', () => {
    expect(estimateTokensFromAdditions(620)).toBe(6200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/tokens.test.ts`
Expected: FAIL — cannot find module `../src/tokens`

- [ ] **Step 3: Write minimal implementation**

Create `src/tokens.ts`:

```typescript
const CHARS_PER_TOKEN = 4;
const TOKENS_PER_ADDED_LINE_FALLBACK = 10;

export function countAddedCharsInPatch(patch: string): number {
  let total = 0;

  for (const line of patch.split('\n')) {
    if (line.startsWith('+++')) {
      continue;
    }
    if (line.startsWith('+')) {
      total += line.slice(1).length;
    }
  }

  return total;
}

export function estimateTokensFromPatch(patch: string | undefined): number {
  if (!patch) {
    return 0;
  }

  const addedChars = countAddedCharsInPatch(patch);
  return Math.ceil(addedChars / CHARS_PER_TOKEN);
}

export function estimateTokensFromAdditions(additions: number): number {
  return additions * TOKENS_PER_ADDED_LINE_FALLBACK;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/tokens.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/tokens.ts __tests__/tokens.test.ts
git commit -m "feat: estimate context tokens from patch additions"
```

---

### Task 4: Path Classification Rules

**Files:**
- Create: `src/rules.ts`
- Test: `__tests__/rules.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/rules.test.ts`:

```typescript
import { classifyPath } from '../src/rules';

describe('classifyPath', () => {
  it('flags prisma generated output', () => {
    const match = classifyPath('prisma/generated/client/index.js');
    expect(match.category).toBe('generated');
  });

  it('flags coverage output', () => {
    const match = classifyPath('coverage/lcov.info');
    expect(match.category).toBe('coverage');
    expect(match.suggestion).toMatch(/\.gitignore/i);
  });

  it('flags lockfiles', () => {
    expect(classifyPath('pnpm-lock.yaml').category).toBe('lockfile');
  });

  it('flags agent instruction files', () => {
    expect(classifyPath('.cursor/rules/react.mdc').category).toBe('agent-config');
    expect(classifyPath('AGENTS.md').category).toBe('agent-config');
  });

  it('returns other for normal source files', () => {
    expect(classifyPath('src/components/Button.tsx').category).toBe('other');
  });

  it('flags large additions via caller-provided threshold separately in analyze', () => {
    expect(classifyPath('src/big.ts').category).toBe('other');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/rules.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `src/rules.ts`:

```typescript
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
      label: 'Generated code. Usually low-value context for coding agents.',
      suggestion: 'Do not commit generated output unless required.',
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/rules.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/rules.ts __tests__/rules.test.ts
git commit -m "feat: classify paths by AI context risk category"
```

---

### Task 5: PR File Analysis

**Files:**
- Create: `src/analyze.ts`
- Test: `__tests__/analyze.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/analyze.test.ts`:

```typescript
import { analyzePullRequestFiles } from '../src/analyze';
import type { PullRequestFileLike } from '../src/types';

describe('analyzePullRequestFiles', () => {
  it('aggregates estimated tokens across added and modified files', () => {
    const files: PullRequestFileLike[] = [
      {
        filename: 'coverage/lcov.info',
        status: 'added',
        additions: 100,
        deletions: 0,
        changes: 100,
        patch: '+'.repeat(400),
      },
      {
        filename: 'src/index.ts',
        status: 'modified',
        additions: 4,
        deletions: 1,
        changes: 5,
        patch: '+abcd',
      },
    ];

    const result = analyzePullRequestFiles(files, { largeFileTokenThreshold: 5000 });

    expect(result.totalEstimatedTokens).toBeGreaterThan(0);
    expect(result.files).toHaveLength(2);
    expect(result.files[0]?.category).toBe('coverage');
    expect(result.suggestions.some((s) => s.includes('.gitignore'))).toBe(true);
  });

  it('skips removed files', () => {
    const files: PullRequestFileLike[] = [
      {
        filename: 'old.txt',
        status: 'removed',
        additions: 0,
        deletions: 999,
        changes: 999,
      },
    ];

    const result = analyzePullRequestFiles(files, { largeFileTokenThreshold: 5000 });
    expect(result.files).toHaveLength(0);
    expect(result.totalEstimatedTokens).toBe(0);
  });

  it('uses additions fallback when patch missing', () => {
    const files: PullRequestFileLike[] = [
      {
        filename: 'assets/image.png',
        status: 'added',
        additions: 50,
        deletions: 0,
        changes: 50,
      },
    ];

    const result = analyzePullRequestFiles(files, { largeFileTokenThreshold: 5000 });
    expect(result.files[0]?.estimatedTokens).toBe(500);
  });

  it('overrides category to large-file above threshold', () => {
    const longLine = '+' + 'x'.repeat(20000);
    const files: PullRequestFileLike[] = [
      {
        filename: 'src/normal.ts',
        status: 'added',
        additions: 1,
        deletions: 0,
        changes: 1,
        patch: longLine,
      },
    ];

    const result = analyzePullRequestFiles(files, { largeFileTokenThreshold: 1000 });
    expect(result.files[0]?.category).toBe('large-file');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/analyze.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `src/analyze.ts`:

```typescript
import { classifyPath, largeFileMatch } from './rules';
import { estimateTokensFromAdditions, estimateTokensFromPatch } from './tokens';
import type { FileAnalysis, PullRequestAnalysis, PullRequestFileLike } from './types';

export interface AnalyzeOptions {
  largeFileTokenThreshold: number;
}

function uniqueSuggestions(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    out.push(value);
  }

  return out;
}

export function analyzePullRequestFiles(
  files: PullRequestFileLike[],
  options: AnalyzeOptions,
): PullRequestAnalysis {
  const analyzed: FileAnalysis[] = [];

  for (const file of files) {
    if (file.status === 'removed') {
      continue;
    }

    const fromPatch = estimateTokensFromPatch(file.patch);
    const estimatedTokens =
      fromPatch > 0 || file.patch
        ? fromPatch
        : estimateTokensFromAdditions(file.additions);

    if (estimatedTokens <= 0) {
      continue;
    }

    let rule = classifyPath(file.filename);

    if (estimatedTokens >= options.largeFileTokenThreshold && rule.category === 'other') {
      rule = largeFileMatch();
    }

    analyzed.push({
      filename: file.filename,
      status: file.status,
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

export function getHighImpactFiles(
  analysis: PullRequestAnalysis,
  maxItems: number,
): FileAnalysis[] {
  return analysis.files
    .filter((file) => file.category !== 'other')
    .slice(0, maxItems);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/analyze.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/analyze.ts __tests__/analyze.test.ts
git commit -m "feat: analyze PR files into context-risk totals"
```

---

### Task 6: Comment Formatter

**Files:**
- Create: `src/comment.ts`
- Test: `__tests__/comment.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/comment.test.ts`:

```typescript
import { formatComment, COMMENT_MARKER } from '../src/comment';
import type { PullRequestAnalysis } from '../src/types';

const analysis: PullRequestAnalysis = {
  totalEstimatedTokens: 24600,
  suggestions: ['Add coverage/ to .gitignore.', 'Do not commit generated output unless required.'],
  files: [
    {
      filename: 'prisma/generated/client/index.js',
      status: 'added',
      estimatedTokens: 18400,
      category: 'generated',
      label: 'Generated code. Usually low-value context for coding agents.',
      suggestion: 'Do not commit generated output unless required.',
    },
    {
      filename: 'coverage/lcov.info',
      status: 'added',
      estimatedTokens: 6200,
      category: 'coverage',
      label: 'Coverage output is usually noisy and should not be committed.',
      suggestion: 'Add coverage/ to .gitignore.',
    },
  ],
};

describe('formatComment', () => {
  it('includes marker, total, high impact items, cost estimate, and suggestions', () => {
    const body = formatComment(analysis, {
      costPerMillionTokens: 3,
      maxHighImpactItems: 5,
    });

    expect(body).toContain(COMMENT_MARKER);
    expect(body).toContain('~24,600 estimated AI-context tokens');
    expect(body).toContain('prisma/generated/client/index.js');
    expect(body).toContain('coverage/lcov.info');
    expect(body).toContain('~$0.07/session');
    expect(body).toContain('Add coverage/ to .gitignore.');
  });

  it('states estimates are heuristic', () => {
    const body = formatComment(analysis, {
      costPerMillionTokens: 3,
      maxHighImpactItems: 5,
    });

    expect(body.toLowerCase()).toContain('estimate');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- __tests__/comment.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

Create `src/comment.ts`:

```typescript
import { getHighImpactFiles } from './analyze';
import type { CommentOptions, PullRequestAnalysis } from './types';

export const COMMENT_MARKER = '<!-- contextlevy -->';

function formatTokenCount(value: number): string {
  return value.toLocaleString('en-US');
}

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatHighImpactSection(
  analysis: PullRequestAnalysis,
  maxItems: number,
): string {
  const highImpact = getHighImpactFiles(analysis, maxItems);

  if (highImpact.length === 0) {
    return 'No high-risk path patterns detected — mostly ordinary source changes.';
  }

  const lines = highImpact.flatMap((file) => [
    `  +${formatTokenCount(file.estimatedTokens).padStart(6)}  ${file.filename}`,
    `           ${file.label}`,
    '',
  ]);

  return lines.join('\n').trimEnd();
}

export function formatComment(
  analysis: PullRequestAnalysis,
  options: CommentOptions,
): string {
  const worstCaseCost =
    (analysis.totalEstimatedTokens / 1_000_000) * options.costPerMillionTokens;

  const suggestionLines =
    analysis.suggestions.length > 0
      ? analysis.suggestions.map((s) => `  - ${s}`).join('\n')
      : '  - No specific suggestions — diff looks context-light.';

  return [
    COMMENT_MARKER,
    '🤖 **ContextLevy**',
    '',
    `This PR adds **~${formatTokenCount(analysis.totalEstimatedTokens)} estimated AI-context tokens** (heuristic; not exact billing).`,
    '',
    '**High impact:**',
    formatHighImpactSection(analysis, options.maxHighImpactItems),
    '',
    `**Estimated worst-case input cost if read by an agent:** ~${formatUsd(worstCaseCost)}/session`,
    '',
    '_Different models tokenize differently, and agents may not read every changed file._',
    '',
    '**Suggestions:**',
    suggestionLines,
  ].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- __tests__/comment.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/comment.ts __tests__/comment.test.ts
git commit -m "feat: format PR comment with estimates and suggestions"
```

---

### Task 7: GitHub Action Entrypoint

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write `src/index.ts`**

```typescript
import * as core from '@actions/core';
import * as github from '@actions/github';
import { analyzePullRequestFiles } from './analyze';
import { COMMENT_MARKER, formatComment } from './comment';
import type { PullRequestFileLike } from './types';

async function listAllPullRequestFiles(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PullRequestFileLike[]> {
  const files: PullRequestFileLike[] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.pulls.listFiles,
    {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    },
  )) {
    for (const file of response.data) {
      files.push({
        filename: file.filename,
        status: file.status as PullRequestFileLike['status'],
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
      });
    }
  }

  return files;
}

async function upsertComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string,
): Promise<void> {
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  const existing = comments.find(
    (comment) =>
      comment.user?.type === 'Bot' && comment.body?.includes(COMMENT_MARKER),
  );

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    core.info(`Updated ContextLevy comment (${existing.id}).`);
    return;
  }

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
  core.info('Created ContextLevy comment.');
}

export async function run(): Promise<void> {
  const token = core.getInput('github-token', { required: true });
  const tokenThreshold = Number(core.getInput('token-threshold') || '1000');
  const largeFileTokenThreshold = Number(
    core.getInput('large-file-token-threshold') || '5000',
  );
  const maxHighImpactItems = Number(core.getInput('max-high-impact-items') || '5');
  const costPerMillionTokens = Number(
    core.getInput('cost-per-million-tokens') || '3',
  );

  const octokit = github.getOctokit(token);
  const context = github.context;

  if (!context.payload.pull_request) {
    core.info('Not a pull_request event — skipping.');
    return;
  }

  const pullNumber = context.payload.pull_request.number;
  const { owner, repo } = context.repo;

  core.info(`Analyzing PR #${pullNumber} in ${owner}/${repo}`);

  const files = await listAllPullRequestFiles(octokit, owner, repo, pullNumber);
  const analysis = analyzePullRequestFiles(files, { largeFileTokenThreshold });

  core.setOutput('total-estimated-tokens', String(analysis.totalEstimatedTokens));
  core.setOutput('analyzed-file-count', String(analysis.files.length));

  if (analysis.totalEstimatedTokens < tokenThreshold) {
    core.info(
      `Estimated tokens (${analysis.totalEstimatedTokens}) below threshold (${tokenThreshold}) — no comment posted.`,
    );
    return;
  }

  const body = formatComment(analysis, {
    costPerMillionTokens,
    maxHighImpactItems,
  });

  await upsertComment(octokit, owner, repo, pullNumber, body);
}

if (require.main === module) {
  run().catch((error: unknown) => {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  });
}
```

- [ ] **Step 2: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add GitHub Action entrypoint with PR comment upsert"
```

---

### Task 8: Action Metadata and Build

**Files:**
- Create: `action.yml`
- Create: `dist/index.js` (via build)
- Create: `licenses.txt` (via build)

- [ ] **Step 1: Create `action.yml`**

```yaml
name: ContextLevy
description: Estimate AI agent context overhead introduced by a pull request diff.
branding:
  icon: alert
  color: purple

inputs:
  github-token:
    description: GitHub token with pull-requests: write and contents: read
    required: false
    default: ${{ github.token }}
  token-threshold:
    description: Minimum estimated tokens before posting a PR comment
    required: false
    default: '1000'
  large-file-token-threshold:
    description: Per-file token count that triggers the large-file category
    required: false
    default: '5000'
  max-high-impact-items:
    description: Maximum number of high-impact files listed in the comment
    required: false
    default: '5'
  cost-per-million-tokens:
    description: USD input cost per 1M tokens for worst-case session estimate
    required: false
    default: '3'

outputs:
  total-estimated-tokens:
    description: Total estimated AI-context tokens added by this PR
  analyzed-file-count:
    description: Number of changed files included in the estimate

runs:
  using: node20
  main: dist/index.js
```

- [ ] **Step 2: Build the action bundle**

Run: `npm run build`
Expected: Creates `dist/index.js` and `licenses.txt`

- [ ] **Step 3: Verify bundle executes without GitHub context**

Run: `node -e "require('./dist/index.js')"`
Expected: May log/setFailed about missing inputs — that confirms the bundle loads. No "Cannot find module" errors.

- [ ] **Step 4: Commit**

```bash
git add action.yml dist/index.js licenses.txt
git commit -m "build: bundle action for node20 runner"
```

---

### Task 9: CI and Dogfood Workflows

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/contextlevy.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build

      - name: Verify dist is committed
        run: |
          git diff --exit-code dist/index.js licenses.txt
```

- [ ] **Step 2: Create `.github/workflows/contextlevy.yml`**

```yaml
name: ContextLevy

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  contextlevy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run ContextLevy
        uses: ./
        with:
          github-token: ${{ github.token }}
          token-threshold: '500'
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/contextlevy.yml
git commit -m "ci: add test/build pipeline and dogfood workflow"
```

---

### Task 10: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# ContextLevy

Bundle-size checks, but for **AI agent context cost**.

ContextLevy is a GitHub Action that comments on pull requests when the diff likely increases coding-agent context overhead — generated code, coverage output, lockfiles, build artifacts, logs, snapshots, agent instruction files, and other bulky paths.

It does **not** call an LLM and does **not** send your code anywhere. Estimates are heuristic context-risk deltas, not exact billing.

## Quick start

```yaml
name: ContextLevy
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  contextlevy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: your-org/contextlevy@v1
        with:
          github-token: ${{ github.token }}
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `github-token` | `${{ github.token }}` | Token with `pull-requests: write` |
| `token-threshold` | `1000` | Skip commenting below this estimated token total |
| `large-file-token-threshold` | `5000` | Marks individual files as large context risks |
| `max-high-impact-items` | `5` | Max files listed under High impact |
| `cost-per-million-tokens` | `3` | USD/1M tokens for worst-case cost line |

## How estimation works

1. List files changed in the PR via the GitHub Pull Request Files API.
2. Count **added** diff characters from each patch (`+` lines).
3. Convert to estimated tokens with `ceil(chars / 4)`.
4. If no patch is available, fall back to `additions × 10`.
5. Classify paths with lightweight rules (generated, coverage, lockfile, etc.).

Different models tokenize differently, and agents may not read every file. Treat the output as guidance.

## Development

```bash
npm install
npm test
npm run build
```

Commit `dist/index.js` after building so consumers do not install runtime dependencies.

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with usage and estimation notes"
```

---

### Task 11: Final Verification

**Files:**
- Verify: all tests, build, and CI config

- [ ] **Step 1: Run full check suite**

Run: `npm run all`
Expected: typecheck PASS, all tests PASS, build succeeds

- [ ] **Step 2: Confirm test count**

Run: `npm test`
Expected: 16 tests passing across 4 files

- [ ] **Step 3: Manual fixture sanity check (optional but recommended)**

Create a temporary script `scripts/debug-fixture.ts`:

```typescript
import { analyzePullRequestFiles } from '../src/analyze';
import { formatComment } from '../src/comment';

const files = [
  {
    filename: 'prisma/generated/client/index.js',
    status: 'added' as const,
    additions: 18400,
    deletions: 0,
    changes: 18400,
    patch: '+'.repeat(18400 * 4),
  },
  {
    filename: 'coverage/lcov.info',
    status: 'added' as const,
    additions: 6200,
    deletions: 0,
    changes: 6200,
    patch: '+'.repeat(6200 * 4),
  },
];

const analysis = analyzePullRequestFiles(files, { largeFileTokenThreshold: 5000 });
console.log(formatComment(analysis, { costPerMillionTokens: 3, maxHighImpactItems: 5 }));
```

Run: `npx ts-node scripts/debug-fixture.ts` (or `npx tsx scripts/debug-fixture.ts` if tsx is installed)
Expected: Output resembles the example comment from the spec (~24,600 tokens, two high-impact paths, ~$0.07/session)

Delete the temporary script after verifying — do not commit it.

- [ ] **Step 4: Final commit if any generated file drift**

Run: `git status`
Expected: clean working tree

---

## Self-Review Checklist

| Spec requirement | Task |
|------------------|------|
| GitHub Action commenting on PRs | Task 7, 8, 9 |
| Analyze PR diff only | Task 5, 7 (`pulls.listFiles`) |
| Estimate AI context tokens (heuristic) | Task 3, 5 |
| Flag generated, coverage, lockfiles, logs, snapshots, build outputs, agent files | Task 4 |
| Frame as estimate, not exact billing | Task 6 (comment copy) |
| No LLM API key | No LLM code anywhere |
| No external service for code | Only GitHub API via `@actions/github` |
| Not a generic context linter | Rule list is PR-delta focused, small |
| TypeScript GitHub JavaScript Action | Task 1, 8 |
| Simple v1 | No config files, no whole-repo scan, no check runs API |
| Useful PR comment format | Task 6 fixture matches spec example |

**Placeholder scan:** None — all tasks include concrete code and commands.

**Type consistency:** `PullRequestFileLike`, `PullRequestAnalysis`, `CommentOptions`, and `AnalyzeOptions` are defined in Tasks 2/5/6 and used consistently in Tasks 5–7.

---

## Out of Scope for v1 (explicitly deferred)

- Custom rule packs / user YAML config
- Check Runs or status checks (comment-only)
- `.contextlevyignore` file support
- Monorepo-aware path grouping
- Exact tokenizer integration (tiktoken, etc.)
- Marketplace publishing / semver tag automation (manual `v1` tag after first green CI)
