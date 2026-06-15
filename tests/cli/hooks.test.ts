import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildHookCommand,
  detectHookManager,
  HOOK_MARKER,
  runHookInstall,
} from '../../src/cli/hooks';

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, encoding: 'utf8' });
}

describe('hooks', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'contextlevy-hooks-'));
    git(repoDir, 'init', '-b', 'main');
    git(repoDir, 'config', 'user.email', 'test@example.com');
    git(repoDir, 'config', 'user.name', 'Test User');
    writeFileSync(join(repoDir, 'README.md'), 'base\n');
    git(repoDir, 'add', 'README.md');
    git(repoDir, 'commit', '-m', 'initial');
  });

  it('builds pre-push and pre-commit commands', () => {
    expect(buildHookCommand({ staged: false, base: 'origin/main' })).toBe(
      'npx contextlevy check --base origin/main --fail-on-config',
    );
    expect(buildHookCommand({ staged: true, base: 'main' })).toBe(
      'npx contextlevy check --staged --fail-on-config',
    );
  });

  it('detects husky when .husky exists', () => {
    mkdirSync(join(repoDir, '.husky'));
    expect(detectHookManager(repoDir)).toBe('husky');
  });

  it('installs a git pre-push hook by default', () => {
    const result = runHookInstall(
      {
        prePush: true,
        preCommit: false,
        base: 'origin/main',
        dryRun: false,
        force: false,
      },
      repoDir,
    );

    expect(result.exitCode).toBe(0);
    const hookPath = join(repoDir, '.git', 'hooks', 'pre-push');
    expect(existsSync(hookPath)).toBe(true);
    const contents = readFileSync(hookPath, 'utf8');
    expect(contents).toContain(HOOK_MARKER);
    expect(contents).toContain('npx contextlevy check --base origin/main --fail-on-config');
  });

  it('updates lefthook.yml when present', () => {
    writeFileSync(join(repoDir, 'lefthook.yml'), 'pre-commit:\n  commands: {}\n');

    const result = runHookInstall(
      {
        prePush: true,
        preCommit: false,
        base: 'origin/main',
        dryRun: false,
        force: false,
      },
      repoDir,
    );

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(repoDir, 'lefthook.yml'), 'utf8')).toContain('contextlevy:');
  });
});
