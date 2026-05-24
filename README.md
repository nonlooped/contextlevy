<p align="center">
  <img src=".github/assets/Cover.png" alt="ContextLevy">
</p>

<p align="center">
  <strong>Bundle-size checks, but for AI agent context cost.</strong>
</p>

<p align="center">
  ContextLevy comments on pull requests when a diff is likely to make coding agents slower, more expensive, or noisier to use.
</p>

<p align="center">
  <a href="https://github.com/unloopedmido/contextlevy/actions/workflows/ci.yml">
    <img alt="CI" src="https://img.shields.io/github/actions/workflow/status/unloopedmido/contextlevy/ci.yml?branch=main&label=CI">
  </a>
  <a href="https://github.com/unloopedmido/contextlevy/releases">
    <img alt="Latest release" src="https://img.shields.io/github/v/release/unloopedmido/contextlevy?label=release">
  </a>
  <a href="https://github.com/unloopedmido/contextlevy/blob/main/LICENSE">
    <img alt="License" src="https://img.shields.io/github/license/unloopedmido/contextlevy">
  </a>
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen">
  <img alt="No LLM calls" src="https://img.shields.io/badge/LLM%20calls-none-blue">
</p>

---

## Why ContextLevy?

AI coding agents are powerful, but they are also extremely sensitive to noisy repository context.

A single pull request can accidentally add:

- generated clients
- coverage reports
- build output
- lockfile churn
- snapshots
- huge logs
- vendored files
- agent instruction dumps
- compiled bundles

That may not break your app, but it can absolutely bloat every future AI-assisted coding session.

**ContextLevy catches that before it becomes repo debt.**

It scans pull request diffs, estimates added context weight, classifies risky files, and leaves a focused PR comment explaining what changed and what to clean up.

