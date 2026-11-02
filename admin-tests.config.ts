import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['src/pages/Admin.test.ts'], environment: 'node' } });