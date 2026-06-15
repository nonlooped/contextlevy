import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCliScan } from '../../src/cli/scan';

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, encoding: 'utf8' });
}

describe('runCliScan', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'contextlevy-scan-'));
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

  it('reports context debt for tracked artifact files', () => {
    mkdirSync(join(repoDir, 'coverage'), { recursive: true });
    writeFileSync(join(repoDir, 'coverage', 'lcov.info'), 'A'.repeat(8000));
    git(repoDir, 'add', 'coverage/lcov.info');
    git(repoDir, 'commit', '-m', 'add coverage');

    const result = runCliScan(
      {
        command: 'scan',
        format: 'default',
      },
      repoDir,
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('ContextLevy scan');
    expect(result.output).toContain('Context debt score');
    expect(result.output).toContain('coverage/lcov.info');
  });

  it('returns structured JSON with debt metadata', () => {
    mkdirSync(join(repoDir, 'dist'), { recursive: true });
    writeFileSync(join(repoDir, 'dist', 'bundle.js'), 'A'.repeat(4000));
    git(repoDir, 'add', 'dist/bundle.js');
    git(repoDir, 'commit', '-m', 'add dist');

    const result = runCliScan(
      {
        command: 'scan',
        format: 'json',
      },
      repoDir,
    );

    const parsed = JSON.parse(result.output) as {
      scan: {
        debt: { score: number; grade: string; indexableTokens: number };
        topFiles: Array<{ filename: string }>;
      };
    };

    expect(parsed.scan.debt.score).toBeGreaterThan(0);
    expect(parsed.scan.debt.indexableTokens).toBeGreaterThan(0);
    expect(parsed.scan.topFiles.some((file) => file.filename === 'dist/bundle.js')).toBe(true);
  });
});
