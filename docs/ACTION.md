# GitHub Action

ContextLevy runs as a GitHub Action on pull requests. The workflow YAML only needs authentication inputs; all behavior tuning lives in [`contextlevy.config.yml`](CONFIG.md).

## Quick start

Install the [ContextLevy GitHub App](https://github.com/apps/contextlevy) and add a workflow — see the [README quick start](../README.md#quick-start).

## Action inputs

The action accepts **authentication inputs only**. All behavior tuning belongs in the config file.

| Input | Default | Description |
| --- | --- | --- |
| `github-token` | `GITHUB_TOKEN` env | Fallback token for reading PR files and writing comments |
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

```yaml
- id: contextlevy
  uses: unloopedmido/contextlevy@v2

- if: ${{ steps.contextlevy.outputs.total-estimated-tokens > 50000 }}
  run: echo "Context cost too high"
```

## Job summary

ContextLevy also writes a **job summary** with risk level and top findings for every run — even when the PR comment is skipped or cannot be posted.

## Fork pull requests

For pull requests from forks, GitHub often provides a read-only workflow token. ContextLevy logs a warning, keeps the action successful, still exposes analysis outputs, and writes a job summary — but may not post a PR comment.

Install the [ContextLevy GitHub App](https://github.com/apps/contextlevy) when your organization policy allows it for more reliable fork PR comments.

See [SECURITY.md — Fork pull requests](../SECURITY.md#fork-pull-requests) for permission details and [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common fixes.
