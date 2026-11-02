import { defineConfig } from 'vitest/config';

// Core tests only: plain Node, no React, no Vite plugins from the app.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
