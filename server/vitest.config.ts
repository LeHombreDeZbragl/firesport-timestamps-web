import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // Routes import the Supabase singleton, which throws at import time if
    // SUPABASE_URL is unset. Every route test mocks that module, so no live DB
    // or secrets are ever required.
    clearMocks: true,
  },
});
