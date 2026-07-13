/**
 * TEST (SPEC-PRD-055 Spec-AC-01, error path): QueryErrorBoundary catches a
 * throwing child and renders an ErrorState with a retry that remounts the child.
 */
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { fhThemeDark } from '@fh/ui';
import { QueryErrorBoundary } from '../QueryErrorBoundary';

afterEach(cleanup);

// React logs caught errors to console.error — silence it for these tests.
let spy: ReturnType<typeof vi.spyOn>;
beforeAll(() => { spy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterAll(() => spy.mockRestore());

const wrap = (ui: React.ReactNode) => <ThemeProvider theme={fhThemeDark}>{ui}</ThemeProvider>;

describe('QueryErrorBoundary', () => {
  it('renders ErrorState on a thrown child, then retries to a healthy child', () => {
    let shouldThrow = true;
    const Child = () => {
      if (shouldThrow) throw new Error('query failed');
      return <div data-testid="ok" />;
    };
    render(
      wrap(
        <QueryErrorBoundary errorTitle="Nepodařilo se načíst" retryLabel="Zkusit znovu">
          <Child />
        </QueryErrorBoundary>,
      ),
    );
    expect(screen.getByText('Nepodařilo se načíst')).toBeDefined();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(screen.getByTestId('ok')).toBeDefined();
  });

  it('renders children unchanged when nothing throws', () => {
    render(
      wrap(
        <QueryErrorBoundary errorTitle="x" retryLabel="y">
          <div data-testid="ok" />
        </QueryErrorBoundary>,
      ),
    );
    expect(screen.getByTestId('ok')).toBeDefined();
  });
});
