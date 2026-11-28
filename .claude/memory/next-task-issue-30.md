---
name: next-task-issue-30
description: teamable — agreed next task (2026-11-28): issue #30 concurrency in ci.yml, one PR, plus rationale fixes and local branch cleanup
metadata:
  type: project
  modified: 2026-11-27T23:27:56.370Z
---

Agreed with the user on 2026-11-28, deferred to the next session. One PR on branch `ci/concurrency` with `Closes #30`:

1. `.github/workflows/ci.yml`: workflow-level `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: ${{ github.ref != 'refs/heads/main' }} }` (snippet from the issue body).
2. Etap 5 plan (`docs/superpowers/plans/2026-06-17-etap5-wdrozenia.md`), dependency table: Task 4 row "3, #30" becomes "3"; mention #30 as recommended, not blocking. Drop the "kolejność podpisów" argument, since signatures are per digest.
3. Issue #30 body (edit via `gh issue edit`): remove "W Etapie 5 wdrożenie mogłoby wziąć starszy obraz" and the "Zrobione przed Etapem 5" criterion. After the PR #54 review, deploys never read tags. The remaining reason is the `latest` race seen 2026-11-24 (README and the Task 2 local smoke pull `:latest`).
4. Clean up merged local branches: build/node-24, chore/graphify, ci/dependabot-tuning, ci/harden-followup, ci/harden-workflows, docs/adr-0014-accepted, docs/etap5-spec, pr14-fix, refactor/backend-layering. Also `docs/etap5-spec-rewrite`, which needs `-D`: its content reached main via cherry-picks in PR #54. Overlaps with issue #31 (auto-delete after merge is a separate setting there).

**Why:** the user asked for exactly this scope ("w jednym PR-ze, popraw treści i posprzątaj") and wants to resume here.
**How to apply:** at session start, confirm main is current and #30 is still open, then do steps 1–4. Board: #30 goes to In progress, then In review. After that: #26 (it blocks Etap 5 Task 3) and #41 (Task 1, no dependencies).
