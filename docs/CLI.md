# ContextLevy CLI

Run ContextLevy locally against your working tree or staged changes before opening a pull request. The CLI reuses the same config, rules, token estimation, and output formats as the GitHub Action.

**Requirements:** Node.js 20+, `git` on PATH.

## Install

```bash
npm install -g contextlevy
contextlevy check --base main
```

Or without a global install:

```bash
npx contextlevy check --base main
npx contextlevy init
```

## Commands

### `contextlevy check` (recommended)

Analyze changes against a base ref. `diff` is an alias.

```bash
# Working tree vs main
contextlevy check --base main

# Staged changes only
contextlevy check --staged

# JSON for scripts and hooks
contextlevy check --base origin/main --format json

# Apply fail settings from contextlevy.config.yml
contextlevy check --base main --fail-on-config

# Strict category-based gate (dist/, coverage/, etc.)
contextlevy check --base main --strict

# One-off token threshold
contextlevy check --base main --fail-above-tokens 10000
```

### `contextlevy init`

Scaffold configuration (and optionally a GitHub workflow):

```bash
contextlevy init
contextlevy init --mode strict --workflow
contextlevy init --dry-run
```

Refuses to overwrite existing files unless `--force`.

#### Flags

| Flag | Default | Description |
| --- | --- | --- |
| `--base <ref>` | `main` | Git ref to diff against |
| `--staged` | off | Analyze staged changes only (`git diff --cached`) |
| `--format <fmt>` | `default` | Output format: `default`, `compact`, or `json` |
| `--fail-on-config` | off | Apply fail settings from config |
| `--strict` | off | Shorthand for category-based fails (implies `--fail-on-config`) |
| `--fail-above-tokens <n>` | — | Override fail threshold (ignored when `--fail-on-config` is set) |

#### Exit codes

| Code | Meaning |
| ---: | --- |
| `0` | Below fail thresholds (or no fail config and `--fail-on-config` not set) |
| `1` | Fail threshold exceeded |
| `2` | Usage, config, or git error |

#### JSON output

`--format json` includes enriched fields for hooks:

- `riskLevel`
- `highImpactCategories`
- `reviewSummary`
- `failDecision`

## Configuration

The CLI reads `contextlevy.config.yml` (and other [supported config paths](CONFIG.md#config-paths)) from the repository root. See [CONFIG.md](CONFIG.md) for presets and all options.

When no config exists, the CLI prints: `Run: npx contextlevy init`

## Pre-push hook

```json
{
  "scripts": {
    "contextlevy": "contextlevy check --base origin/main --fail-on-config"
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
