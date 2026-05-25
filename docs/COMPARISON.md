# How ContextLevy compares

ContextLevy is a **repo hygiene linter for agent-heavy teams**. It scans pull request diffs, classifies risky files, and leaves a focused PR comment before review noise becomes permanent repo debt.

Unlike tools that optimize a single coding session, ContextLevy guards what enters the repository through pull requests — with no LLM calls, no code upload, and no external analysis service.

## At a glance

| Tool | What it measures | When it runs | Blocks merge? | LLM calls? |
| --- | --- | --- | --- | --- |
| **ContextLevy** | AI context tokens from PR diff | PR CI | Optional (`fail-on-severity`) | No |
| **Bundlewatch / size-limit** | JS bundle bytes | CI | Optional | No |
| **[forjd/ctx](https://github.com/forjd/ctx)** | Local context packs for agents | Local CLI | No | No |
| **`.gitignore` only** | Nothing automatic | Never | No | No |
| **Manual review** | Human judgment | PR review | Sometimes | No |

## vs bundle tools (Bundlewatch, size-limit)

Bundle tools measure **JavaScript bundle size in kilobytes** — a runtime and delivery concern for end users. ContextLevy measures **estimated AI context tokens from PR diffs** — a developer-experience concern for coding agents.

They solve different problems:

- A PR can pass every bundle-size gate while still adding `coverage/lcov.info`, generated clients, or lockfile churn that makes every future agent session slower and noisier.
- A PR can shrink bundle size while adding large agent instruction dumps or vendored artifacts that agents over-read.

Use both when you care about user-facing bundle weight **and** agent-facing context weight. ContextLevy does not replace bundle checks; it complements them on a different resource axis.

## vs ctx (forjd/ctx)

[ctx](https://github.com/forjd/ctx) builds **task-specific context packs locally** so agents start a session with the right files. ContextLevy runs in **PR CI** and flags diffs that would permanently bloat the repository for every future session.

They are complementary, not competing:

- **ctx** optimizes what an agent reads *right now* on a developer machine.
- **ContextLevy** guards what gets merged into the repo so the next ctx run — and every other agent session — does not inherit avoidable noise.

A team can use ctx for local workflow ergonomics and ContextLevy to keep the shared codebase lean.

## vs agent hooks, memory, and session tools

Cursor hooks, agent memory, compaction, and similar tools optimize **individual sessions**: what to load, what to remember, what to trim mid-conversation.

ContextLevy operates at the **repository level**. It prevents context debt from landing in `main` in the first place — generated output, coverage artifacts, build folders, snapshot churn, and other files that session tools cannot undo once they are committed and indexed.

Session tools make agents smarter per chat. ContextLevy keeps the repo from making every chat harder.

## When to use ContextLevy

ContextLevy pays off most in:

- **Agent-heavy repositories** where most feature work happens with AI-assisted editing and large diffs directly affect session cost and quality.
- **Teams that commit generated or coverage artifacts** — whether accidentally or by convention — and need a consistent PR signal before those files become normalized repo noise.
- **Monorepos and dependency PRs** where lockfile churn or vendored output can dominate a diff without affecting runtime bundle size.
- **Repos adopting agent instruction files** (`.agents/`, `AGENTS.md`, skill packs) where silent behavior changes deserve review alongside code.

ContextLevy does not block merges by default. It comments with severity, file classifications, and cleanup suggestions. Teams that want a hard gate can enable `fail-on-severity` or `fail-above-tokens` in [`contextlevy.config.yml`](CONFIG.md).

## vs `.gitattributes` diff filters

Some teams use `.gitattributes` with `-diff` or custom diff drivers to hide generated files from `git diff` output. That reduces human review noise but does **not** remove files from the repository or from agent indexing.

ContextLevy complements `.gitattributes` by:

- Flagging when large generated files are still committed and indexed
- Estimating token cost from PR API patches (independent of local diff settings)
- Surfacing cleanup suggestions in the PR thread for reviewers who may not have local diff filters configured

Use both when generated files must stay in git but should not dominate agent context.

## Get started

Install the [ContextLevy GitHub App](https://github.com/apps/contextlevy) on your repository, add the workflow from the [README quick start](../README.md#quick-start), and tune thresholds in [CONFIG.md](CONFIG.md).
