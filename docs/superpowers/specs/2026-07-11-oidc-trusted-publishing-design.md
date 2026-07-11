# Design: OIDC trusted publishing for `@pkg-nec/http-server`

**Status:** approved
**Date:** 2026-07-11
**Author:** Hardy Nguyen (maw.signup@gmail.com)

## Context

The `14.1.1-pkgnec.0` handshake was published by hand from a laptop logged into an npm account with rights on the `@pkg-nec` org. This works but has two costs going forward: the publish credential lives on developer machines (rotation, offboarding, laptop loss all become supply-chain events), and every future release requires a human at that specific machine. Both were called out in the handshake plan as "trusted-publishing OIDC workflow — deferred to a follow-up spec before 14.1.2."

This spec is that follow-up. Once it lands, every future release of `@pkg-nec/http-server` is published from GitHub Actions using short-lived OIDC tokens, with no long-lived npm credentials anywhere and with signed provenance attestations on every published tarball.

This spec covers the setup only. Its first end-to-end exercise happens in a follow-up canary spec that publishes `14.1.1-pkgnec.1` (a no-op version bump) purely to prove the wiring works, before the workflow is depended on for `14.1.2`'s vulnerability release.

## Goal

Establish OIDC-based trusted publishing between `pkg-nec/http-server` (GitHub) and `@pkg-nec/http-server` (npm), gated on GitHub Release publication and a manual environment approval. After this spec lands, publishing a new release requires:

1. Push a `v*` tag from `trunk`.
2. Create a GitHub Release from that tag (`gh release create` or the UI).
3. Approve the paused `npm-publish` job in the Actions UI.
4. Workflow runs `npm publish --provenance` using an OIDC token; tarball ships with a signed provenance attestation viewable on the package's npm page.

No `NPM_TOKEN` secret exists anywhere in the pipeline.

## Definition of done

1. On `npmjs.com`, `@pkg-nec/http-server` has a Trusted Publisher configured with:
   - Organization: `pkg-nec`, Repository: `http-server`, Workflow: `publish.yml`, Environment: `npm-publish`.
2. On GitHub, `pkg-nec/http-server` has an Environment `npm-publish` with required reviewer `maw629` and deployment restricted to protected branches (i.e. `trunk`).
3. `.github/workflows/publish.yml` exists on `trunk`, matches the shape in Section 3 of this spec, passes YAML parse, and its `id-token: write` permission and `environment: npm-publish` binding are in place.
4. `package.json` `publishConfig` on `trunk` contains `"provenance": true` alongside the existing `"access": "public"`.
5. Nothing in this release actually publishes anything — that verification lives in the canary spec.

## Non-goals

- Publishing anything. This spec only wires the plumbing; the canary spec fires it end-to-end.
- Any change to `.github/workflows/node.js.yml` (test CI). That workflow keeps its own trigger and matrix.
- Any change to `lib/`, `bin/`, `public/` — same iron rule as the handshake.
- Any `NPM_TOKEN` secret configuration. Trusted publishing replaces it; the goal is that no such secret exists.
- Alternative trigger designs (tag-push, workflow-dispatch). Decided during brainstorming: trigger is GitHub Release publication.

## Work items

### 1. Register Trusted Publisher on npm (out-of-tree, one-time)

On `npmjs.com`, logged in as an account with admin rights on the `@pkg-nec` org:

1. Navigate to `@pkg-nec/http-server` → **Settings → Trusted Publisher**.
2. **Add publisher → GitHub Actions.**
3. Fill in exactly:
   - Organization or user: `pkg-nec`
   - Repository: `http-server`
   - Workflow filename: `publish.yml`
   - Environment name: `npm-publish`
4. Save.

All four fields must match the workflow's context at publish time or the OIDC handshake fails with `npm ERR! code E401`. The `publish.yml` filename and the `npm-publish` environment name are what Section 3 and Section 4 land in the repo, so they must be spelled identically across all three surfaces.

### 2. Create GitHub Environment (out-of-tree, one-time)

In `pkg-nec/http-server` → **Settings → Environments → New environment**:

1. **Name:** `npm-publish`.
2. **Required reviewers:** add `maw629`. Save.
3. **Deployment branches and tags:** select "Selected branches and tags" and add TWO rules:
   - Ref type "Branch", pattern `trunk` — for any workflow invocation from `trunk` itself.
   - Ref type "Tag", pattern `v*.*.*` — required because release-triggered workflow runs use the tag ref (`refs/tags/v14.1.2`), NOT the branch. Without this rule, the first publish fails with a "ref not allowed to deploy to this environment" error. Restricting to `v*.*.*` (three dot-separated components after `v`) blocks a non-conforming tag like `hotfix` from ever reaching this environment.
4. **Environment secrets:** none. Do NOT add `NPM_TOKEN`; the entire point of OIDC is not needing one.

The environment's manual-approval behavior is automatic once "Required reviewers" is set — any job that declares `environment: npm-publish` in its YAML pauses on entry and waits for the reviewer to approve.

### 3. Workflow file — `.github/workflows/publish.yml` (in-tree)

Add a new workflow with this exact shape:

```yaml
name: Publish to npm

on:
  release:
    types: [published]

permissions:
  contents: read
  id-token: write   # required to mint an OIDC token for npm

jobs:
  publish:
    name: npm publish
    runs-on: ubuntu-latest
    environment: npm-publish   # binds this job to the approval-gated env
    steps:
      - name: Checkout the tagged commit
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.release.tag_name }}

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 16.x
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies (honor lockfile)
        run: npm ci

      - name: Sanity-check tag matches package.json version
        run: |
          TAG="${{ github.event.release.tag_name }}"
          PKG_VERSION="v$(node -p "require('./package.json').version")"
          if [ "$TAG" != "$PKG_VERSION" ]; then
            echo "Tag ${TAG} does not match package.json version ${PKG_VERSION}" >&2
            exit 1
          fi

      - name: Publish
        run: npm publish --provenance
```

