import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCliInit } from '../../src/cli/init';

describe('runCliInit', () => {
  it('writes config in dry-run mode without creating files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-init-'));
    const result = runCliInit(
      { mode: 'advisory', workflow: false, dryRun: true, force: false },
      dir,
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Would write');
    expect(existsSync(join(dir, 'contextlevy.config.yml'))).toBe(false);
  });

  it('creates config and optional workflow', () => {
    const dir = mkdtempSync(join(tmpdir(), 'contextlevy-init-'));
    const result = runCliInit({ mode: 'strict', workflow: true, dryRun: false, force: false }, dir);

    expect(result.exitCode).toBe(0);
    expect(readFileSync(join(dir, 'contextlevy.config.yml'), 'utf8')).toContain('mode: strict');
    expect(readFileSync(join(dir, '.github/workflows/contextlevy.yml'), 'utf8')).toContain(
      'ContextLevy',
    );
  });
});
