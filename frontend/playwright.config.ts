import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  /* Maximum time one test can run for. */
  timeout: 30 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000,
  },
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Single worker everywhere: all specs share ONE backend instance (one
     profile.json), so parallel files would race on the same mutable state.
     Suite is small and fast, so serializing costs nothing. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:4173',

    /* Use data-test attribute for getByTestId */
    testIdAttribute: 'data-test',

    /* Record a trace for every test run (viewable via `npm run test:e2e:report`).
       See https://playwright.dev/docs/trace-viewer. Switch to 'retain-on-failure'
       to keep traces only for failing tests if the artifacts get too large. */
    trace: 'on',

    /* Only on CI systems run the tests headless */
    headless: !!process.env.CI,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //   },
    // },
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //   },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: {
    //     ...devices['Pixel 5'],
    //   },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: {
    //     ...devices['iPhone 12'],
    //   },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: {
    //     channel: 'msedge',
    //   },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: {
    //     channel: 'chrome',
    //   },
    // },
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  // outputDir: 'test-results/',

  /* Run backend + frontend before starting the tests.
     The E2E stack is fully isolated from local dev: the backend runs on a
     DEDICATED port (3101) with a throwaway temp data dir, and preview proxies
     /api there via PREVIEW_API_TARGET. reuseExistingServer is false so a running
     `npm run dev` backend (:3001, real data) is never reused and never wiped by
     the per-test DELETE resets. */
  webServer: [
    {
      // Backend on a fresh temp data dir AND a dedicated port (never :3001 dev).
      // start:e2e is self-sufficient: with no MONGODB_URI (IDE "play" / direct
      // playwright run) it brings up dev Mongo + an isolated teamable_e2e DB; the
      // orchestrator (make e2e) injects MONGODB_URI for a throwaway testcontainer.
      // Longer timeout covers first-time `docker compose up --wait` + migrate.
      command: 'npm --prefix ../backend run start:e2e',
      url: 'http://localhost:3101/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // Preview proxies /api to the isolated E2E backend, not the dev one.
      command: 'npm run build && PREVIEW_API_TARGET=http://localhost:3101 npm run preview',
      url: 'http://localhost:4173',
      reuseExistingServer: false,
    },
  ],
})
