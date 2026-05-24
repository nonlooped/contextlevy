# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.2.1] — 2026-05-25

### Fixed

- CLI `default` and `compact` output now use terminal styling with aligned tables instead of raw GitHub Markdown.
- npm package bin path and publish metadata for reliable local publishing.

## [2.2.0] — 2026-05-25

### Added

- Local `contextlevy` CLI with `diff` command for pre-PR context checks (`npm install -g contextlevy`).
- Public agent skill installable via `npx skills add unloopedmido/contextlevy --skill contextlevy`.
- Optional `estimation-mode: tokenizer` using local `cl100k_base` BPE counting (no network calls).
- Configurable `custom-rules` for project-specific path classification.
- Configurable `severity-thresholds` for risk level boundaries.
- JSON Schema for `.contextlevy.yml` editor autocomplete (`docs/schema/contextlevy.schema.json`).
- Action output `estimation-mode` and documented output types for downstream steps.
- GitHub Actions job summary with risk level and top findings.
- Automated release workflow on semver tag push with npm trusted publishing (OIDC).
- Test coverage enforcement in CI (≥70% lines/functions/statements).
- `docs/EXAMPLES.md` with benchmark table, monorepo recipes, and output examples.

### Changed

- npm package ships CLI only (`lib/`); Action deps moved to devDependencies (~21 KB tarball).
- Cost tables now show ±50% uncertainty ranges and clearer illustrative-pricing disclaimers.
- README adds before/after, audience table, CLI quick start, agent skill install, and fork PR guidance.
- SECURITY.md adds supported versions, minimum permissions, and fork PR behavior.
- COMPARISON.md adds `.gitattributes` diff-filter positioning.

## [2.1.0] — 2026-05-24

### Added

- Configurable `ignore-paths` and `allow-paths` glob patterns.
- Optional `fail-on-severity` and `fail-above-tokens` workflow failure modes.
- Expanded bloat classification (vendor, source maps, protobuf, OpenAPI, caches, test output, fixtures, binary assets).
- Tool-agnostic agent indexing suggestions in PR comments.
- CONTRIBUTING.md, CODE_OF_CONDUCT.md, issue/PR templates, and docs/COMPARISON.md.

### Changed

- README quick start is app-first; self-hosted GitHub App setup moved to CONTRIBUTING.md.

## [2.0.1] — 2026-05-24

### Changed

- Package contents are now explicitly allowlisted and npm publishing is disabled.
- Vitest and transitive dependencies were updated, with an `undici` override to avoid known vulnerable versions.

### Fixed

- Pull request analysis now reads ContextLevy config from the base branch so PRs cannot silence checks by changing config in the same diff.
- Comment write permission failures now warn instead of failing the workflow, with GitHub App runs retrying a distinct `GITHUB_TOKEN` fallback when available.
- PR comment Markdown now escapes filenames, labels, and pricing profile names before rendering tables.
- Config numeric fields now reject non-finite values and fractional integer settings.
- Dogfood coverage fixtures are no longer hidden by `.gitignore`.

### Removed

- Deprecated v1 pricing aliases and the obsolete v1 implementation plan.

### Security

- Added a security reporting policy.

## [2.0.0] — 2026-05-24

### Added

- Repository config file support (`.contextlevy.yml`, `.github/contextlevy.yml`, and related paths).
- Compact PR comment format (`comment-format: compact`).
- Redesigned default PR comment with risk table and multi-model cost estimates.
- Classification for `.agents/` instruction paths.
- MIT license.
- PR comment example screenshot in README.
- Dogfood fixtures under `examples/high-impact-pr/` for testing high-impact diffs.

### Changed

- **Breaking:** analysis and comment options are configured via a repo config file only; action inputs for `token-threshold`, `pricing-profiles`, `comment-format`, and related settings were removed.
- Default pricing profiles aligned with README model list.
- README rewritten for config-file-only setup; quick start examples use `@v2`.
- Comment upsert now paginates through all issue comments when finding an existing marker.

### Fixed

- GitHub App credential errors now reference `CONTEXTLEVY_APP_ID`.
- Dogfood workflow grants `issues: write` for PR comment creation.
- `dist/` bundle is tracked consistently (removed from `.gitignore`).

[Unreleased]: https://github.com/unloopedmido/contextlevy/compare/v2.2.1...HEAD
[2.2.1]: https://github.com/unloopedmido/contextlevy/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/unloopedmido/contextlevy/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/unloopedmido/contextlevy/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/unloopedmido/contextlevy/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/unloopedmido/contextlevy/compare/v1.3...v2.0.0
