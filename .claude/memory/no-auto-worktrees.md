---
name: no-auto-worktrees
description: "In teamable, don't create git worktrees automatically for new tasks; work on regular branches"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 4892607c-1823-4f39-894e-2d918d864bde
  modified: 2026-11-22T14:58:52.709Z
---

Don't create git worktrees automatically when starting a new task in teamable (e.g. don't follow superpowers:using-git-worktrees or call EnterWorktree on your own). Branch off main with `git switch -c <branch>` and work in the main checkout.

**Why:** the user wants to work on regular branches. Worktrees under `.claude/worktrees/` came from the superpowers skill, not from any project rule.

**How to apply:** at the start of feature, plan or fix work, create a normal branch. Use a worktree only if the user asks for one explicitly.
