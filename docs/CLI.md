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

### `contextlevy scan`

Baseline scan of **tracked files** (`git ls-files`) to measure repo-wide agent context debt before opening a PR.

```bash
# Terminal report with debt score (0–100) and grade
contextlevy scan

# Compact summary
contextlevy scan --format compact

# JSON for dashboards, badges, and automation
contextlevy scan --format json
```

The debt score weights:

- **55%** — tokens in indexable junk categories (coverage, `dist/`, generated output, etc.)
- **30%** — breadth of high-impact classified files
- **15%** — total estimated token volume

Grades: **A** (0–10) through **F** (71–100). Higher score = more context debt.

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

### `contextlevy fix`

Suggest or append `.gitignore` and `.cursorignore` patterns for indexable junk paths (coverage, `dist/`, generated output, etc.). **Defaults to dry-run** — pass `--write` to append missing patterns only.

```bash
# Preview from full-repo scan (default)
contextlevy fix

# Append to both ignore files
contextlevy fix --write

# Only .cursorignore, based on current diff
contextlevy fix --from check --base main --target cursorignore --write
```

| Flag | Default | Description |
| --- | --- | --- |
| `--write` | off | Append missing patterns (otherwise dry-run) |
| `--target` | `both` | `gitignore`, `cursorignore`, or `both` |
| `--from` | `scan` | `scan` (tracked files) or `check` (git diff) |
| `--base <ref>` | `main` | Base ref when `--from check` |
| `--staged` | off | Staged diff only when `--from check` |

### `contextlevy badge`

Generate shields.io badge markdown for READMEs or PR templates.

```bash
# Repo context debt badge from scan
contextlevy badge --style debt

# PR risk badge from current diff
contextlevy badge --from check --base main --style risk

# Token delta badge
contextlevy badge --from check --style tokens --format url

# From saved scan JSON
contextlevy scan --format json > .contextlevy/scan.json
contextlevy badge --style debt --input .contextlevy/scan.json
```

| Flag | Default | Description |
| --- | --- | --- |
| `--style` | `risk` | `risk`, `debt`, or `tokens` |
| `--from` | `scan` | `scan` or `check` (ignored when `--input` is set) |
| `--format` | `markdown` | `markdown`, `url`, or `json` |
| `--input <file>` | — | JSON from `scan` or `check --format json` |

### `contextlevy hook install`

Install pre-push or pre-commit hooks. Detects **Husky**, **lefthook**, or plain `.git/hooks`.

```bash
# Pre-push gate (default)
contextlevy hook install

# Staged pre-commit gate
contextlevy hook install --pre-commit --no-pre-push

# Preview without writing
contextlevy hook install --dry-run
```

| Flag | Default | Description |
| --- | --- | --- |
| `--pre-push` | on | Install `pre-push` hook |
| `--pre-commit` | off | Install `pre-commit` hook (staged changes) |
| `--base <ref>` | `main` | Base ref for pre-push hook |
| `--dry-run` | off | Preview hook changes |
| `--force` | off | Replace existing ContextLevy hook block |

### `contextlevy init`

Scaffold configuration (and optionally a GitHub workflow):

```bash
contextlevy init
contextlevy init --mode strict --workflow
contextlevy init --full
contextlevy init --dry-run
```

`--full` writes config, workflow, pre-push hook, and prints a branch-protection checklist.

Refuses to overwrite existing files unless `--force`.

| Flag | Default | Description |
| --- | --- | --- |
| `--mode <mode>` | `advisory` | `advisory`, `strict`, `minimal`, or `legacy` |
| `--workflow` | off | Also write `.github/workflows/contextlevy.yml` |
| `--full` | off | Config + workflow + pre-push hook + branch-protection hints |
| `--pre-commit` | off | With `--full`, also install a staged pre-commit hook |
| `--dry-run` | off | Preview files without writing |
| `--force` | off | Overwrite existing scaffolded files |

### `contextlevy check` / `contextlevy diff` flags

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

`contextlevy check --format json` includes enriched fields for hooks:

- `riskLevel`
- `highImpactCategories`
- `reviewSummary`
- `failDecision`

## Configuration

The CLI reads `contextlevy.config.yml` (and other [supported config paths](CONFIG.md#config-paths)) from the repository root. See [CONFIG.md](CONFIG.md) for presets and all options.

When no config exists, the CLI prints: `Run: npx contextlevy init`

Prefer `contextlevy hook install` or `contextlevy init --full` over manual hook wiring.

## Notes

- The CLI analyzes **tracked** changes visible to `git diff`. Stage new files with `git add` before running, or use `--staged`.
- Token estimates match the Action's `simple` or `tokenizer` mode from your config.
- The npm package ships only the CLI (`lib/`). The GitHub Action bundle (`dist/index.js`) is built separately and is not published to npm.
