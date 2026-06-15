import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCliInit } from '../../src/cli/init';

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, encoding: 'utf8' });
}

describe('runCliInit', () => {
  it('writes config in dry-run mode without creating files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-init-'));
    const result = runCliInit(
      {
        mode: 'advisory',
        workflow: false,
        full: false,
        hookPreCommit: false,
        dryRun: true,
        force: false,
      },
      dir,
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Would write');
    expect(existsSync(join(dir, 'contextlevy.config.yml'))).toBe(false);
  });

  it('creates config and optional workflow', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-init-'));
    const result = runCliInit(
      {
        mode: 'strict',
        workflow: true,
        full: false,
        hookPreCommit: false,
        dryRun: false,
        force: false,
      },
      dir,
    );

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(dir, 'contextlevy.config.yml'), 'utf8')).toContain('mode: strict');
    expect(readFileSync(join(dir, '.github/workflows/contextlevy.yml'), 'utf8')).toContain(
      'ContextLevy',
    );
  });

  it('init --full scaffolds workflow and installs pre-push hook', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-init-full-'));
    git(dir, 'init', '-b', 'main');
    git(dir, 'config', 'user.email', 'test@example.com');
    git(dir, 'config', 'user.name', 'Test User');
    writeFileSync(join(dir, 'README.md'), 'base\n');
    git(dir, 'add', 'README.md');
    git(dir, 'commit', '-m', 'initial');

    const result = runCliInit(
      {
        mode: 'advisory',
        workflow: false,
        full: true,
        hookPreCommit: false,
        dryRun: false,
        force: false,
      },
      dir,
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('branch protection');
    expect(existsSync(join(dir, '.git/hooks/pre-push'))).toBe(true);
    expect(existsSync(join(dir, '.github/workflows/contextlevy.yml'))).toBe(true);
  });
});
