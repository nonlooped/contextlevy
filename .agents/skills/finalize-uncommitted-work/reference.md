# Finalize Uncommitted Work — Reference

## Version file locations

Update **all** of these that exist in the repo:

| File | Field |
|------|-------|
| `package.json` (root) | `"version"` |
| `frontend/package.json`, `backend/package.json`, etc. | `"version"` |
| `backend/pyproject.toml` | `version = "…"` under `[project]` |
| `Cargo.toml` | `version = "…"` under `[package]` |
| `VERSION` | plain text `X.Y.Z` |
| `pyproject.toml` (root) | `version = "…"` |

Monorepos often pin the same semver in root + workspace packages — keep them identical.

## Finding the current version

```bash
# Latest git tag
git describe --tags --abbrev=0 2>/dev/null

# Or read from files
node -p "require('./package.json').version" 2>/dev/null
grep '^version' backend/pyproject.toml 2>/dev/null
```

If tags and files disagree, prefer the **highest** semver and note the discrepancy to the user before bumping.

## Semver examples

Current `1.2.3`:

| New commits | Next version |
|-------------|--------------|
| `fix(api): handle null project id` | `1.2.4` |
| `feat(ui): add clip trim slider` | `1.3.0` |
| `feat!: remove legacy /v1 endpoints` | `2.0.0` |
| `docs: update README` only | `1.2.4` (patch) or skip bump — ask user |

Pre-release suffixes (`1.3.0-beta.1`) only when the user explicitly requests pre-release tagging.

## Changelog entry mapping

| Commit type | Changelog section |
|-------------|-------------------|
| `feat` | ### Added (or ### Changed if modifying existing behavior) |
| `fix` | ### Fixed |
| `perf` | ### Changed |
| Security-related `fix` | ### Security |
| `feat!` / breaking | ### Changed + note breaking, or ### Removed |

Write user-facing bullets, not commit hashes:

```markdown
## [1.3.0] — 2026-05-24

### Added
- Clip trim slider on the project detail page for per-song start/duration editing.

### Fixed
- YouTube URL parser now rejects playlist-only links without a video ID.
```

## Commit grouping examples

**Good — three commits from one session:**

```
fix(backend): reject playlist-only YouTube URLs
test(backend): add cases for malformed YouTube URLs
ci: run security regression tests on every push
```

**Bad — one commit:**

```
fix: various backend and CI updates
```

**Bad — message with body:**

```
fix(backend): reject invalid YouTube URLs

Added validation for playlist URLs and updated tests.
Also fixed CI workflow.
```

Use separate commits instead of a body.

## Suggested commit order

1. `refactor`, `chore` (non-release)
2. `ci`, `build` tooling
3. `fix`
4. `feat`
5. `test` (if not bundled with fix/feat)
6. `docs`
7. `chore(release): vX.Y.Z` last

## CI discovery

Read `.github/workflows/*.yml` for the canonical verify commands. Example mapping:

```yaml
# backend job → cd backend && pip install -r requirements-dev.txt && pytest -q
# frontend job → cd frontend && npm ci && npm test && npm run build
```

Run equivalent commands locally before committing.

## Push troubleshooting

| Error | Action |
|-------|--------|
| `rejected (non-fast-forward)` on feature branch | `git pull --rebase origin <branch>`, re-run verify, push again |
| rejected on `main`/`master` | Stop — report; never force push |
| tag already exists | Bump was wrong or tag exists remotely — investigate before force-pushing tag |
| no upstream | `git push -u origin HEAD` |
