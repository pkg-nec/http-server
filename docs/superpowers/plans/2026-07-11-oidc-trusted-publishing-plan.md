# OIDC Trusted Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire OIDC-based trusted publishing between `pkg-nec/http-server` (GitHub) and `@pkg-nec/http-server` (npm) so future releases publish from GitHub Actions with no long-lived `NPM_TOKEN` secret, gated on GitHub Release publication plus a manual environment approval.

**Architecture:** Two in-tree changes (a `.github/workflows/publish.yml` workflow file, and one field in `package.json`'s `publishConfig`) plus two out-of-tree one-time configurations (npm-side Trusted Publisher registration, GitHub-side Environment with reviewer and branch/tag policy). Live end-to-end verification is deferred to a follow-up canary spec (`14.1.1-pkgnec.1`).

**Tech Stack:** GitHub Actions, `actions/setup-node@v4`, `actions/checkout@v4`, npm 9+ (client-side OIDC publish), Node.js 16.x (matches CI baseline).

## Global Constraints

- **Working branch:** `chore/oidc-trusted-publishing` (already checked out). Do not commit to any other branch.
- **Merge target:** `trunk`. Branch protection requires PR + green `Test (16.x, ubuntu-latest)` check.
- **Trusted Publisher fields (exact spelling, must match across three surfaces — npm UI, GitHub Environment name, workflow YAML):**
  - Organization or user: `pkg-nec`
  - Repository: `http-server`
  - Workflow filename: `publish.yml`
  - Environment name: `npm-publish`
- **Environment deployment policy:** MUST include BOTH a `Branch` rule pattern `trunk` AND a `Tag` rule pattern `v*.*.*`. Release-triggered workflows run against the tag ref, so the tag rule is what actually admits publishes; the branch rule guards against ad-hoc `workflow_dispatch`-style paths in the future.
- **No `NPM_TOKEN` secret** anywhere — not in repo secrets, not in the `npm-publish` environment. The plumbing is deliberately token-less.
- **No changes** to `.github/workflows/node.js.yml` (the existing test CI), `lib/`, `bin/`, `public/`, `dependencies`, `devDependencies`, `package-lock.json`, or `engines.node`.
- **`files` field** in `package.json` stays `["lib", "bin", "doc"]` — do not add or remove entries.
- **Node version in the publish workflow:** `16.x`, matching `node.js.yml`'s current baseline. Bumping this is a `14.1.2`-and-later concern paired with the `tap` upgrade.
- **Live verification is out of scope for this plan.** No tarball actually gets published here; the canary spec's job is to prove the trust chain end-to-end.
- **Reference commit:** `f8eb5ae` = `trunk` at PR #1 merge, i.e. the state of the world when this branch was created.

---

### Task 1: Add `publishConfig.provenance: true` to `package.json`

**Files:**
- Modify: `package.json:115-117`

**Interfaces:**
- Consumes: nothing.
- Produces: a `package.json` whose `publishConfig` block reads `{ "access": "public", "provenance": true }` and is otherwise byte-identical to base.

- [ ] **Step 1: Make the edit**

Locate the existing `publishConfig` block (currently at lines 115–117):

```json
  "publishConfig": {
    "access": "public"
  },
```

Change it to:

```json
  "publishConfig": {
    "access": "public",
    "provenance": true
  },
```

Add a comma after `"public"`. Add the new key. Do not reorder or reformat anything else in the file.

- [ ] **Step 2: Verify the field parses correctly**

```bash
node -e "const p = require('./package.json'); console.log(p.publishConfig.provenance)"
# → true

node -e "const p = require('./package.json'); console.log(p.publishConfig.access)"
# → public
```

Both must print exactly as shown.

- [ ] **Step 3: Verify no unrelated fields drifted**

```bash
git diff f8eb5ae HEAD -- package.json | grep -E '^[+-]\s*"(dependencies|devDependencies|scripts|files|bin|man|main|license|preferGlobal|keywords|description|engines|contributors|name|version|repository|bugs|homepage)"'
```

Expected: no output. Only the `publishConfig` block should be diffed.

- [ ] **Step 4: Verify JSON validity end-to-end**

```bash
node -e "JSON.parse(require('fs').readFileSync('./package.json', 'utf8')); console.log('ok')"
# → ok
```

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "chore: enable provenance attestations in publishConfig"
```

---

### Task 2: Create the `publish.yml` workflow

**Files:**
- Create: `.github/workflows/publish.yml`

**Interfaces:**
- Consumes: Task 1's `publishConfig.provenance: true` (means `--provenance` on the CLI is redundant but the workflow keeps it explicit for defense-in-depth).
- Produces: a workflow that fires on `release: published`, is gated on the `npm-publish` GitHub Environment, checks out the exact tagged commit, verifies the tag matches `package.json`'s version, and runs `npm publish --provenance`. Requires the npm-side Trusted Publisher and the GitHub Environment (Tasks 4 and 5) to exist before it can actually publish anything — but the file can land safely without them because no release is published as part of this plan.

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/publish.yml` with EXACTLY this content:

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

Notes for the implementer:
- Do NOT add `--access public` to the publish step — that's covered by `package.json`'s `publishConfig.access` and duplicating it in the CLI is redundant.
- Do NOT add `--tag latest` — releases in this plan's scope will be stable versions, and `latest` is npm's default dist-tag for stable versions.
- Do NOT add `env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` or similar. There is no token; OIDC replaces it.
- Do NOT delete or reformat the comments — they document non-obvious `permissions:` and `environment:` requirements.

- [ ] **Step 2: Verify YAML parses**

Try `js-yaml` first (may not be installed in devDependencies; that's fine):

```bash
node -e "const yaml = require('js-yaml'); yaml.load(require('fs').readFileSync('.github/workflows/publish.yml', 'utf8')); console.log('ok')"
```

If it errors with `Cannot find module 'js-yaml'`, use Python's PyYAML:

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/publish.yml')); print('ok')"
```

Expected: `ok`.

- [ ] **Step 3: Verify critical fields are present**

```bash
grep -E "^\s*id-token: write(\s|$|#)" .github/workflows/publish.yml
grep -E "^\s*environment: npm-publish(\s|$|#)" .github/workflows/publish.yml
grep -F 'ref: ${{ github.event.release.tag_name }}' .github/workflows/publish.yml
grep -F 'npm publish --provenance' .github/workflows/publish.yml
```

Each grep must return at least one line. The `id-token` and `environment` lines carry trailing inline comments (`# ...`); the character class after each token accepts a trailing comment or end-of-line. The `ref:` and `npm publish` lines use `grep -F` (fixed-string) so they don't need escaping of `${{ ... }}`. If any grep returns zero lines, the workflow file is missing a critical setting — do not proceed.

- [ ] **Step 4: Verify workflow does NOT reference any secret**

```bash
grep -E "NPM_TOKEN|secrets\\." .github/workflows/publish.yml
```

Expected: no output. Any hit means a secret leaked into the workflow file — remove it before committing (the entire point of OIDC is not needing secrets here).

- [ ] **Step 5: Verify the existing test workflow is untouched**

```bash
git diff f8eb5ae HEAD -- .github/workflows/node.js.yml .github/workflows/release-drafter.yml .github/workflows/stale.yml
```

Expected: no output. This plan only ADDS `publish.yml`; it does not modify any existing workflow file.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: add OIDC-based publish workflow gated on npm-publish environment"
```

---

### Task 3: Remove `release-drafter` (workflow + config)

**Files:**
- Delete: `.github/workflows/release-drafter.yml`
- Delete: `.github/release-drafter.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: a repository whose only automated response to merges into `trunk` is the test workflow. No automated release-note drafting; no auto-generated draft releases.

**Why:** `release-drafter` auto-drafts a Release with a semver-labels-driven version number on every push to `trunk`. Its versioning model (bump major/minor/patch by PR label) is incompatible with this fork's lineage (`14.1.x-pkgnec.y` inherited from upstream), so it consistently produces wrong-versioned draft releases — the merge of PR #1 created a `v0.1.0` draft, disconnected from the actually-published `v14.1.1-pkgnec.0`. More importantly, this drafted release is now a live footgun against the OIDC publish workflow landing in Tasks 1–2: publishing the wrong-versioned draft via the UI would trigger `publish.yml`, which would (correctly) fail its tag-vs-`package.json` sanity check but only after entering the environment gate. Releases in this repo will be hand-authored per publish; automated notes can be reintroduced later in a fresh PR if the release cadence ever grows.

The mis-versioned draft release (`v0.1.0`) has already been deleted from the repo via `gh release delete v0.1.0 --yes` at plan authoring time; only the workflow file and config file remain to clean up.

- [ ] **Step 1: Delete both files**

```bash
git rm .github/workflows/release-drafter.yml
git rm .github/release-drafter.yml
```

Expected: both files removed and staged.

- [ ] **Step 2: Verify no other file references them**

```bash
grep -rn "release-drafter" .github/ docs/ 2>/dev/null
```

Expected: no output. (There may be historical references in older spec/plan text — if any hit is in a documentation file, verify it's contextual, not an active reference, and leave it. Active references would be workflow includes or config file imports; there should be none.)

- [ ] **Step 3: Verify the workflow directory contents are as expected**

```bash
ls .github/workflows/
# expected exactly:
# node.js.yml
# stale.yml
```

Note that `publish.yml` from Task 2 will only show up if Tasks 1–2 have already landed. If they have, expect three files (`node.js.yml`, `publish.yml`, `stale.yml`).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove release-drafter (workflow + config)"
```

Post-plan cleanup notes for the reviewer (no action required in this task): the auto-drafted `v0.1.0` release was deleted before this branch's PR was opened. If — while this PR sits open — anyone opens a new PR against `trunk` and merges it, `release-drafter` (still on `trunk`) will fire and create yet another wrong-versioned draft. That draft should also be deleted after merge if it exists. This is a one-time race window.

---

### Task 4: Local sanity, push branch, open PR

**Files:** none modified.

**Interfaces:**
- Consumes: Tasks 1, 2, and 3 committed on `chore/oidc-trusted-publishing`.
- Produces: a pushed branch on `origin` with an open PR against `trunk` and green CI.

- [ ] **Step 1: Clean install to confirm the lockfile still applies**

```bash
rm -rf node_modules
npm ci
```

Expected: completes without lockfile drift. `npm test` is NOT run here — it's known broken pre-existing (see the handshake plan's global constraints) and the test signal comes from CI on the PR.

- [ ] **Step 2: Confirm the branch's full diff vs. `trunk`**

```bash
git log --oneline trunk..HEAD
git diff --stat trunk..HEAD
```

Expected commits (in order, six total; the first three exist already on the branch when this plan starts, the last three land during Tasks 1, 2, and 3):
- `cf37be7` `docs: add design spec for OIDC trusted publishing to npm`
- `5900c0f` `docs: scrub author line in handshake spec`
- `<plan commit>` `docs: add implementation plan for OIDC trusted publishing` (this file)
- `<Task 1 SHA>` `chore: enable provenance attestations in publishConfig`
- `<Task 2 SHA>` `ci: add OIDC-based publish workflow gated on npm-publish environment`
- `<Task 3 SHA>` `chore: remove release-drafter (workflow + config)`

Files changed:
- `docs/superpowers/specs/2026-07-11-oidc-trusted-publishing-design.md` (created)
- `docs/superpowers/specs/2026-07-11-14.1.1-pkgnec.0-identity-handshake-design.md` (1 line changed)
- `docs/superpowers/plans/2026-07-11-oidc-trusted-publishing-plan.md` (created)
- `package.json` (publishConfig: +1 line)
- `.github/workflows/publish.yml` (created)
- `.github/workflows/release-drafter.yml` (deleted)
- `.github/release-drafter.yml` (deleted)

If any file OUTSIDE this list appears in `git diff --stat`, investigate before pushing.

- [ ] **Step 3: Push the branch**

```bash
git push -u origin chore/oidc-trusted-publishing
```

- [ ] **Step 4: Open PR against `trunk`**

```bash
gh pr create --base trunk --head chore/oidc-trusted-publishing \
  --title "ci: wire OIDC trusted publishing to npm" \
  --body "$(cat <<'EOF'
Implements docs/superpowers/specs/2026-07-11-oidc-trusted-publishing-design.md.

## What changed
- `.github/workflows/publish.yml`: new workflow, fires on `release: published`, runs against the `npm-publish` GitHub Environment, checks out the tagged commit, sanity-checks tag ↔ `package.json` version, and runs `npm publish --provenance` using an OIDC token (no `NPM_TOKEN` secret).
- `package.json`: `publishConfig.provenance: true` added alongside the existing `"access": "public"`. Makes provenance the default publish behavior for this package.
- `.github/workflows/release-drafter.yml` + `.github/release-drafter.yml`: deleted. Its semver-labels model doesn't match this fork's `14.1.x-pkgnec.y` lineage and it consistently produces wrong-versioned draft releases. Its wrong-versioned draft `v0.1.0` was deleted at plan authoring time. Releases for this repo will be hand-authored per publish; automation can return in a fresh PR if the release cadence ever grows.
- `docs/superpowers/specs/2026-07-11-oidc-trusted-publishing-design.md`: the design spec this PR implements.
- `docs/superpowers/specs/2026-07-11-14.1.1-pkgnec.0-identity-handshake-design.md`: author line scrubbed to use the personal email address (one-line change).

## What did NOT change
- lib/, bin/, public/, dependencies, devDependencies, package-lock.json, engines.node.
- The existing test CI workflow (`node.js.yml`) — same trigger, same matrix, same actions.
- No `NPM_TOKEN` secret is added or referenced anywhere.

## Out-of-tree setup required BEFORE the workflow can actually publish
These are separate follow-up tasks (see the plan, Tasks 4 and 5). This PR is safe to merge without them because no release is published as part of this PR — the workflow only fires on `release: published`, which is a deliberate later act.
1. Register a Trusted Publisher on npmjs.com for `@pkg-nec/http-server` with Organization=pkg-nec, Repository=http-server, Workflow=publish.yml, Environment=npm-publish.
2. Create a GitHub Actions Environment `npm-publish` with reviewer `maw629` and deployment rules `Branch: trunk` + `Tag: v*.*.*`.

## Live verification
Deferred to a follow-up canary release (`14.1.1-pkgnec.1`, a no-op version bump) which exists purely to prove the trust chain end-to-end before `14.1.2` depends on it.
EOF
)"
```

- [ ] **Step 5: Wait for CI to go green**

```bash
gh pr checks --watch
```

Expected: the single `Test (16.x, ubuntu-latest)` check goes green. If it fails, investigate — this branch introduces no code changes to `lib/`, so a failure would be either infrastructure decay (as in the handshake's Task 6 addendum) or a broken lockfile edit. Fix on the branch and re-run Step 1.

---

### Task 5: Register Trusted Publisher on npmjs.com (out-of-tree, user action)

**Files:** none. Manual configuration on `npmjs.com`.

**Interfaces:**
- Consumes: nothing in-repo.
- Produces: a Trusted Publisher record on npm's side that admits OIDC handshakes from `publish.yml` on `pkg-nec/http-server` against the `npm-publish` environment.

This task can run at any point after this plan's PR is merged (or in parallel with Task 4). It does NOT need to happen before Task 6, and it does not need to precede the PR merge.

- [ ] **Step 1: Log in to npmjs.com**

Log in as an account with admin rights on the `@pkg-nec` org — the same account used to publish `14.1.1-pkgnec.0`.

- [ ] **Step 2: Navigate to the package's Trusted Publisher settings**

Open `https://www.npmjs.com/package/@pkg-nec/http-server`, click the **Settings** tab, then click **Trusted Publisher** in the left-hand nav.

- [ ] **Step 3: Add a new publisher — GitHub Actions**

Click **Add publisher**, choose **GitHub Actions**, and fill in exactly:

- **Organization or user:** `pkg-nec`
- **Repository:** `http-server`
- **Workflow filename:** `publish.yml`
- **Environment name:** `npm-publish`

Every field is a case-sensitive string match against what the workflow's OIDC JWT will present. A single character wrong here will cause `npm ERR! code E401` at publish time.

- [ ] **Step 4: Save**

Click **Save** (or equivalent primary button). npm displays the publisher in the list.

- [ ] **Step 5: Screenshot or record the four saved values**

Take a screenshot or paste the four values into a note. Task 7's verification will independently visually confirm these against what the workflow file declares.

There is no `npm` CLI command that reads back Trusted Publisher configuration — Task 7's verification is UI-only for the npm side.

---

### Task 6: Create the `npm-publish` GitHub Environment (out-of-tree, `gh` API)

**Files:** none. Manual configuration on `github.com/pkg-nec/http-server`, executable via `gh api`.

**Interfaces:**
- Consumes: nothing in-repo.
- Produces: a GitHub Actions Environment named `npm-publish` with (a) required reviewer `maw629`, (b) deployment-branch policy allowing `trunk` as a branch and `v*.*.*` as a tag pattern, (c) NO environment secrets.

- [ ] **Step 1: Create the environment (empty configuration)**

```bash
gh api --method PUT \
  -H "Accept: application/vnd.github+json" \
  /repos/pkg-nec/http-server/environments/npm-publish \
  --input - <<'EOF'
{
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
EOF
```

Expected: a JSON blob describing the created environment. Note the `deployment_branch_policy.custom_branch_policies: true` — this switches the environment into "selected branches and tags" mode where you can add specific patterns (as opposed to the "all branches" or "protected branches only" preset choices).

- [ ] **Step 2: Add required reviewer**

Look up `maw629`'s numeric user ID (needed for the API — reviewer targets are ID-based, not username-based):

```bash
gh api /users/maw629 --jq .id
# → prints a numeric ID, e.g. 12345678
```

Save the ID as `MAW_ID`, then set the reviewer:

```bash
MAW_ID=$(gh api /users/maw629 --jq .id)
gh api --method PUT \
  -H "Accept: application/vnd.github+json" \
  /repos/pkg-nec/http-server/environments/npm-publish \
  --input - <<EOF
{
  "wait_timer": 0,
  "reviewers": [
    { "type": "User", "id": ${MAW_ID} }
  ],
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
EOF
```

Expected: JSON response includes a `reviewers` array with your user entry.

- [ ] **Step 3: Add the `trunk` branch policy**

```bash
gh api --method POST \
  -H "Accept: application/vnd.github+json" \
  /repos/pkg-nec/http-server/environments/npm-publish/deployment-branch-policies \
  --input - <<'EOF'
{
  "name": "trunk",
  "type": "branch"
}
EOF
```

Expected: JSON response with the created policy including an `id` field.

- [ ] **Step 4: Add the `v*.*.*` tag policy**

```bash
gh api --method POST \
  -H "Accept: application/vnd.github+json" \
  /repos/pkg-nec/http-server/environments/npm-publish/deployment-branch-policies \
  --input - <<'EOF'
{
  "name": "v*.*.*",
  "type": "tag"
}
EOF
```

Expected: JSON response with the created policy.

This tag rule is what actually admits release-triggered workflow runs — release workflows execute against the tag ref, not the branch. Without this rule, every publish attempt fails at the environment gate with a "ref not allowed to deploy to this environment" error.

- [ ] **Step 5: Confirm no environment secrets exist**

```bash
gh api /repos/pkg-nec/http-server/environments/npm-publish/secrets --jq '.total_count, .secrets'
```

Expected: `0` followed by `[]`. If anything else appears, an old `NPM_TOKEN` (or similar) has leaked in — delete it:

```bash
# only if a secret is present:
gh api --method DELETE /repos/pkg-nec/http-server/environments/npm-publish/secrets/<SECRET_NAME>
```

---

### Task 7: Verify the setup (all five items from the spec's Verification section)

**Files:** none modified.

**Interfaces:**
- Consumes: Tasks 1–6 complete.
- Produces: proof (via CLI output) that every one of the five verification items in the spec is satisfied. No live publish attempted.

- [ ] **Step 1: Environment exists with reviewer populated**

```bash
gh api /repos/pkg-nec/http-server/environments/npm-publish --jq '{name, reviewers: [.protection_rules[]? | select(.type=="required_reviewers") | .reviewers[]? | .reviewer.login]}'
```

Expected: `{"name":"npm-publish","reviewers":["maw629"]}` (or similar structure containing the login).

- [ ] **Step 2: Deployment-branch-and-tag policies match spec**

```bash
gh api /repos/pkg-nec/http-server/environments/npm-publish/deployment-branch-policies --jq '.branch_policies[] | {name, type}'
```

Expected: exactly TWO entries, in either order:
- `{"name":"trunk","type":"branch"}`
- `{"name":"v*.*.*","type":"tag"}`

If only one appears, the missing rule blocks a whole class of trigger from ever reaching this environment — go back to Task 6 and add the missing one.

- [ ] **Step 3: `publish.yml` YAML parses**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/publish.yml')); print('ok')"
# → ok
```

If the branch is already merged to `trunk`, `git switch trunk && git pull` first so this runs against the merged version.

- [ ] **Step 4: `publishConfig.provenance` is `true`**

```bash
node -e "const p = require('./package.json'); console.log(p.publishConfig.provenance)"
# → true
```

- [ ] **Step 5: Trusted Publisher on npm — visual confirmation**

Open `https://www.npmjs.com/package/@pkg-nec/http-server` → Settings → Trusted Publisher. Confirm the recorded publisher entry has exactly:

- Organization or user: `pkg-nec`
- Repository: `http-server`
- Workflow filename: `publish.yml`
- Environment name: `npm-publish`

Each field is a case-sensitive string match against what the workflow's OIDC JWT presents at publish time. A single character wrong here would cause `npm ERR! code E401` when the canary spec runs.

There is no CLI channel for reading Trusted Publisher configuration; this step must be human-visual.

---

## Definition of Done (from the spec's Verification section)

1. ✅ `gh api /repos/pkg-nec/http-server/environments/npm-publish` returns 200 with reviewers populated — Task 7 Step 1.
2. ✅ Deployment branch policies include `trunk` (branch) and `v*.*.*` (tag) — Task 7 Step 2.
3. ✅ `publish.yml` YAML parses — Task 7 Step 3.
4. ✅ `package.json` `publishConfig.provenance` is `true` — Task 7 Step 4.
5. ✅ Trusted Publisher on npm shows the four expected fields — Task 7 Step 5.

Live end-to-end trust-chain verification happens in the follow-up canary spec (`14.1.1-pkgnec.1`).
