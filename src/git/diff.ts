import { execFileSync } from 'node:child_process';
import type { PullRequestFileLike } from '../core/types';

export function parseNumstatLine(line: string): PullRequestFileLike | null {
  const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
  if (!match) {
    return null;
  }

  const additions = match[1] === '-' ? 0 : Number(match[1]);
  const deletions = match[2] === '-' ? 0 : Number(match[2]);
  const filename = match[3];

  let status: PullRequestFileLike['status'] = 'modified';
  if (additions > 0 && deletions === 0) {
    status = 'added';
  } else if (additions === 0 && deletions > 0) {
    status = 'removed';
  }

  return {
    filename,
    status,
    additions,
    deletions,
    changes: additions + deletions,
  };
}

export function listChangedFiles(
  baseRef: string,
  staged = false,
  cwd?: string,
): PullRequestFileLike[] {
  const stagedArgs = staged ? ['--cached'] : [];
  const numstat = execFileSync('git', ['diff', '--numstat', ...stagedArgs, baseRef], {
    encoding: 'utf8',
    cwd,
  });

  const files: PullRequestFileLike[] = [];
  for (const line of numstat.split('\n')) {
    const parsed = parseNumstatLine(line.trim());
    if (parsed) {
      files.push(parsed);
    }
  }
  return files;
}

function loadPatchForFile(
  baseRef: string,
  filename: string,
  staged = false,
  cwd?: string,
): string | undefined {
  const stagedArgs = staged ? ['--cached'] : [];
  try {
    return execFileSync('git', ['diff', ...stagedArgs, baseRef, '--', filename], {
      encoding: 'utf8',
      cwd,
    });
  } catch {
    return undefined;
  }
}

export function attachPatches(
  baseRef: string,
  files: PullRequestFileLike[],
  staged = false,
  cwd?: string,
): PullRequestFileLike[] {
  return files.map((file) => ({
    ...file,
    patch: loadPatchForFile(baseRef, file.filename, staged, cwd),
  }));
}
