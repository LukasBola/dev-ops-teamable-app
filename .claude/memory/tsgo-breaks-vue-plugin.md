---
name: tsgo-breaks-vue-plugin
description: User has TS Native Preview (tsgo) enabled globally; it breaks .vue/.ts resolution in editor
metadata: 
  node_type: memory
  type: reference
  originSessionId: f9c9d26e-6c93-4195-9b2a-f89fd05adbff
---

The user has `js/ts.experimental.useTsgo: true` (older deprecated key: `typescript.experimental.useTsgo`) enabled in their **global** VS Code settings, plus the `typescriptteam.native-preview` extension installed.

tsgo (TypeScript Native Preview, the Go port) does **not support tsserver plugins**. So `@vue/typescript-plugin` (Vue Official / vue.volar) can't load, and `.vue` imports in `.ts` files fail with `Cannot find module './X.vue'` ts(2307) — even though `vue-tsc` (build/CI) resolves them fine. Same class of breakage hits Angular and any tsserver-plugin-based tooling.

**How to apply:** When a Vue/Angular project shows ts(2307) on framework imports in `.ts` files in the editor but builds/tests pass, suspect tsgo first. Fix: add `"js/ts.experimental.useTsgo": false` to the workspace `.vscode/settings.json` (workspace root that's actually opened), then `Developer: Reload Window`.

Note: VS Code reads folder `.vscode/settings.json` only from the **opened workspace root**, not subfolders — for this repo the root is `teamable/`, so config lives in `teamable/.vscode/`, not `teamable/frontend/.vscode/`.
