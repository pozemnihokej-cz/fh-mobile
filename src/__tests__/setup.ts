// PRD-055: register the jest-dom matchers via an explicit expect.extend. The
// `@testing-library/jest-dom/vitest` side-effect entry does NOT take effect in
// this project's vitest setup (its internal `import { expect } from 'vitest'`
// binds a different expect instance, so toBeInTheDocument stays "Invalid Chai
// property"). The manual extend below is the reliable form and fixes every
// component test that uses jest-dom matchers (incl. the pre-existing routing.test).
import { expect, afterEach } from 'vitest';
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
expect.extend(jestDomMatchers);

// PRD-055: this project's vitest config does not enable `globals`, so
// @testing-library/react's automatic afterEach cleanup is NOT registered and
// the jsdom document accumulates mounts across tests ("Found multiple
// elements"). Register cleanup explicitly for every test file.
afterEach(() => cleanup());

import { initI18n } from '@fh/i18n';

// CHANGE-055: i18n must be initialized before any component that calls
// useTranslation() is rendered in tests (NotFoundPage, TenantPickerPage).
// Failing to do so makes `t('mobile.routing.notFound.title')` return the
// raw key — which would coincidentally satisfy our string-match assertions
// (rendered text equals the key), masking real-world breakage. Init once.
void initI18n();
