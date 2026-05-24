# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/unloopedmido/contextlevy/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/unloopedmido/contextlevy/compare/v1.3...v2.0.0
