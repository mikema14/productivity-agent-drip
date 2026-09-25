import { defineWorkspace } from 'vitest/config';

// Two projects: the renderer tests (vitest.config.ts — jsdom, src/**) and the
// main-process logic next to it in electron/ (plain Node). Kept apart so the
// renderer config stays exactly as it is on the other test branches.
export default defineWorkspace([
  'vitest.config.ts',
  {
    test: {
      name: 'electron',
      environment: 'node',
      include: ['electron/**/*.test.ts'],
    },
  },
]);
