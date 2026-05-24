# ContextLevy

Bundle-size checks, but for **AI agent context cost**.

ContextLevy is a GitHub Action that comments on pull requests when the diff likely increases coding-agent context overhead — generated code, coverage output, lockfiles, build artifacts, logs, snapshots, agent instruction files, and other bulky paths.

It does **not** call an LLM and does **not** send your code anywhere. Estimates are heuristic context-risk deltas, not exact billing.

## Quick start

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
        with:
          github-token: ${{ github.token }}
```

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `github-token` | `${{ github.token }}` | Token with `pull-requests: write` |
| `token-threshold` | `1000` | Skip commenting below this estimated token total |
| `large-file-token-threshold` | `5000` | Marks individual files as large context risks |
| `max-high-impact-items` | `5` | Max files listed under High impact |
| `cost-per-million-tokens` | `3` | USD/1M tokens for worst-case cost line |

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
