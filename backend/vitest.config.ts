import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./src/__tests__/setup/mongo-global-setup.ts'],
    setupFiles: ['./src/__tests__/setup/mongo-test-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
    // All spec files share one MongoDB container — run files sequentially to
    // prevent cross-file deleteMany() races while one worker writes documents.
    fileParallelism: false,
  },
})
