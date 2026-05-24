# ContextLevy

Bundle-size checks, but for **AI agent context cost**.

ContextLevy is a GitHub Action that comments on pull requests when the diff likely increases coding-agent context overhead — generated code, coverage output, lockfiles, build artifacts, logs, snapshots, agent instruction files, and other bulky paths.

It does **not** call an LLM and does **not** send your code anywhere. Estimates are heuristic context-risk deltas, not exact billing.

## Quick start

### Recommended: ContextLevy GitHub App

Install the ContextLevy GitHub App on your repository, then add:

- Repository variable: `CONTEXTLEVY_APP_CLIENT_ID` — set this to your **numeric GitHub App ID** (not the OAuth Client ID)
- Repository secret: `CONTEXTLEVY_APP_PRIVATE_KEY` (PEM private key)

```yaml
name: ContextLevy
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  contextlevy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: unloopedmido/contextlevy@v1
        env:
          CONTEXTLEVY_APP_CLIENT_ID: ${{ vars.CONTEXTLEVY_APP_CLIENT_ID }}
          CONTEXTLEVY_APP_PRIVATE_KEY: ${{ secrets.CONTEXTLEVY_APP_PRIVATE_KEY }}
          GITHUB_TOKEN: ${{ github.token }}
        with:
          github-token: ${{ github.token }}
```

When app credentials are present, ContextLevy mints an installation token for the current repository automatically.

Grant the GitHub App these repository permissions:

| Permission | Access |
|------------|--------|
| Pull requests | Read & write |
| Issues | Read & write |
| Contents | Read |

After changing app permissions, accept the updated installation request on the repository.

### Fallback: `GITHUB_TOKEN`

If app credentials are not configured, ContextLevy falls back to `github-token` or the workflow `GITHUB_TOKEN`:

```yaml
- uses: unloopedmido/contextlevy@v1
  with:
    github-token: ${{ github.token }}
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `app-client-id` | `CONTEXTLEVY_APP_ID` / `CONTEXTLEVY_APP_CLIENT_ID` env | Numeric GitHub App ID |
| `app-private-key` | `CONTEXTLEVY_APP_PRIVATE_KEY` env | ContextLevy GitHub App private key PEM |
| `app-installation-id` | `CONTEXTLEVY_APP_INSTALLATION_ID` env | Optional installation ID override |
| `github-token` | `GITHUB_TOKEN` env | Fallback token with `pull-requests: write` |
| `token-threshold` | `1000` | Skip commenting below this estimated token total |
| `large-file-token-threshold` | `5000` | Marks individual files as large context risks |
| `max-high-impact-items` | `5` | Max files listed in the context table |
| `show-cost-table` | `true` | Include the pricing cost table in the PR comment |
| `pricing-profiles` | built-in defaults | JSON array of pricing profiles for the cost table |

`model-pricing` is still accepted as a deprecated alias for `pricing-profiles`.

### Default pricing profiles

When `pricing-profiles` is omitted, ContextLevy estimates worst-case input cost for:

| Pricing profile | Default input cost / 1M tokens |
|-----------------|-------------------------------:|
| GPT-5.5 | $2.90 |
| Opus 4.7 | $8.00 |
| Gemini 3.1 Pro | $1.50 |
| Kimi K2.6 | $0.40 |

Hide the cost table:

```yaml
- uses: unloopedmido/contextlevy@v1
  with:
    show-cost-table: 'false'
```

Override pricing profiles:

```yaml
- uses: unloopedmido/contextlevy@v1
  with:
    pricing-profiles: |
      [
        { "name": "Local 70B", "inputCostPerMillion": 0.2 },
        { "name": "Team Gateway", "inputCostPerMillion": 1.75 }
      ]
```

## How estimation works

1. List files changed in the PR via the GitHub Pull Request Files API.
2. Count **added** diff characters from each patch (`+` lines).
3. Convert to estimated tokens with `ceil(chars / 4)`.
4. If no patch is available, fall back to `additions × 10`.
5. Classify paths with lightweight rules (generated, coverage, lockfile, etc.).

Different models tokenize differently, and agents may not read every file. Treat the output as guidance.

## Development

```bash
npm install
npm test
npm run build
```

Commit `dist/index.js` after building so consumers do not install runtime dependencies.

## License

MIT
