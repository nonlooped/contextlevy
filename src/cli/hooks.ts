import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { assertGitRepo } from '../git/repo';

export const HOOK_MARKER = '# contextlevy';

export type HookManager = 'husky' | 'lefthook' | 'git';

export interface HookInstallArgs {
  prePush: boolean;
  preCommit: boolean;
  base: string;
  dryRun: boolean;
  force: boolean;
}

export interface HookInstallResult {
  exitCode: number;
  output: string;
}

export function detectHookManager(cwd: string): HookManager {
  if (existsSync(join(cwd, 'lefthook.yml')) || existsSync(join(cwd, '.lefthook.yml'))) {
    return 'lefthook';
  }
  if (existsSync(join(cwd, '.husky'))) {
    return 'husky';
  }
  return 'git';
}

export function buildHookCommand(options: { staged: boolean; base: string }): string {
  const parts = ['npx contextlevy check'];
  if (options.staged) {
    parts.push('--staged');
  } else {
    parts.push('--base', options.base);
  }
  parts.push('--fail-on-config');
  return parts.join(' ');
}

function stripContextLevyBlock(content: string): string {
  const lines = content.split('\n');
  const kept: string[] = [];
  let skipping = false;

  for (const line of lines) {
    if (line.includes(HOOK_MARKER)) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (line.trim() === '' || line.startsWith('#')) {
        continue;
      }
      if (!line.includes('contextlevy')) {
        skipping = false;
        kept.push(line);
      }
      continue;
    }
    if (!line.includes('contextlevy check')) {
      kept.push(line);
    }
  }

  return kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

function buildShellHookContent(existing: string | null, command: string): string {
  const base = existing ? stripContextLevyBlock(existing) : '';
  const lines = ['#!/usr/bin/env sh', ...(base ? [base, ''] : []), HOOK_MARKER, command, ''];
  return lines.join('\n');
}

function writeExecutableHook(
  hookPath: string,
  content: string,
  dryRun: boolean,
  force: boolean,
): string {
  if (existsSync(hookPath) && !force && readFileSync(hookPath, 'utf8').includes(HOOK_MARKER)) {
    return `ContextLevy hook already installed at ${hookPath} (use --force to replace).`;
  }

  if (dryRun) {
    return `Would write ${hookPath}`;
  }

  const dir = join(hookPath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(hookPath, content, 'utf8');
  chmodSync(hookPath, 0o755);
  return `Wrote ${hookPath}`;
}

function installHuskyHook(
  cwd: string,
  hookName: 'pre-push' | 'pre-commit',
  command: string,
  args: HookInstallArgs,
): string {
  const hookPath = join(cwd, '.husky', hookName);
  const existing = existsSync(hookPath) ? readFileSync(hookPath, 'utf8') : null;
  const content = buildShellHookContent(existing, command);
  return writeExecutableHook(hookPath, content, args.dryRun, args.force);
}

function installGitHook(
  cwd: string,
  hookName: 'pre-push' | 'pre-commit',
  command: string,
  args: HookInstallArgs,
): string {
  const gitDir = join(cwd, '.git');
  if (!existsSync(gitDir)) {
    throw new Error('Not a git repository — cannot install git hooks.');
  }

  const hookPath = join(gitDir, 'hooks', hookName);
  const existing = existsSync(hookPath) ? readFileSync(hookPath, 'utf8') : null;
  const content = buildShellHookContent(existing, command);
  return writeExecutableHook(hookPath, content, args.dryRun, args.force);
}

function resolveLefthookPath(cwd: string): string {
  if (existsSync(join(cwd, 'lefthook.yml'))) {
    return join(cwd, 'lefthook.yml');
  }
  return join(cwd, '.lefthook.yml');
}

function installLefthookHook(
  cwd: string,
  hookName: 'pre-push' | 'pre-commit',
  command: string,
  args: HookInstallArgs,
): string {
  const configPath = resolveLefthookPath(cwd);
  const exists = existsSync(configPath);
  const config = exists
    ? (parseYaml(readFileSync(configPath, 'utf8')) as Record<string, unknown>)
    : {};

  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error(`${configPath} must contain a YAML object.`);
  }

  const hookConfig = (config[hookName] as Record<string, unknown> | undefined) ?? {};
  const commands = (hookConfig.commands as Record<string, unknown> | undefined) ?? {};
  commands.contextlevy = { run: command };
  hookConfig.commands = commands;
  config[hookName] = hookConfig;

  const nextContents = stringifyYaml(config);

  if (exists && !args.force && readFileSync(configPath, 'utf8').includes('contextlevy:')) {
    return `ContextLevy lefthook command already present in ${configPath} (use --force to replace).`;
  }

  if (args.dryRun) {
    return exists ? `Would update ${configPath}` : `Would create ${configPath}`;
  }

  writeFileSync(configPath, nextContents, 'utf8');
  return exists ? `Updated ${configPath}` : `Created ${configPath}`;
}

function installHookForManager(
  cwd: string,
  manager: HookManager,
  hookName: 'pre-push' | 'pre-commit',
  command: string,
  args: HookInstallArgs,
): string {
  switch (manager) {
    case 'husky':
      return installHuskyHook(cwd, hookName, command, args);
    case 'lefthook':
      return installLefthookHook(cwd, hookName, command, args);
    default:
      return installGitHook(cwd, hookName, command, args);
  }
}

export const BRANCH_PROTECTION_HINT = [
  'Optional GitHub branch protection:',
  '  Settings → Branches → Branch protection → Require status checks',
  '  Select check: "ContextLevy" (preferred) or job "Check repo context hygiene"',
].join('\n');

export function runHookInstall(args: HookInstallArgs, cwd: string): HookInstallResult {
  try {
    assertGitRepo(cwd);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 2, output: message };
  }

  const lines: string[] = [];
  const manager = detectHookManager(cwd);
  lines.push(`Detected hook manager: ${manager}`);

  try {
    if (args.prePush) {
      const command = buildHookCommand({ staged: false, base: args.base });
      lines.push(installHookForManager(cwd, manager, 'pre-push', command, args));
    }

    if (args.preCommit) {
      const command = buildHookCommand({ staged: true, base: args.base });
      lines.push(installHookForManager(cwd, manager, 'pre-commit', command, args));
    }

    if (!args.prePush && !args.preCommit) {
      throw new Error('Specify at least one hook type: --pre-push and/or --pre-commit.');
    }

    if (args.dryRun) {
      lines.push('', 'Run without --dry-run to install hooks.');
    }

    return { exitCode: 0, output: lines.join('\n') };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 2, output: message };
  }
}
