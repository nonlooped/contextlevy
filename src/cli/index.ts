import { parseCliArgs } from './args';
import { runCliInit } from './init';
import { runCliDiff } from './run';

try {
  const args = parseCliArgs(process.argv.slice(2));

  if (args.command === 'init') {
    const result = runCliInit(args, process.cwd());
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
