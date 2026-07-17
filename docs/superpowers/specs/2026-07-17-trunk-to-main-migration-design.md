# Design: Migrate Default Branch from `trunk` to `main`

**Date:** 2026-07-17
**Status:** Approved

## Background

The repository was set up with `trunk` as the default branch under a Trunk-Based Development model. As an open-source project with potential multiple major versions, TBD is not the right fit. Switching to `main` as the default branch aligns with standard open-source conventions and allows long-lived support branches (e.g. `v13`, `v14`) to coexist cleanly.

`master` exists as a remnant of the upstream `http-party/http-server` fork and is left untouched.

## Approach

File references are updated first (committed to a new `main` branch pushed from `trunk`), then GitHub repository settings are updated, and finally `trunk` is deleted. This order ensures no CI breakage during the transition.

## Phase 1 — File Changes

All changes are committed on a new local `main` branch (checked out from `trunk`) and pushed to origin before any settings are touched.

### `.github/workflows/node.js.yml`

Change branch filters:

```diff
 on:
   push:
-    branches: [ trunk ]
+    branches: [ main ]
   pull_request:
-    branches: [ trunk ]
+    branches: [ main ]
```

### `.github/workflows/dependency-review.yml`

Change branch filter:

```diff
 on:
   pull_request:
     branches:
-      - trunk
+      - main
```

### `README.md`

Update CI badge URL and raw image URL:

```diff
-[![GitHub Workflow Status (trunk)](https://img.shields.io/github/actions/workflow/status/pkg-nec/http-server/node.js.yml?branch=trunk&style=flat-square)](https://github.com/pkg-nec/http-server/actions)
+[![GitHub Workflow Status (main)](https://img.shields.io/github/actions/workflow/status/pkg-nec/http-server/node.js.yml?branch=main&style=flat-square)](https://github.com/pkg-nec/http-server/actions)

-![Example of running http-server](https://github.com/pkg-nec/http-server/raw/trunk/screenshots/public.png)
+![Example of running http-server](https://github.com/pkg-nec/http-server/raw/main/screenshots/public.png)
```

### `.github/CONTRIBUTING.md`

Update stale upstream reference to `master`:

```diff
-1. Your PR might become conflicted with the code in `master`. If this is the case, you will need to [update your PR](#up-to-date) and resolve your conflicts.
+1. Your PR might become conflicted with the code in `main`. If this is the case, you will need to [update your PR](#up-to-date) and resolve your conflicts.
```

### Historical plan docs (`docs/superpowers/plans/`)

Left as-is. These are past-tense archives that accurately reflect history at the time of writing. No functional impact.

## Phase 2 — Push `main` to Origin

```bash
git checkout trunk
git checkout -b main
# apply file edits above, then:
git add .github/workflows/node.js.yml \
        .github/workflows/dependency-review.yml \
        README.md \
        .github/CONTRIBUTING.md
git commit -m "chore: rename default branch from trunk to main"
git push origin main
```

## Phase 3 — GitHub Settings (apply in order)

| Step | Location | Action |
|------|----------|--------|
| 1 | Settings → General → Default branch | Switch from `trunk` → `main` |
| 2 | Settings → Branches → Branch protection rules | Delete the `trunk` rule; create an identical rule on `main` (required status checks: `Test (20.x, ubuntu-latest)`, no force-push, no deletion) |
| 3 | Settings → Environments → `npm-publish` | Update deployment branch policy from `trunk` → `main` |
| 4 | Terminal | `git push origin --delete trunk` |
| 5 | Terminal | `git branch -d trunk` |

## What Is Not Changed

- `master` branch: left untouched (upstream fork baseline)
- `origin/master` remote tracking branch: left untouched
- Historical plan docs under `docs/superpowers/plans/`: left as-is (archives)
- `publish.yml`: no branch filter — triggered on GitHub Release publication, unaffected
- `stale.yml`: no branch filter — triggered on schedule, unaffected
- `dependabot.yml`: no branch filter — Dependabot PRs target the default branch automatically, so switching the default branch is sufficient

## Success Criteria

- `main` is the default branch on GitHub
- CI runs on push to `main` and on PRs targeting `main`
- Dependency Review runs on PRs targeting `main`
- `npm-publish` environment gate applies to `main`
- `trunk` branch is deleted from both origin and local
- README badge and image resolve correctly from `main`
- `master` branch is unchanged
