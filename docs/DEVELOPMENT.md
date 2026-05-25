# Development

ContextLevy is a Node.js project with a dual build: a bundled GitHub Action and a published npm CLI.

## Setup

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Run the full check suite (typecheck, tests, build):

```bash
npm run all
```

Run Biome lint and format checks:

```bash
npm run check
```

## Build

Build the action bundle and CLI:

```bash
npm run build          # both
npm run build:action   # GitHub Action only → dist/index.js
npm run build:cli      # local CLI only → lib/
```

Commit `dist/index.js` after building the action so workflow consumers do not need to install runtime dependencies. The CLI (`lib/`) is built automatically on `npm publish` via `prepack`.

Verify the npm tarball before publishing:

```bash
npm run pack:check
```

## Module layout

See [ARCHITECTURE.md](ARCHITECTURE.md) for the module map, dependency rules, and where to add new features.

## Releasing

Releases are automated when a version bump lands on `main`. The [release workflow](../.github/workflows/release.yml) detects a `package.json` version change, runs tests, verifies `dist/`, creates a GitHub Release, pushes the semver tag, publishes the CLI to npm via [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC), and updates the major tag.

**Do not push semver tags manually.** Bump the version in `package.json`, `package-lock.json`, and `CHANGELOG.md`, push to `main`, and CI handles the tag, GitHub Release, and npm publish.

On [npmjs.com](https://www.npmjs.com/package/contextlevy) → **Package settings** → **Trusted publishing**, configure **GitHub Actions** with repository `unloopedmido/contextlevy` and workflow filename `release.yml`. No `NPM_TOKEN` secret is required.

If npm publish fails after a version bump, re-run the **Release** workflow from the Actions tab (`workflow_dispatch`) once the package is missing on npm — it will retry without another version bump.

Example release sequence:

```bash
# After updating package.json, package-lock.json, and CHANGELOG.md
git push origin main
```

The workflow updates the major-version tag (`v2`) automatically.

### First npm publish (manual)

Before trusted publishing is configured, publish the CLI once from a clean checkout:

```bash
npm ci
npm run pack:check
npm publish --access public
```

Then add the trusted publisher on npmjs.com as described above. Later version bumps on `main` publish automatically via OIDC.

Consumers should usually pin:

```yaml
- uses: unloopedmido/contextlevy@v2
```

For maximum supply-chain safety, consumers can pin a full commit SHA.
