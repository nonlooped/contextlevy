import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertGitRepo, isGitRepo } from '../../src/git/repo';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('isGitRepo', () => {
  it('returns true inside this repository', () => {
    expect(isGitRepo(process.cwd())).toBe(true);
  });

  it('returns false outside a git repository', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-no-git-'));
    tempDirs.push(dir);
    expect(isGitRepo(dir)).toBe(false);
  });
});

describe('assertGitRepo', () => {
  it('throws a friendly error outside a git repository', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-no-git-'));
    tempDirs.push(dir);
    expect(() => assertGitRepo(dir)).toThrow(/Not a git repository/);
  });
});
