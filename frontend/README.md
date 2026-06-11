# frontend

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

### Run End-to-End Tests with [Playwright](https://playwright.dev)

```sh
# Install browsers for the first run
npx playwright install

# When testing on CI, must build the project first
npm run build

# Runs the end-to-end tests
npm run test:e2e
# Runs the tests only on Chromium
npm run test:e2e -- --project=chromium
# Runs the tests of a specific file
npm run test:e2e -- tests/example.spec.ts
# Runs the tests in debug mode
npm run test:e2e -- --debug
```

#### Opening the HTML report and traces

After a local run:

```sh
npm run test:e2e:report
```

To open a report **downloaded from CI** (GitHub Actions artifact):

```sh
# 1. Unzip the downloaded artifact first — it must contain index.html
# 2. Point show-report at the unzipped folder (NOT the .zip)
npx playwright show-report "/path/to/playwright-report"
```

This starts a local server (usually <http://localhost:9323>) and opens the report.
Click a test → in the **Traces** section click the trace thumbnail to open the
Trace Viewer (timeline, DOM snapshots, network).

> Always open via `show-report` — do **not** double-click `index.html`. Opening it
> over `file://` blocks trace loading (CORS).

To open a single `trace.zip` directly:

```sh
npx playwright show-trace "/path/to/trace.zip"
```

Or drag the `trace.zip` onto <https://trace.playwright.dev> (runs fully in-browser,
nothing is uploaded).

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```
