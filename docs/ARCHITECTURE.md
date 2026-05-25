# Architecture

ContextLevy estimates AI context cost from git diffs. The same analysis pipeline powers both the GitHub Action and the local CLI.

## Pipeline

```
diff → analyze → severity → format → output
```

1. **Diff** — Collect changed files and patches (GitHub PR API or local `git diff`).
2. **Analyze** — Estimate tokens per file, apply path rules, filter ignored paths.
3. **Severity** — Aggregate totals, count high-impact files, assign Low/Medium/High/Critical.
4. **Format** — Render PR comment, job summary, or CLI output (`default`, `compact`, `json`).
5. **Output** — Post comment, write job summary, set action outputs, or print to terminal.

Fail checks (`fail-on-severity`, `fail-above-tokens`) run after analysis regardless of whether a comment is posted.

## Module map

| Module | Responsibility | Key files |
| --- | --- | --- |
| `core/` | Analysis, rules, tokens, severity, categories, summary, comment gate, types, defaults | `analyze.ts`, `rules.ts`, `tokens.ts`, `severity.ts`, `categories.ts`, `summary.ts`, `comment-gate.ts`, `defaults.ts`, `fail.ts`, `paths.ts`, `pricing.ts`, `indexing.ts`, `types.ts` |
| `config/` | Config discovery, parsing, resolved settings | `types.ts`, `parse.ts`, `load.ts`, `settings.ts` |
| `format/` | Shared format helpers, PR comments, terminal output | `shared.ts`, `comment.ts`, `terminal.ts` |
| `github/` | Action orchestration, auth, PR I/O, job summary | `run.ts`, `auth.ts`, `files.ts`, `comments.ts`, `config-loader.ts`, `summary.ts` |
| `cli/` | CLI entrypoint, args, init scaffold, orchestration | `index.ts`, `args.ts`, `init.ts`, `run.ts`, `format.ts` |
| `git/` | Local git diff helpers | `diff.ts` |

Entry points:

- **GitHub Action:** `src/index.ts` → `github/run.ts` (bundled to `dist/index.js` via ncc)
- **CLI:** `src/cli/index.ts` (compiled to `lib/cli/index.js` via tsc)

## Dependency rules

- **`core/`** has no imports from `format/`, `github/`, or `cli/`.
- **`config/`** imports from `core/` for domain types and defaults (e.g. pricing profiles).
- **`format/`** imports from `core/` and `config/settings` for analysis results and thresholds.
- **`github/`** and **`cli/`** are thin orchestration layers — they wire config, diff sources, analysis, formatting, and output.
- **`git/`** is used by the CLI only; the Action reads patches from the GitHub API.

This keeps analysis logic testable without GitHub Actions or terminal dependencies.

## Dual build

| Target | Command | Output | Used by |
| --- | --- | --- | --- |
| GitHub Action | `npm run build:action` | `dist/index.js` (ncc bundle) | Workflow consumers |
| npm CLI | `npm run build:cli` | `lib/` (tsc) | `npm install -g contextlevy` |

The Action bundle inlines runtime dependencies so workflows need no `npm install`. The CLI ships a smaller compiled tree and is rebuilt on `npm publish` via `prepack`.

Commit `dist/index.js` when changing Action code. Do not commit `lib/` — it is generated at publish time.

## Where to add X

| Change | Location |
| --- | --- |
| New path classification rule | `core/rules.ts` |
| New config key | `config/parse.ts` + `config/settings.ts` + `docs/schema/contextlevy.schema.json` |
| Severity / risk level logic | `core/severity.ts`, `core/fail.ts` |
| PR comment layout | `format/comment.ts` |
| Terminal output layout | `format/terminal.ts` |
| Shared token/cost formatting | `format/shared.ts` |
| Job summary content | `github/summary.ts` |
| CLI flag or output format | `cli/args.ts`, `cli/format.ts` |
| GitHub auth or PR fetching | `github/auth.ts`, `github/files.ts`, `github/comments.ts` |
| Local git diff behavior | `git/diff.ts` |
| Token estimation algorithm | `core/tokens.ts` |

After changing Action code, run `npm run build:action` and commit `dist/index.js`.
