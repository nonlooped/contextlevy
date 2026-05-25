---
name: contextlevy
description: Set up and use ContextLevy to estimate AI agent context cost from git diffs. Covers the GitHub Action (PR comments, fail thresholds) and the local CLI (pre-push checks). Use when the user asks about ContextLevy, AI context overhead, PR context bloat, coverage/generated files in diffs, contextlevy diff, or installing contextlevy.
metadata:
  author: unloopedmido
  version: "1.0.0"
---

# ContextLevy

ContextLevy estimates how much **net-new AI context** a diff adds — generated code, coverage, lockfiles, build output, agent config — and flags cleanup before it becomes repo debt.

**Privacy:** No LLM calls, no code upload, no external API. Runs locally in CI and on your machine.

## Install this skill

```bash
npx skills add unloopedmido/contextlevy --skill contextlevy
```

## Choose a setup path

| Goal | Use |
| --- | --- |
| Comment on every PR in GitHub | GitHub Action (below) |
| Check locally before opening a PR | CLI (below) |
| Block bad diffs in CI or hooks | CLI or Action with `fail-on-config` / `fail-above-tokens` |

Both paths share the same `.contextlevy.yml` config and analysis rules.

---

## GitHub Action

### 1. Install the app (recommended)

Install the [ContextLevy GitHub App](https://github.com/apps/contextlevy) on the repository.

Permissions: **Contents** read, **Pull requests** read & write, **Issues** read & write.

### 2. Add the workflow

Create `.github/workflows/contextlevy.yml`:

```yaml
name: ContextLevy

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  contextlevy:
    name: Check AI context cost
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: unloopedmido/contextlevy@v2
        with:
          github-token: ${{ github.token }}
```

### Action behavior

- Reads config from the **base branch** (a PR cannot silence the check by editing `.contextlevy.yml` in the same diff).
- Posts a PR comment when estimated tokens exceed `token-threshold`.
- **Fail mode** (`fail-on-severity` or `fail-above-tokens` in config) fails the workflow even when the comment is skipped.
- Workflow YAML only needs auth inputs; all tuning lives in `.contextlevy.yml`.

### Action outputs (for downstream steps)

| Output | Description |
| --- | --- |
| `total-estimated-tokens` | Total estimated net-new context tokens |
| `analyzed-file-count` | Changed files included in the estimate |
| `token-source` | Auth source: `app`, `github-token`, or `GITHUB_TOKEN` |
| `estimation-mode` | `simple` or `tokenizer` |

---

## Local CLI

### Install

```bash
npm install -g contextlevy
```

Requires Node.js 20+ and `git` on PATH.

### Common commands

```bash
# Working tree vs main
contextlevy diff --base main

# Staged changes only
contextlevy diff --staged

# JSON for scripts / hooks
contextlevy diff --base origin/main --format json

# Apply fail settings from .contextlevy.yml
contextlevy diff --base main --fail-on-config

# One-off threshold
contextlevy diff --base main --fail-above-tokens 10000
```

### Exit codes

| Code | Meaning |
| ---: | --- |
| `0` | Below fail thresholds |
| `1` | Fail threshold exceeded |
| `2` | Usage, config, or git error |

### CLI caveats

- Analyzes **tracked** changes visible to `git diff`. Stage new files with `git add`, or pass `--staged`.
- Reuses the same config file and estimation modes as the Action.

### Pre-push hook

```json
{
  "scripts": {
    "contextlevy": "contextlevy diff --base origin/main --fail-on-config"
  }
}
```

---

## Configuration

Add `.contextlevy.yml` at the repo root (or see [CONFIG.md](../../../docs/CONFIG.md) for all supported paths).

Minimal example:

```yaml
token-threshold: 1000
fail-on-severity: high
ignore-paths:
  - vendor/**
  - "**/*.map"
estimation-mode: simple
```

Key options:

| Key | Default | Purpose |
| --- | --- | --- |
| `token-threshold` | `1000` | Skip PR comment below this token total |
| `fail-on-severity` | unset | Fail at `low` / `medium` / `high` / `critical` or above |
| `fail-above-tokens` | unset | Fail when total estimated tokens exceed this value |
| `ignore-paths` | `[]` | Globs excluded from analysis |
| `allow-paths` | `[]` | Globs counted but not flagged as high-impact |
| `estimation-mode` | `simple` | `simple` (chars÷4) or `tokenizer` (local BPE) |
| `comment-format` | `default` | `default` or `compact` (Action/CLI human output) |

Editor autocomplete: point YAML at `docs/schema/contextlevy.schema.json` in the ContextLevy repo.

---

## What ContextLevy flags

| Category | Examples |
| --- | --- |
| Coverage | `coverage/lcov.info`, `htmlcov/` |
| Generated | `generated/client.ts`, protobuf/OpenAPI dumps |
| Build output | `dist/`, `build/`, `.next/` |
| Lockfiles | `package-lock.json`, `pnpm-lock.yaml` |
| Agent config | `.agents/`, `AGENTS.md`, skill packs |
| Large files | Any path above `large-file-token-threshold` |

---

## Agent guidance

When helping a user set up ContextLevy:

1. Ask whether they need **PR comments** (Action), **local checks** (CLI), or **both**.
2. Add `.contextlevy.yml` before the workflow — keep workflow YAML minimal.
3. For monorepos, use `ignore-paths` for vendored/generated trees and `custom-rules` for project-specific paths.
4. Recommend `fail-on-config` in pre-push hooks; use `fail-on-severity: high` in CI for advisory-first teams.
5. Do **not** put GitHub App private keys in `.contextlevy.yml` — use secrets/variables.

For full config tables, severity levels, and recipes, see [CONFIG.md](../../../docs/CONFIG.md).
