# GitHub Action

ContextLevy runs as a GitHub Action on pull requests. The workflow YAML only needs authentication inputs; all behavior tuning lives in [`contextlevy.config.yml`](CONFIG.md).

## Quick start

Install the [ContextLevy GitHub App](https://github.com/apps/contextlevy) and add a workflow — see the [README quick start](../README.md#quick-start).

## Action inputs

The action accepts authentication and reporting inputs. Behavior tuning belongs in the config file.

| Input | Default | Description |
| --- | --- | --- |
| `github-token` | `GITHUB_TOKEN` env | Fallback token for reading PR files and writing comments |
| `create-check` | `true` | Publish a GitHub Check Run named **ContextLevy** (`checks: write`) |
| `upload-sarif` | `true` | Upload SARIF for Code Scanning annotations (`security-events: write`) |
| `app-client-id` | `CONTEXTLEVY_APP_ID` / `CONTEXTLEVY_APP_CLIENT_ID` env | Numeric GitHub App ID |
| `app-private-key` | `CONTEXTLEVY_APP_PRIVATE_KEY` env | GitHub App private key PEM |
| `app-installation-id` | `CONTEXTLEVY_APP_INSTALLATION_ID` env | Optional GitHub App installation ID override |

Auth credentials should stay in GitHub secrets or variables. Do not put private keys in `contextlevy.config.yml`.

## Action outputs

Use these in downstream workflow steps:

| Output | Type | Example | Description |
| --- | --- | --- | --- |
| `total-estimated-tokens` | integer string | `"37891"` | Total estimated net-new context tokens |
| `analyzed-file-count` | integer string | `"12"` | Changed files included in the estimate |
| `token-source` | string | `"app"` | Auth source: `app`, `github-token`, or `GITHUB_TOKEN` |
| `estimation-mode` | string | `"simple"` | Estimation mode used: `simple` or `tokenizer` |
| `risk-level` | string | `"High"` | Aggregated PR context risk |
| `check-conclusion` | string | `"neutral"` | GitHub Check Run conclusion |
| `badge-url` | string | shields.io URL | Badge image URL for PR/README |
| `badge-markdown` | string | `![Context risk](...)` | Ready-to-paste badge markdown |
| `sarif-path` | string | `contextlevy-results.sarif.json` | Generated SARIF file path |
| `sarif-uploaded` | string | `"true"` | Whether SARIF upload succeeded |

```yaml
- id: contextlevy
  uses: nonlooped/contextlevy@v2

- if: ${{ steps.contextlevy.outputs.total-estimated-tokens > 50000 }}
  run: echo "Context cost too high"
```

## Check Run and SARIF

When `create-check` is enabled, ContextLevy publishes a **Check Run** named `ContextLevy`. Require it in branch protection for merge gating.

When `upload-sarif` is enabled, ContextLevy uploads a SARIF report to **Code Scanning** and writes `contextlevy-results.sarif.json` to the workspace. Fork PRs or missing permissions produce a warning; analysis still completes.

Recommended workflow permissions:

```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
  checks: write
  security-events: write
```

## Job summary

ContextLevy also writes a **job summary** with risk level and top findings for every run — even when the PR comment is skipped or cannot be posted.

## PR badges

Use action outputs in a follow-up step or README:

```yaml
- id: contextlevy
  uses: nonlooped/contextlevy@v2

- run: echo "${{ steps.contextlevy.outputs.badge-markdown }}"
```

For repo-level debt badges locally:

```bash
contextlevy scan --format json > .contextlevy/scan.json
contextlevy badge --style debt --input .contextlevy/scan.json
```

## Fork pull requests

For pull requests from forks, GitHub often provides a read-only workflow token. ContextLevy logs a warning, keeps the action successful, still exposes analysis outputs, and writes a job summary — but may not post a PR comment.

Install the [ContextLevy GitHub App](https://github.com/apps/contextlevy) when your organization policy allows it for more reliable fork PR comments.

See [SECURITY.md — Fork pull requests](../SECURITY.md#fork-pull-requests) for permission details and [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common fixes.
