---
name: contextlevy
description: Set up and use the ContextLevy GitHub Action to estimate AI agent context cost on pull requests. Covers app install, workflow setup, PR comments, fail thresholds, and action outputs. Use when the user asks about ContextLevy on GitHub, PR context bloat, coverage/generated files in diffs, or installing the ContextLevy action.
metadata:
  author: unloopedmido
  version: "1.0.0"
---

# ContextLevy (GitHub Action)

ContextLevy estimates how much **net-new AI context** a diff adds — generated code, coverage, lockfiles, build output, agent config — and flags cleanup before it becomes repo debt.

**Privacy:** No LLM calls, no code upload, no external API. Runs locally in CI.

For local pre-push checks, use the [contextlevy-cli](../contextlevy-cli/SKILL.md) skill.

## Install skills

```bash
npx skills add unloopedmido/contextlevy
```

The wizard lets you pick `contextlevy` (this skill), `contextlevy-cli`, or both. To install only this skill: `--skill contextlevy`.

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

- Reads config from the **base branch** (a PR cannot silence the check by editing `contextlevy.config.yml` in the same diff).
- Posts a PR comment when estimated tokens exceed `token-threshold`.
- **Fail mode** (`fail-on-severity` or `fail-above-tokens` in config) fails the workflow even when the comment is skipped.
- Workflow YAML only needs auth inputs; all tuning lives in `contextlevy.config.yml`.

### Action outputs (for downstream steps)

| Output | Description |
| --- | --- |
| `total-estimated-tokens` | Total estimated net-new context tokens |
| `analyzed-file-count` | Changed files included in the estimate |
| `token-source` | Auth source: `app`, `github-token`, or `GITHUB_TOKEN` |
| `estimation-mode` | `simple` or `tokenizer` |

---

## Configuration

Add `contextlevy.config.yml` at the repo root (or see [CONFIG.md](../../../docs/CONFIG.md) for all supported paths).

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

For full config tables, severity levels, and recipes, see [reference.md](reference.md) and [CONFIG.md](../../../docs/CONFIG.md).

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

When helping a user set up ContextLevy on GitHub:

1. Confirm they need **PR comments** (Action), **local checks** ([contextlevy-cli](../contextlevy-cli/SKILL.md)), or **both**.
2. Add `contextlevy.config.yml` before the workflow — keep workflow YAML minimal.
3. For monorepos, use `ignore-paths` for vendored/generated trees and `custom-rules` for project-specific paths.
4. Recommend `fail-on-severity: high` in CI for advisory-first teams; pair with the CLI skill for pre-push hooks.
5. Do **not** put GitHub App private keys in `contextlevy.config.yml` — use secrets/variables.
