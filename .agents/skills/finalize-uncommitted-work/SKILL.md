---
name: finalize-uncommitted-work
description: Audits uncommitted changes, validates logic, runs tests/builds/lints, creates multiple conventional-commits (title only), bumps semver, updates CHANGELOG, tags, and pushes to GitHub. Use when the user asks to finalize, ship, release, or commit all uncommitted work, or mentions /finalize-uncommitted-work.
---

# Finalize Uncommitted Work

**Announce at start:** "I'm using the finalize-uncommitted-work skill."

End-to-end workflow: review → verify → split commits → release → push.

## Prerequisites

- Clean intent to ship: user invoked this skill or explicitly asked to commit, release, and push.
- Working tree has uncommitted changes (staged and/or unstaged).
- Remote access available (`git push`, `gh` if needed).

**Stop and ask** if: merge conflicts exist, detached HEAD with no branch, or push would require force to `main`/`master`.

## Phase 1: Audit

```bash
git status
git diff
git diff --cached
git log --oneline -10
```

For every changed file, determine:

| Question | Action if NO |
|----------|--------------|
| Belongs in this repo? | Exclude (secrets, `.env`, local tooling) |
| Matches surrounding conventions? | Fix before proceeding |
| Logically coherent with its group? | Split or reorder groups |
| Accidental/debug-only? | Revert that hunk |

Read enough surrounding code to confirm each change set makes sense — not just that it compiles.

## Phase 2: Verify

Apply **verification-before-completion**: run commands fresh, read full output, fix failures before any commit.

### Detect project commands

Search in order; run all that exist:

| Signal | Command |
|--------|---------|
| Root `package.json` `"test"` | `npm test` |
| Root `package.json` `"lint"` | `npm run lint` |
| Root `package.json` `"build"` | `npm run build` |
| `backend/pyproject.toml` or `pytest.ini` | `cd backend && pytest -q` |
| `frontend/package.json` | `cd frontend && npm test && npm run build` |
| `Cargo.toml` | `cargo test && cargo clippy && cargo build --release` |
| `Makefile` `test`/`lint`/`build` targets | `make test`, `make lint`, `make build` |
| `.github/workflows/*.yml` | Mirror CI steps locally |

**Gate:** All applicable checks exit 0. Do not commit until they do.

## Phase 3: Plan commits

Split into **multiple small commits** — never one monolithic commit.

### Grouping rules

1. **One logical change per commit** — a reviewer should understand the commit from its title alone.
2. **Separate by concern**: backend vs frontend vs docs vs CI vs tooling.
3. **Order commits** so history reads cleanly: refactors/chore first → fixes → features.
4. **Keep tests with the code they cover** unless the test commit is large enough to stand alone (`test(scope): …`).
5. **Never commit** secrets, credentials, `.env`, or unintended generated artifacts.

### Commit message format

**Title only. No body. No description paragraph.**

```
<type>(<scope>): <imperative summary>
```

| Type | Use for |
|------|---------|
| `feat` | New capability |
| `fix` | Bug fix |
| `refactor` | Behavior-preserving restructure |
| `test` | Tests only |
| `docs` | Documentation |
| `chore` | Tooling, deps, misc maintenance |
| `ci` | CI/CD pipeline |
| `perf` | Performance improvement |
| `style` | Formatting, no logic change |

- Scope is optional but preferred when area is clear (`feat(backend)`, `fix(frontend)`).
- Use `feat!` or `fix!` for breaking changes (no body — the `!` conveys breaking).
- Match recent repo style from `git log --oneline -15`.

```bash
git add <files-for-this-group>
git commit -m "feat(backend): add heatmap fallback when API times out"
```

Repeat for each group. After all commits:

```bash
git status   # must be clean
git log --oneline <base>..HEAD
```

## Phase 4: Semver bump

Analyze commits since the last git tag (or since last version in changelog if no tags).

### Bump rules

| Commits include | Bump |
|-----------------|------|
| `feat!`, `fix!`, or any breaking change | **MAJOR** (`X.0.0`) |
| `feat` (no breaking) | **MINOR** (`x.Y.0`) |
| `fix`, `perf` only | **PATCH** (`x.y.Z`) |
| Only `docs`, `chore`, `ci`, `style`, `test`, `refactor` | **PATCH** (or ask user if zero user-facing delta) |

Read current version from version files (see [reference.md](reference.md)), compute next version, update **every** version source in the repo consistently.

## Phase 5: Changelog

Follow [Keep a Changelog](https://keepachangelog.com/) if `CHANGELOG.md` exists; otherwise create one.

1. Move `[Unreleased]` content into a new `## [X.Y.Z] — YYYY-MM-DD` section.
2. Group entries: `### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Security` — omit empty sections.
3. Derive entries from the commits in Phase 3 (user-facing language, not raw commit titles).
4. Leave a fresh empty `## [Unreleased]` at the top.
5. Update compare links at the bottom (`[Unreleased]: …`, `[X.Y.Z]: …`).

Commit version + changelog together:

```bash
git add <version files> CHANGELOG.md
git commit -m "chore(release): vX.Y.Z"
```

## Phase 6: Tag and push

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin HEAD
git push origin vX.Y.Z
```

- Push the current branch, not a guessed name (`git push origin HEAD`).
- **Never** `git push --force` to `main` or `master`. If rejected, stop and report — do not force.
- Never skip hooks (`--no-verify`).
- Never update git config.

## Checklist

Copy and track:

```
Finalize progress:
- [ ] Phase 1: All changed files reviewed, junk excluded
- [ ] Phase 2: Tests, lint, build all pass (evidence captured)
- [ ] Phase 3: Multiple conventional commits created (title only, no bodies)
- [ ] Phase 4: Semver bump applied to all version files
- [ ] Phase 5: CHANGELOG updated
- [ ] Phase 6: Tag created, branch + tag pushed to GitHub
```

## Red flags

**Never:**
- One giant commit mixing unrelated changes
- Commit messages with bodies or multi-paragraph descriptions
- Claim tests pass without running them this session
- Bump version before verification passes
- Force-push to protected/default branch
- Commit secrets or `.env` files

**Always:**
- Multiple focused commits
- Conventional commit titles only
- Fresh verification before committing
- Consistent version across all version files
- Push both commits and annotated tag

## Additional resources

- Version file locations and monorepo patterns: [reference.md](reference.md)
