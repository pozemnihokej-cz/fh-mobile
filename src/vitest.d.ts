// PRD-055 Phase 2: compile-time half of the @testing-library/jest-dom matcher
// augmentation (toBeInTheDocument, toHaveAttribute, toHaveTextContent, …). The
// runtime half is `import '@testing-library/jest-dom/vitest'` in
// src/__tests__/setup.ts. Without this, `pnpm typecheck` reports the matchers
// as missing on vitest's Assertion (pre-existing gap fixed under PRD-055).
import 'vitest';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {}
}
