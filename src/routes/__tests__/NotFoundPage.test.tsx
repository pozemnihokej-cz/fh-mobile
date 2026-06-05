/**
 * CHANGE-055 TEST-002 (Spec-AC-03)
 *
 * NotFoundPage renders an i18n-driven heading and an anchor back to the
 * picker. Spec key is `mobile.routing.notFound.title`. The link target is
 * `/` (the picker) — we use a hard <a> here (not a router <Link>) so the
 * back affordance survives history corruption from deep links.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotFoundPage from '../NotFoundPage';

describe('NotFoundPage (TEST-002)', () => {
  it('renders the i18n title and a link back to the picker', () => {
    render(<NotFoundPage />);

    // Title is the resolved EN string (i18n init runs in setup.ts).
    expect(screen.getByRole('heading')).toHaveTextContent(/page not found/i);

    const backLink = screen.getByRole('link');
    expect(backLink).toHaveAttribute('href', '/');
  });
});
