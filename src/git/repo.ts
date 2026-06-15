import { execFileSync } from 'node:child_process';

function isNotGitRepositoryError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const stderr =
    'stderr' in error && Buffer.isBuffer(error.stderr) ? error.stderr.toString('utf8') : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const combined = `${stderr}\n${message}`;
  return combined.includes('not a git repository');
}

function isBadRefError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const stderr =
    'stderr' in error && Buffer.isBuffer(error.stderr) ? error.stderr.toString('utf8') : '';
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const combined = `${stderr}\n${message}`;
  return (
    combined.includes('bad revision') ||
    combined.includes('unknown revision') ||
    combined.includes('Invalid revision range') ||
    combined.includes('no such ref')
  );
}

function wrapGitError(error: unknown, context: string): Error {
  if (isNotGitRepositoryError(error)) {
    return new Error('Not a git repository — run ContextLevy from inside a git repo.');
  }
  if (isBadRefError(error)) {
    return new Error(context);
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

export function isGitRepo(cwd?: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function assertGitRepo(cwd?: string): void {
  if (!isGitRepo(cwd)) {
    throw new Error('Not a git repository — run ContextLevy from inside a git repo.');
  }
}

export function assertGitRef(ref: string, cwd?: string): void {
  try {
    execFileSync('git', ['rev-parse', '--verify', ref], { cwd, stdio: 'ignore' });
  } catch (error) {
    throw wrapGitError(error, `Git ref "${ref}" not found — check --base.`);
  }
}

export function execGit(
  args: string[],
  options: { cwd?: string; encoding?: 'buffer' | 'utf8'; maxBuffer?: number } = {},
): string | Buffer {
  const encoding = options.encoding ?? 'utf8';

  try {
    return execFileSync('git', args, {
      cwd: options.cwd,
      encoding,
      maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    });
  } catch (error) {
    const refArg = args.find((arg) => !arg.startsWith('-') && arg !== 'diff' && arg !== 'ls-files');
    const context =
      args[0] === 'diff' && refArg
        ? `Git ref "${refArg}" not found — check --base.`
        : 'Git command failed — run ContextLevy from inside a git repo.';
    throw wrapGitError(error, context);
  }
}
