import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { runCliFix } from '../../src/cli/fix';

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, encoding: 'utf8' });
}

describe('runCliFix', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'contextlevy-fix-'));
    git(repoDir, 'init', '-b', 'main');
    git(repoDir, 'config', 'user.email', 'test@example.com');
    git(repoDir, 'config', 'user.name', 'Test User');
    writeFileSync(join(repoDir, 'README.md'), 'base\n');
    git(repoDir, 'add', 'README.md');
    git(repoDir, 'commit', '-m', 'initial');
  });

  it('dry-run suggests patterns without writing files', () => {
    mkdirSync(join(repoDir, 'coverage'), { recursive: true });
    writeFileSync(join(repoDir, 'coverage', 'lcov.info'), 'A'.repeat(1000));
    git(repoDir, 'add', 'coverage/lcov.info');
    git(repoDir, 'commit', '-m', 'add coverage');

    const result = runCliFix(
      {
        command: 'fix',
        write: false,
        target: 'gitignore',
        from: 'scan',
        base: 'main',
        staged: false,
      },
      repoDir,
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Would update');
    expect(result.output).toContain('coverage/');
    expect(existsSync(join(repoDir, '.gitignore'))).toBe(false);
  });

  it('writes missing patterns to .gitignore and .cursorignore', () => {
    mkdirSync(join(repoDir, 'dist'), { recursive: true });
    writeFileSync(join(repoDir, 'dist', 'bundle.js'), 'A'.repeat(1000));
    git(repoDir, 'add', 'dist/bundle.js');
    git(repoDir, 'commit', '-m', 'add dist');

    const result = runCliFix(
      {
        command: 'fix',
        write: true,
        target: 'both',
        from: 'scan',
        base: 'main',
        staged: false,
      },
      repoDir,
    );

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(repoDir, '.gitignore'), 'utf8')).toContain('dist/');
    expect(readFileSync(join(repoDir, '.cursorignore'), 'utf8')).toContain('dist/');
  });
});
