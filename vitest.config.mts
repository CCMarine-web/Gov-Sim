import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest configuration.
 *
 * The DEFAULT environment is deliberately `node`, not `jsdom`. Everything under
 * src/sim/ is pure TypeScript with no DOM access (DESIGN.md Rule 1), and
 * running the tests without a DOM means a stray `window` or `document`
 * reference fails the test suite immediately rather than passing quietly and
 * breaking later on a server render.
 *
 * Component tests opt IN to a DOM per file, with a docblock pragma:
 *
 *     // @vitest-environment jsdom
 *
 * Opting in per file rather than globally is what keeps the purity guarantee:
 * a `window` reference that leaks into src/sim/ still fails, because the sim
 * tests still run without a DOM.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts'],
    // The determinism test simulates 4,263 days twice. Give it room; if it
    // ever approaches this, the engine has a performance problem worth knowing
    // about rather than a timeout worth raising.
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
