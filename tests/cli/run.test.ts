import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCliDiff } from '../../src/cli/run';

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function stageCoverageFixture(repoDir: string): void {
  mkdirSync(join(repoDir, 'coverage'), { recursive: true });
  writeFileSync(join(repoDir, 'coverage', 'lcov.info'), 'A'.repeat(5000));
  git(repoDir, 'add', 'coverage/lcov.info');
}

describe('runCliDiff', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'contextlevy-cli-'));
    git(repoDir, 'init', '-b', 'main');
    git(repoDir, 'config', 'user.email', 'test@example.com');
    git(repoDir, 'config', 'user.name', 'Test User');
    writeFileSync(join(repoDir, 'README.md'), 'base\n');
    git(repoDir, 'add', 'README.md');
    git(repoDir, 'commit', '-m', 'initial');
  });

  afterEach(() => {
    // temp dir cleaned up by OS
  });

  it('reports ContextLevy output for changed coverage file', () => {
    stageCoverageFixture(repoDir);

    const result = runCliDiff(
      {
        command: 'diff',
        base: 'HEAD',
        staged: true,
        format: 'default',
        failOnConfig: false,
        strict: false,
      },
      repoDir,
    );

    expect(result.output).toContain('ContextLevy');
    expect(result.exitCode).toBe(0);
  });

  it('exits non-zero when fail-on-config thresholds are exceeded', () => {
    writeFileSync(join(repoDir, 'contextlevy.config.yml'), 'fail-above-tokens: 100\n');
    stageCoverageFixture(repoDir);

    const result = runCliDiff(
      {
        command: 'diff',
        base: 'HEAD',
        staged: true,
        format: 'default',
        failOnConfig: true,
        strict: false,
      },
      repoDir,
    );

    expect(result.output).toContain('ContextLevy');
    expect(result.exitCode).toBe(1);
  });
});
