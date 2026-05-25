# ContextLevy CLI

Run ContextLevy locally against your working tree or staged changes before opening a pull request. The CLI reuses the same config, rules, token estimation, and output formats as the GitHub Action.

**Requirements:** Node.js 20+, `git` on PATH.

## Install

```bash
npm install -g contextlevy
contextlevy diff --base main
```

Or from a clone of this repository:

```bash
npm install
npm run build:cli
npm link   # optional: install `contextlevy` globally
```

Or invoke directly after building:

```bash
node bin/contextlevy.js diff --base main
```

## Commands

### `contextlevy diff`

Analyze changes against a base ref.

```bash
# Working tree vs main
contextlevy diff --base main

# Staged changes only
contextlevy diff --staged

# JSON for scripts and hooks
contextlevy diff --base origin/main --format json

# Respect fail settings from contextlevy.config.yml
contextlevy diff --base main --fail-on-config

# One-off token threshold
contextlevy diff --base main --fail-above-tokens 10000
```

#### Flags

| Flag | Default | Description |
| --- | --- | --- |
| `--base <ref>` | `main` | Git ref to diff against |
| `--staged` | off | Analyze staged changes only (`git diff --cached`) |
| `--format <fmt>` | `default` | Output format: `default`, `compact`, or `json` |
| `--fail-on-config` | off | Apply `fail-above-tokens` and `fail-on-severity` from config |
| `--fail-above-tokens <n>` | — | Override fail threshold (ignored when `--fail-on-config` is set) |

#### Exit codes

| Code | Meaning |
| ---: | --- |
| `0` | Below fail thresholds (or no fail config and `--fail-on-config` not set) |
| `1` | Fail threshold exceeded |
| `2` | Usage, config, or git error |

## Configuration

The CLI reads `contextlevy.config.yml` (and other [supported config paths](CONFIG.md#config-paths)) from the repository root. See [CONFIG.md](CONFIG.md) for all options.

## Pre-push hook

Add a script to catch high-context diffs before they reach CI:

```json
{
  "scripts": {
    "contextlevy": "contextlevy diff --base origin/main --fail-on-config"
  }
}
```

With [Husky](https://typicode.github.io/husky/):

```bash
npx husky add .husky/pre-push "npm run contextlevy"
```

## Notes

- The CLI analyzes **tracked** changes visible to `git diff`. Stage new files with `git add` before running, or use `--staged`.
- Token estimates match the Action's `simple` or `tokenizer` mode from your config.
- The npm package ships only the CLI (`lib/`). The GitHub Action bundle (`dist/index.js`) is built separately and is not published to npm.
