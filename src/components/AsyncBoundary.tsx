import type { ReactNode } from 'react';
import Button from '@mui/material/Button';
import { ErrorState, FhIcon } from '@fh/ui';

export interface AsyncBoundaryProps {
  /** Data is still loading (e.g. a Convex query returning undefined). */
  loading: boolean;
  /** A fetch/render error; when truthy the error state is shown. */
  error?: unknown;
  /** Loaded successfully but there is nothing to show. */
  isEmpty?: boolean;
  /** Placeholder shown while loading (e.g. a MatchCardSkeleton). */
  skeleton?: ReactNode;
  /** Node shown when `isEmpty` (e.g. an EmptyState). */
  empty?: ReactNode;
  /** Error headline (caller owns i18n). */
  errorTitle?: ReactNode;
  /** Error supporting line. */
  errorDescription?: ReactNode;
  /** Retry button label. */
  retryLabel?: ReactNode;
  /** Retry handler; when provided the error state offers a retry action. */
  onRetry?: () => void;
  children: ReactNode;
}

/**
 * The shared async-state boundary for fan screens (SPEC-PRD-055 Spec-AC-01/05):
 * one place that maps `{loading, error, isEmpty}` onto the `@fh/ui` state
 * surfaces — the skeleton while loading, an `ErrorState` with a retry on error,
 * the empty node when there is no data — so screens stop hand-rolling spinners
 * and blank branches. Copy is passed in by the caller to keep i18n at the screen.
 */
export function AsyncBoundary({
  loading,
  error,
  isEmpty,
  skeleton,
  empty,
  errorTitle,
  errorDescription,
  retryLabel,
  onRetry,
  children,
}: AsyncBoundaryProps): JSX.Element {
  if (loading) return <>{skeleton ?? null}</>;

  if (error) {
    return (
      <ErrorState
        icon={<FhIcon name="close" sx={{ fontSize: 40 }} />}
        title={errorTitle}
        description={errorDescription}
        action={
          onRetry ? (
            <Button variant="contained" onClick={onRetry} sx={{ borderRadius: '12px', fontWeight: 800, px: 3 }}>
              {retryLabel}
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (isEmpty) return <>{empty ?? null}</>;

  return <>{children}</>;
}
