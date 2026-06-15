import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContextLevyMode } from '../config/types';
import { BRANCH_PROTECTION_HINT, runHookInstall } from './hooks';

export interface InitArgs {
  mode: ContextLevyMode;
  workflow: boolean;
  full: boolean;
  hookPreCommit: boolean;
  dryRun: boolean;
  force: boolean;
}

export interface InitResult {
  exitCode: number;
  output: string;
}

const CONFIG_FILENAME = 'contextlevy.config.yml';
const WORKFLOW_PATH = '.github/workflows/contextlevy.yml';

function buildConfigContents(mode: ContextLevyMode): string {
  return `# ContextLevy — repo hygiene linter for agent-heavy teams
# Docs: https://github.com/nonlooped/contextlevy/blob/main/docs/QUICKSTART.md

mode: ${mode}

# Paths you intentionally commit (generated clients, etc.) — counted but not flagged
# allow-paths:
#   - "packages/api/src/generated/**"
`;
}

const WORKFLOW_CONTENTS = `name: ContextLevy

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  issues: write
  checks: write
  security-events: write

jobs:
  contextlevy:
    name: Check repo context hygiene
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: nonlooped/contextlevy@v2
        with:
          github-token: \${{ github.token }}
`;

function writeFile(fullPath: string, contents: string, dryRun: boolean, force: boolean): string {
  if (existsSync(fullPath) && !force) {
    throw new Error(`${fullPath} already exists. Use --force to overwrite.`);
  }

  if (dryRun) {
    return `Would write ${fullPath}`;
  }

  const dir = join(fullPath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(fullPath, contents, 'utf8');
  return `Wrote ${fullPath}`;
}

export function runCliInit(args: InitArgs, cwd: string): InitResult {
  const lines: string[] = [];
  const includeWorkflow = args.workflow || args.full;

  try {
    lines.push(
      writeFile(
        join(cwd, CONFIG_FILENAME),
        buildConfigContents(args.mode),
        args.dryRun,
        args.force,
      ),
    );

    if (includeWorkflow) {
      lines.push(writeFile(join(cwd, WORKFLOW_PATH), WORKFLOW_CONTENTS, args.dryRun, args.force));
    }

    if (args.full) {
      const hookResult = runHookInstall(
        {
          prePush: true,
          preCommit: args.hookPreCommit,
          base: 'origin/main',
          dryRun: args.dryRun,
          force: args.force,
        },
        cwd,
      );

      if (hookResult.exitCode !== 0) {
        return hookResult;
      }

      lines.push(hookResult.output);
      lines.push('', BRANCH_PROTECTION_HINT);
    }

    if (args.dryRun) {
      lines.push('', 'Run without --dry-run to create these files.');
    } else if (args.full) {
      lines.push('', 'Next: npx contextlevy scan && npx contextlevy check --base main');
    } else {
      lines.push('', 'Next: npx contextlevy check --base main');
    }

    return { exitCode: 0, output: lines.join('\n') };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 2, output: message };
  }
}
