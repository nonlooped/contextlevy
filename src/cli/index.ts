import { parseCliArgs } from './args';
import { runCliBadge } from './badge';
import { runCliFix } from './fix';
import { runHookInstall } from './hooks';
import { runCliInit } from './init';
import { runCliDiff } from './run';
import { runCliScan } from './scan';

try {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.command === 'init') {
    const result = runCliInit(args, process.cwd());
    process.stdout.write(`${result.output}\n`);
    process.exit(result.exitCode);
  }

  if (args.command === 'scan') {
    const result = runCliScan(args, process.cwd());
    process.stdout.write(`${result.output}\n`);
    process.exit(result.exitCode);
  }

  if (args.command === 'fix') {
    const result = runCliFix(args, process.cwd());
    process.stdout.write(`${result.output}\n`);
    process.exit(result.exitCode);
  }

  if (args.command === 'badge') {
    const result = runCliBadge(args, process.cwd());
    process.stdout.write(`${result.output}\n`);
    process.exit(result.exitCode);
  }

  if (args.command === 'hook-install') {
    const result = runHookInstall(args, process.cwd());
    process.stdout.write(`${result.output}\n`);
    process.exit(result.exitCode);
  }

  const result = runCliDiff(args, process.cwd());
  process.stdout.write(`${result.output}\n`);
  process.exit(result.exitCode);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(2);
}
