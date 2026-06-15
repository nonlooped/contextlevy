import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeIgnoreFileContents, suggestIgnorePatterns } from '../core/ignore-fix';
import { loadAnalysis } from './analysis';
import type { CliFixArgs } from './args';

export interface CliFixResult {
  exitCode: number;
  output: string;
}

type IgnoreTarget = 'gitignore' | 'cursorignore';

const TARGET_FILENAMES: Record<IgnoreTarget, string> = {
  gitignore: '.gitignore',
  cursorignore: '.cursorignore',
};

function resolveTargets(target: CliFixArgs['target']): IgnoreTarget[] {
  if (target === 'both') {
    return ['gitignore', 'cursorignore'];
  }
  return [target];
}

function readIgnoreFile(cwd: string, target: IgnoreTarget): string | null {
  const path = join(cwd, TARGET_FILENAMES[target]);
  if (!existsSync(path)) {
    return null;
  }
  return readFileSync(path, 'utf8');
}

function writeIgnoreFile(
  cwd: string,
  target: IgnoreTarget,
  content: string,
  dryRun: boolean,
): string {
  const path = join(cwd, TARGET_FILENAMES[target]);
  if (dryRun) {
    return `Would update ${path}`;
  }
  writeFileSync(path, content, 'utf8');
  return `Wrote ${path}`;
}

export function runCliFix(args: CliFixArgs, cwd: string): CliFixResult {
  try {
    const { analysis } = loadAnalysis({
      source: args.from,
      base: args.base,
      staged: args.staged,
      cwd,
    });

    const patterns = suggestIgnorePatterns(analysis.files);
    if (patterns.length === 0) {
      return {
        exitCode: 0,
        output:
          'No ignore patterns suggested — repo/diff looks context-light for indexable artifacts.',
      };
    }

    const lines: string[] = [
      `Suggested ${patterns.length} ignore pattern(s) from ${args.from} analysis:`,
      ...patterns.map((pattern) => `  - ${pattern}`),
      '',
    ];

    for (const target of resolveTargets(args.target)) {
      const existing = readIgnoreFile(cwd, target);
      const merged = mergeIgnoreFileContents(existing, patterns);

      lines.push(`${TARGET_FILENAMES[target]}:`);
      if (merged.added.length === 0) {
        lines.push('  All suggested patterns already covered.');
        lines.push('');
        continue;
      }

      lines.push(`  Add ${merged.added.length} pattern(s):`);
      for (const pattern of merged.added) {
        lines.push(`    + ${pattern}`);
      }

      if (merged.skipped.length > 0) {
        lines.push(`  Skip ${merged.skipped.length} already-covered pattern(s).`);
      }

      lines.push(`  ${writeIgnoreFile(cwd, target, merged.content, !args.write)}`);
      lines.push('');
    }

    if (!args.write) {
      lines.push('Run with --write to append missing patterns (default is dry-run).');
    }

    return {
      exitCode: 0,
      output: lines.join('\n').trimEnd(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 2, output: message };
  }
}
