# Contributing to ContextLevy

Thank you for your interest in ContextLevy. This guide covers normal usage, local development, and pull request expectations.

## For users

To use ContextLevy in your repository:

1. Install the [ContextLevy GitHub App](https://github.com/apps/contextlevy) on your repository.
2. Add the workflow from [README.md](README.md#quick-start).

Do **not** create your own GitHub App for normal use. The published app is the supported path for posting PR comments with proper attribution and permissions.

## For contributors

ContextLevy is a Node.js GitHub Action. To work on the codebase locally:

```bash
npm install
npm test
npm run build
```

If you change files under `src/`, rebuild and commit `dist/index.js`. Consumers run the compiled action and do not need to install runtime dependencies at use time.

See [README.md — Development](README.md#development) for the same commands in project context.

## Self-hosted GitHub App (maintainers and contributors only)

Creating a separate GitHub App is **only** for maintainers and contributors who need to test app authentication locally or in a private fork. End users should use the published app linked above.

If you run a self-hosted app for development:

| Type | Name | Value |
| --- | --- | --- |
| Repository variable | `CONTEXTLEVY_APP_ID` | Your numeric GitHub App ID |
| Repository secret | `CONTEXTLEVY_APP_PRIVATE_KEY` | The app private key PEM |

Grant the app these repository permissions:

| Permission | Access |
| --- | --- |
| Contents | Read |
| Pull requests | Read & write |
| Issues | Read & write |

Do **not** use the OAuth Client ID or Client Secret. ContextLevy needs the numeric GitHub App ID and the generated private key PEM.

Optional override: `CONTEXTLEVY_APP_INSTALLATION_ID`.

## Pull requests

Before opening a PR:

- Run `npm test` and confirm all tests pass.
- Run `npm run build` if you changed `src/`, and include updated `dist/index.js`.
- Add a [CHANGELOG.md](CHANGELOG.md) entry for user-facing changes (new behavior, config keys, comment output, auth, or workflow compatibility).

Keep changes focused. Match existing code style and keep workflow YAML examples aligned with [README.md](README.md).

For security issues, use [GitHub Security Advisories](https://github.com/unloopedmido/contextlevy/security/advisories/new) instead of a public issue.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
