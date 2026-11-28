---
name: gh-cli-not-github-mcp
description: teamable — GitHub work goes through the gh CLI; GitHub MCP plugin disabled by choice (2026-11-28)
metadata:
  node_type: memory
  type: feedback
  originSessionId: 217551f5-ff40-4c68-923d-eaa8e8f654aa
  modified: 2026-11-27T23:22:02.643Z
---

Use the `gh` CLI for all GitHub work (PRs, review replies, GraphQL thread resolve, issues, the project board). The user disabled the GitHub MCP plugin on 2026-11-28.

**Why:** `gh` covers everything; MCP with a fine-grained PAT can't handle the user-owned project board, adds a secret to rotate, and no API (MCP included) can apply review suggestions. Token details are in issue #38.

**How to apply:** don't suggest re-enabling or configuring GitHub MCP unless cloud/claude.ai sessions without `gh` come into play. Review suggestions get applied as normal commits, never "Commit suggestion".
