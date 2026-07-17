# Trunk-to-Main Branch Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the default branch of `pkg-nec/http-server` from `trunk` to `main`, update all file references, apply GitHub settings changes, and delete the `trunk` branch — with zero CI breakage at any point.

**Architecture:** File changes are committed to a new `main` branch (created from the current `trunk` tip) and pushed to origin first. GitHub repository settings are then updated in a fixed order. `trunk` is deleted last, after `main` is confirmed as default.

**Tech Stack:** git, GitHub web UI (Settings), GitHub CLI optional for verification.

## Global Constraints

- `master` branch must not be touched at any point.
- No history rewriting — no `--force` pushes.
- All file edits land in a single commit on `main` before any settings change.
- Settings must be applied in the order listed in Task 2 (dependency chain).

---

### Task 1: Update file references and push `main`

**Files:**
- Modify: `.github/workflows/node.js.yml` (lines 8, 10)
- Modify: `.github/workflows/dependency-review.yml` (line 14)
- Modify: `README.md` (lines 1, 11)
- Modify: `.github/CONTRIBUTING.md` (line 44)

**Interfaces:**
- Consumes: current `trunk` HEAD
- Produces: `origin/main` branch at the same commit tree as current `trunk` HEAD, plus one new commit with the file changes.

- [ ] **Step 1: Create `main` from `trunk`**

```bash
git checkout trunk
git checkout -b main
```

Expected: `Switched to a new branch 'main'`

- [ ] **Step 2: Edit `.github/workflows/node.js.yml`**

Open `.github/workflows/node.js.yml`. Change lines 8 and 10:

```yaml
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
```

- [ ] **Step 3: Edit `.github/workflows/dependency-review.yml`**

Open `.github/workflows/dependency-review.yml`. Change line 14:

```yaml
on:
  pull_request:
    branches:
      - main
```

- [ ] **Step 4: Edit `README.md`**

Change line 1 (CI badge):

```markdown
[![GitHub Workflow Status (main)](https://img.shields.io/github/actions/workflow/status/pkg-nec/http-server/node.js.yml?branch=main&style=flat-square)](https://github.com/pkg-nec/http-server/actions)
```

Change line 11 (raw image URL):

```markdown
![Example of running http-server](https://github.com/pkg-nec/http-server/raw/main/screenshots/public.png)
```

- [ ] **Step 5: Edit `.github/CONTRIBUTING.md`**

Change line 44 (replace stale reference to `master` with `main`):

```markdown
1. Your PR might become conflicted with the code in `main`. If this is the case, you will need to [update your PR](#up-to-date) and resolve your conflicts.
```

- [ ] **Step 6: Verify only the expected files are changed**

```bash
git diff --name-only
```

Expected output (exactly these four files, no others):

```
.github/CONTRIBUTING.md
.github/workflows/dependency-review.yml
.github/workflows/node.js.yml
README.md
```

- [ ] **Step 7: Verify the content changes look correct**

```bash
git diff
```

Check: all four `trunk` → `main` replacements are present, no unintended lines changed.

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/node.js.yml \
        .github/workflows/dependency-review.yml \
        README.md \
        .github/CONTRIBUTING.md
git commit -m "chore: rename default branch from trunk to main"
```

Expected: `[main <sha>] chore: rename default branch from trunk to main` with `4 files changed`.

- [ ] **Step 9: Push `main` to origin**

```bash
git push origin main
```

Expected: `Branch 'main' set up to track remote branch 'main' from 'origin'.`

- [ ] **Step 10: Verify `main` exists on origin**

```bash
git branch -r | grep main
```

Expected: `  origin/main`

---

### Task 2: Apply GitHub Settings (in order)

**Files:** None — all changes are in GitHub web UI.

**Interfaces:**
- Consumes: `origin/main` from Task 1
- Produces: `main` as default branch, branch protection on `main`, npm-publish environment updated, `trunk` deleted from origin and local.

- [ ] **Step 1: Set `main` as default branch**

In GitHub: **Settings → General → Default branch**
Click the ↔ icon next to `trunk`, select `main`, click **Update**, confirm.

Verify: visiting `https://github.com/pkg-nec/http-server` shows `main` as the selected branch in the branch dropdown.

- [ ] **Step 2: Recreate branch protection rule on `main`**

In GitHub: **Settings → Branches → Branch protection rules**

First, delete the existing `trunk` rule: click **Edit** on the `trunk` rule → scroll to bottom → **Delete rule** → confirm.

Then click **Add rule** and configure:
- Branch name pattern: `main`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
  - Required check: `Test (20.x, ubuntu-latest)` (search and add it)
  - ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings
- ✅ Restrict who can push to matching branches (if previously set — match the old rule)
- Do **not** allow force pushes
- Do **not** allow deletions

Click **Create**.

Verify: the new `main` protection rule appears in the list.

- [ ] **Step 3: Update `npm-publish` environment branch policy**

In GitHub: **Settings → Environments → npm-publish**

Under **Deployment branches and tags**, find the branch rule referencing `trunk` and update it to `main`. Save.

Verify: the deployment branch policy shows `main` (not `trunk`).

- [ ] **Step 4: Delete `trunk` from origin**

```bash
git push origin --delete trunk
```

Expected: `- [deleted]         trunk`

- [ ] **Step 5: Delete local `trunk` branch**

```bash
git branch -d trunk
```

Expected: `Deleted branch trunk (was <sha>).`

- [ ] **Step 6: Final verification**

```bash
git branch -a
```

Expected: `trunk` does NOT appear in either local or remote branches. `main` and `master` are present.

```bash
git remote show origin | grep "HEAD branch"
```

Expected: `HEAD branch: main`

Check the CI badge in README renders correctly by visiting the GitHub repo page — the badge should show the `main` branch build status.
