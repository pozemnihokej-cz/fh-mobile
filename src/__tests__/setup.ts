import '@testing-library/jest-dom/vitest';
import { initI18n } from '@fh/i18n';

// CHANGE-055: i18n must be initialized before any component that calls
// useTranslation() is rendered in tests (NotFoundPage, TenantPickerPage).
// Failing to do so makes `t('mobile.routing.notFound.title')` return the
// raw key — which would coincidentally satisfy our string-match assertions
// (rendered text equals the key), masking real-world breakage. Init once.
void initI18n();
