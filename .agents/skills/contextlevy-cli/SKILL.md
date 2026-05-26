---
name: contextlevy-cli
description: Install and use the ContextLevy CLI for local AI context cost checks from git diffs. Covers npm install, diff commands, JSON output, exit codes, and pre-push hooks. Use when the user asks about contextlevy diff, pre-push context checks, local ContextLevy setup, or installing contextlevy via npm.
metadata:
  author: nonlooped
  version: "1.0.0"
---

# ContextLevy CLI

ContextLevy is a **repo hygiene linter for agent-heavy teams**. It flags diffs that will make coding-agent review noisy — generated output, coverage, build artifacts, lockfile churn, and agent instruction changes.

**Privacy:** No LLM calls, no code upload, no external API. Runs on your machine.

For PR comments in GitHub, use the [contextlevy](../contextlevy/SKILL.md) skill.

## Install skills

```bash
npx skills add nonlooped/contextlevy
```

The wizard lets you pick `contextlevy-cli` (this skill), `contextlevy`, or both. To install only this skill: `--skill contextlevy-cli`.

---

## Local CLI

### Install

```bash
npm install -g contextlevy
```

Requires Node.js 20+ and `git` on PATH.

### Common commands

```bash
# Start here (no config required)
npx contextlevy check --base main

# Scaffold config
npx contextlevy init

# Working tree vs main
contextlevy check --base main

# Staged changes only
contextlevy check --staged

# JSON for scripts / hooks
contextlevy check --base origin/main --format json

# Apply fail settings from contextlevy.config.yml
contextlevy check --base main --fail-on-config

# Strict category gate (dist/, coverage/, etc.)
contextlevy check --base main --strict
```

### Exit codes

| Code | Meaning |
| ---: | --- |
| `0` | Below fail thresholds |
| `1` | Fail threshold exceeded |
| `2` | Usage, config, or git error |

### CLI caveats

- Analyzes **tracked** changes visible to `git diff`. Stage new files with `git add`, or pass `--staged`.
- Reuses the same config file and estimation modes as the GitHub Action.

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

Add `contextlevy.config.yml` at the repo root (or see [CONFIG.md](../../../docs/CONFIG.md) for all supported paths).

Minimal example:

```yaml
mode: advisory
allow-paths:
  - "packages/api/src/generated/**"
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

For full config tables, severity levels, and recipes, see [reference.md](../contextlevy/reference.md) and [CONFIG.md](../../../docs/CONFIG.md).

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

When helping a user set up the ContextLevy CLI:

1. Ask whether they need **local checks** (CLI), **PR comments** ([contextlevy](../contextlevy/SKILL.md)), or **both**.
2. Add `contextlevy.config.yml` with `fail-on-severity` or `fail-above-tokens` when using `--fail-on-config`.
3. For monorepos, use `ignore-paths` for vendored/generated trees and `custom-rules` for project-specific paths.
4. Recommend `fail-on-config` in pre-push hooks; use `fail-on-severity: high` in CI for advisory-first teams.