Notes on each choice:

- `on: release: types: [published]` fires only when a Release is *published* — a draft Release does not fire this. Reduces "accidental release" risk.
- `permissions.id-token: write` is what lets GitHub Actions mint the OIDC JWT for this job. Without it, `npm publish` would fall back to token auth and fail (no token is configured).
- `environment: npm-publish` is the belt-and-suspenders manual approval. Removing this line silently removes the approval requirement — call that out in the future if anyone edits this file.
- Checkout `ref: ${{ github.event.release.tag_name }}` builds the tarball from the exact tagged commit, not from `HEAD` of the branch the workflow happened to be triggered on. Prevents "the tag pointed at commit X but the workflow published commit Y" mismatches.
- Node 16.x matches the baseline used in `node.js.yml` after the handshake's CI unstick. When the test-CI matrix widens (during `14.1.2`'s tap upgrade), the publish workflow's Node version does NOT need to widen with it — one supported LTS is enough to build the tarball.
- `npm ci` (not `npm install`) — honors the lockfile, fails on drift.
- Tag-vs-package.json version sanity check catches "I tagged v14.1.2 but forgot to bump the version in package.json" before shipping an inconsistent artifact.
- `npm publish --provenance` opts into signed provenance attestations. Because Section 4 also sets `publishConfig.provenance: true`, the `--provenance` flag is redundant here — kept for explicitness so someone editing this file can't accidentally turn off provenance by removing the flag without also removing the config.
- No `--access public`, no `--tag latest`. `publishConfig.access` covers the first; for the second, `14.1.2` will be a stable version (not a prerelease), so `latest` is npm's default and does not need to be forced.

### 4. `package.json` `publishConfig.provenance: true` (in-tree)

Amend the existing `publishConfig` block from:

```json
"publishConfig": {
  "access": "public"
}
```

to:

```json
"publishConfig": {
  "access": "public",
  "provenance": true
}
```

Two-line change. No other fields touched.

Why here as well as in the workflow: `publishConfig.provenance` makes provenance the *default* behavior of `npm publish` for this package. If someone in the future runs `npm publish` outside the workflow (e.g. from a laptop with OIDC in scope, or with a fine-grained token), they still get provenance without having to remember the flag.

## Verification

End-to-end verification of the full trust chain (npm ↔ GitHub Environment ↔ workflow) happens in the follow-up canary spec, which publishes `14.1.1-pkgnec.1`. Verification for *this* spec is limited to what can be checked before the workflow fires for real:

1. `gh api /repos/pkg-nec/http-server/environments/npm-publish` returns 200 with `reviewers` populated.
2. `gh api /repos/pkg-nec/http-server/environments/npm-publish/deployment-branch-policies` includes `trunk`.
3. `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/publish.yml'))"` prints nothing (successful parse).
4. `node -e "const p = require('./package.json'); console.log(p.publishConfig.provenance)"` prints `true`.
5. Trusted Publisher configuration on npm's UI shows the four fields correctly (`Organization = pkg-nec`, `Repository = http-server`, `Workflow = publish.yml`, `Environment = npm-publish`). npm's CLI does not currently expose Trusted Publisher config; UI verification is the only channel.

## Risks & mitigations

- **Trusted Publisher field mismatch.** Any typo in Section 1's four fields (workflow filename, environment name, org, repo) breaks the publish with `E401` at the OIDC handshake step. Verify against the actual values in `.github/workflows/publish.yml` and the environment name string before saving.
- **`id-token: write` missing from workflow.** Without it, `npm publish` falls back to token auth and fails. Explicitly listed in Section 3; called out in the risks section here so a future edit that touches `permissions:` doesn't accidentally drop it.
- **Environment approval bypass.** If someone edits the workflow to remove the `environment: npm-publish` line, the approval gate silently disappears. Mitigation: this spec calls it out, and future PRs touching `publish.yml` should be treated as high-risk in code review. A CODEOWNERS entry on `.github/workflows/publish.yml` requiring your review would formalize this; add if solo-maintainer status changes.
- **Deployment-branch policy circumvention.** If Section 2's "Selected branches and tags" restriction is not set, any ref could theoretically request the environment and (with approval) publish from unmerged code. Mitigation: enforce the `trunk` branch + `v*.*.*` tag pair in the environment settings; verified via `gh api` in the Verification section.
- **Deployment-branch policy too tight.** Symmetric risk to the above — if the tag pattern is omitted, release-triggered runs (which use tag refs) can't reach the environment and every publish fails with a "ref not allowed" error at the environment-gate step. Verify the tag rule is present after Section 2 by inspecting the environment's UI or `gh api /repos/pkg-nec/http-server/environments/npm-publish/deployment-branch-policies`.
- **Provenance requires public repo.** `pkg-nec/http-server` is public. If the repo were made private, provenance publishing would fail — flag this in any future privacy discussion.
- **Node 16 EOL.** The publish workflow uses Node 16, which was EOL in 2023. This is fine for the current constrained scope (identical to test CI, works with `tap@14`). When `14.1.2` upgrades `tap`, the publish workflow can move to a current LTS (Node 20+) independently of the test matrix. Not this spec's problem.

## Rollback

If the OIDC setup misbehaves after landing:

- **Delete the Trusted Publisher** on npm (Settings → Trusted Publisher → Remove). Publishing reverts to token-based; you can still `npm publish` by hand as before.
- **Delete the environment or the workflow file** to stop future automated publishes. Neither is destructive to already-published versions.
- Nothing in this spec touches published tarballs or existing versions.
