/**
 * TEST-001 (SPEC-PRD-055 Spec-AC-01): the shared async boundary renders the
 * skeleton while loading, an ErrorState with a working retry on error, the empty
 * node when there is no data, and the children otherwise.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { fhThemeDark } from '@fh/ui';
import { AsyncBoundary } from '../AsyncBoundary';

afterEach(cleanup);

const wrap = (ui: React.ReactNode) => <ThemeProvider theme={fhThemeDark}>{ui}</ThemeProvider>;

describe('AsyncBoundary', () => {
  it('renders the skeleton while loading (not the children)', () => {
    render(
      wrap(
        <AsyncBoundary loading skeleton={<div data-testid="skel" />}>
          <div data-testid="content" />
        </AsyncBoundary>,
      ),
    );
    expect(screen.getByTestId('skel')).toBeDefined();
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('renders an ErrorState with a working retry on error', () => {
    const onRetry = vi.fn();
    render(
      wrap(
        <AsyncBoundary
          loading={false}
          error={new Error('boom')}
          errorTitle="Nepodařilo se načíst"
          retryLabel="Zkusit znovu"
          onRetry={onRetry}
        >
          <div data-testid="content" />
        </AsyncBoundary>,
      ),
    );
    expect(screen.getByText('Nepodařilo se načíst')).toBeDefined();
    expect(screen.queryByTestId('content')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders the empty node when isEmpty', () => {
    render(
      wrap(
        <AsyncBoundary loading={false} isEmpty empty={<div data-testid="empty" />}>
          <div data-testid="content" />
        </AsyncBoundary>,
      ),
    );
    expect(screen.getByTestId('empty')).toBeDefined();
    expect(screen.queryByTestId('content')).toBeNull();
  });

  it('renders children when loaded, non-empty, no error', () => {
    render(
      wrap(
        <AsyncBoundary loading={false}>
          <div data-testid="content" />
        </AsyncBoundary>,
      ),
    );
    expect(screen.getByTestId('content')).toBeDefined();
  });
});