See [docs/COMPARISON.md](docs/COMPARISON.md) for how ContextLevy compares to bundle tools, [ctx](https://github.com/forjd/ctx), and agent session tools.

![ContextLevy PR comment example](.github/assets/PR-Example.png)

## What it catches

| Risk            | Examples                                            | Why it matters                                         |
| --------------- | --------------------------------------------------- | ------------------------------------------------------ |
| Generated code  | `generated/client.ts`, `schema.graphql`, SDK output | Often huge, repetitive, and better regenerated locally |
| Coverage output | `coverage/lcov.info`, `htmlcov/`                    | High token cost with almost zero agent value           |
| Build artifacts | `dist/`, `build/`, `.next/`, compiled bundles       | Frequently duplicated from source                      |
| Logs and dumps  | `*.log`, traces, debug output                       | Noisy context that agents over-read                    |
| Lockfile churn  | `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`  | Can dominate diffs in dependency PRs                   |
| Snapshots       | `__snapshots__/`, large fixture files               | Useful sometimes, expensive always                     |
| Agent files     | `.agents/`, `AGENTS.md`, instruction packs          | Can silently steer future agent behavior               |

## Privacy model

ContextLevy is intentionally boring:

* **No LLM calls**
* **No code upload**
* **No external analysis service**
* **No telemetry required**

It only uses GitHub pull request metadata and diff patches available inside the workflow.

Token and cost numbers are estimates, not billing-grade accounting.

## Quick start

### 1. Install the ContextLevy GitHub App

Install the [ContextLevy GitHub App](https://github.com/apps/contextlevy) on your repository.

Grant these repository permissions when prompted:

| Permission    |       Access |
| ------------- | -----------: |
| Contents      |         Read |
| Pull requests | Read & write |
| Issues        | Read & write |

The published app posts PR comments with its own identity. You do **not** need to add app credentials as repository secrets or variables.

After changing app permissions, accept the updated installation request on the repository.

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

That is the full setup. ContextLevy reads your PR diff, estimates context weight, and comments when thresholds are exceeded.

> **Maintainers and contributors only:** To test with a self-hosted GitHub App in a private fork, see [CONTRIBUTING.md — Self-hosted GitHub App](CONTRIBUTING.md#self-hosted-github-app-maintainers-and-contributors-only) for `CONTEXTLEVY_APP_ID` and `CONTEXTLEVY_APP_PRIVATE_KEY` setup. End users should use the published app linked above.

## Configuration

ContextLevy reads all analysis and comment options from a config file in the repository. Add a config file once — workflow YAML stays minimal.

On pull requests, ContextLevy reads configuration from the base branch version of the repository. A PR cannot silence the check by changing `.contextlevy.yml` in the same diff.

Supported config paths, in priority order:

1. `.contextlevy.yml`
2. `.contextlevy.yaml`
3. `.contextlevy.json`
4. `.github/contextlevy.yml`
5. `.github/contextlevy.yaml`
6. `.github/contextlevy.json`
7. `contextlevy.yml`
8. `contextlevy.yaml`
9. `contextlevy.json`

If no config file is found, ContextLevy uses built-in defaults.

Example `.contextlevy.yml`:

```yaml
token-threshold: 1000
large-file-token-threshold: 5000
max-high-impact-items: 5
show-cost-table: true
comment-format: default

ignore-paths:
  - vendor/**
  - "**/*.map"

fail-on-severity: high

pricing-profiles:
  - name: GPT-5.5
    inputCostPerMillion: 5.0
  - name: Opus 4.7
    inputCostPerMillion: 5.0
  - name: Team Gateway
    inputCostPerMillion: 1.75
```

Keys support both kebab-case and camelCase:

```yaml
token-threshold: 1000
```

```yaml
tokenThreshold: 1000
```

### Config options

| Key | Default | Description |
| --- | --- | --- |
| `token-threshold` | `1000` | Skip commenting below this estimated token total |
| `large-file-token-threshold` | `5000` | Mark individual files as large context risks |
| `max-high-impact-items` | `5` | Max files shown in the high-impact table |
| `show-cost-table` | `true` | Include estimated model input costs |
| `comment-format` | `default` | `default` or `compact` |
| `ignore-paths` | `[]` | Glob patterns excluded from analysis entirely |
| `allow-paths` | `[]` | Glob patterns counted but not flagged as high-impact |
| `fail-on-severity` | unset | Fail workflow at `low` / `medium` / `high` / `critical` or above |
| `fail-above-tokens` | unset | Fail workflow when estimated tokens exceed this value |
| `pricing-profiles` | built-in defaults | Array of `{ name, inputCostPerMillion }` objects |

When `fail-on-severity` or `fail-above-tokens` is set, ContextLevy fails the workflow if thresholds are exceeded. **Fail mode runs even when the PR comment is skipped** — for example, when estimated tokens are below `token-threshold`. Analysis and fail checks always run; `token-threshold` only controls whether a comment is posted.

## Action inputs

The action accepts **authentication inputs only**. All behavior tuning belongs in the config file.

| Input | Default | Description |
| --- | --- | --- |
| `github-token` | `GITHUB_TOKEN` env | Fallback token for reading PR files and writing comments |
| `app-client-id` | `CONTEXTLEVY_APP_ID` / `CONTEXTLEVY_APP_CLIENT_ID` env | Numeric GitHub App ID |
| `app-private-key` | `CONTEXTLEVY_APP_PRIVATE_KEY` env | GitHub App private key PEM |
| `app-installation-id` | `CONTEXTLEVY_APP_INSTALLATION_ID` env | Optional GitHub App installation ID override |

Auth credentials should stay in GitHub secrets or variables. Do not put private keys in `.contextlevy.yml`.

## Comment formats

### Default

Best for most repositories.

Includes:

* severity
* estimated token delta
* high-impact files
* file classifications
* optional cost table
* cleanup suggestions

```yaml
comment-format: default
```

### Compact

Best for busy repos that want a smaller PR footprint.

Usually 3–4 lines:

```yaml
comment-format: compact
```

Example:

```txt
🤖 ContextLevy · ⚠️ High · ~42.1k tokens
+31.4k coverage/lcov.info · +8.2k dist/index.js · +2.5k generated/client.ts
~$0.02–$0.12/session est. input · Add coverage/ and dist/ to .gitignore
```

## Default pricing profiles

When `pricing-profiles` is omitted, ContextLevy estimates worst-case input cost using:

| Profile        | Input cost / 1M tokens |
| -------------- | ---------------------: |
| GPT-5.5        |                `$5.00` |
| Opus 4.7       |                `$5.00` |
| Gemini 3.1 Pro |                `$2.00` |
| Kimi K2.6      |                `$0.95` |

Hide the cost table in your config file:

```yaml
show-cost-table: false
```

Override pricing profiles:

```yaml
pricing-profiles:
  - name: Local 70B
    inputCostPerMillion: 0.2
  - name: Team Gateway
    inputCostPerMillion: 1.75
```

## How estimation works

ContextLevy uses a simple, transparent heuristic:

1. List files changed in the pull request.
2. Read added diff lines from each patch.
3. Count added characters.
4. Estimate tokens with `ceil(chars / 4)`.
5. If no patch is available, fall back to `additions × 10`.
6. Classify risky paths with lightweight rules.

This is intentionally approximate.

Different models tokenize differently, agents may not read every changed file, and cached-token pricing varies by provider. Treat the output as a practical warning signal, not an invoice.

## Severity levels

| Severity   | Meaning                                          |
| ---------- | ------------------------------------------------ |
| `Low`      | Small context increase, usually safe             |
| `Medium`   | Worth reviewing, especially in agent-heavy repos |
| `High`     | Likely to affect AI coding sessions              |
| `Critical` | Very large diff or obvious repo-noise artifact   |

## Common recipes

### Only comment on large context changes

```yaml
token-threshold: 5000
```

### Show fewer files in the PR comment

```yaml
max-high-impact-items: 3
```

### Use compact comments

```yaml
comment-format: compact
```

### Disable model cost estimates

```yaml
show-cost-table: false
```

### Use your own model pricing

```yaml
pricing-profiles:
  - name: Internal Gateway
    inputCostPerMillion: 1.25
  - name: Local Inference
    inputCostPerMillion: 0.05
```

## Good files to ignore

ContextLevy is most useful when paired with normal repository hygiene.

Common `.gitignore` additions:

```gitignore
coverage/
htmlcov/
dist/
build/
.next/
.cache/
*.log
```

Generated files may still belong in version control depending on your language, package manager, or deployment setup. ContextLevy does not block PRs by default; it gives reviewers a focused warning.

## Troubleshooting

### `Resource not accessible by integration`

Your workflow token or GitHub App probably does not have enough permissions to create or update PR comments.

Check:

```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
```

If you use the GitHub App, confirm the installation has:

* Contents: read
* Pull requests: read & write
* Issues: read & write

For pull requests from forks, GitHub may still provide a read-only workflow token. In that case ContextLevy logs a warning, keeps the action successful, and still exposes analysis outputs.

### `CONTEXTLEVY_APP_PRIVATE_KEY` is invalid

Make sure the secret contains the GitHub App private key PEM.

It should look like this:

```txt
-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----
```

Do not use the app Client Secret.

### The comment did not appear

ContextLevy skips comments below `token-threshold`. Fail mode (`fail-on-severity`, `fail-above-tokens`) still runs in that case — a skipped comment does not mean the check was skipped.

Lower the threshold while testing:

```yaml
token-threshold: 0
```

### The estimate looks too high

That usually means the PR added large generated files, coverage output, build artifacts, or lockfile churn.

If the files are intentional, either ignore the warning or raise your thresholds.

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Build the action:

```bash
npm run build
```

Commit `dist/index.js` after building so consumers do not need to install runtime dependencies.

## Releasing

Tag stable releases with semantic versions:

```bash
git tag v2.0.0
git push origin v2.0.0
```

Use major-version tags for GitHub Action consumers:

```bash
git tag -f v2 v2.0.0
git push origin v2 --force
```

Consumers should usually pin:

```yaml
- uses: unloopedmido/contextlevy@v2
```

For maximum supply-chain safety, consumers can pin a full commit SHA.

## Security

ContextLevy is a pull request analysis tool. It does not execute changed code and does not send repository contents to an LLM or third-party API.

Please report security issues privately through GitHub Security Advisories instead of opening a public issue.

## License

MIT
