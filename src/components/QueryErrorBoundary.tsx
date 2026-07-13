import { Component, type ReactNode } from 'react';
import Button from '@mui/material/Button';
import { ErrorState, FhIcon } from '@fh/ui';

interface Props {
  children: ReactNode;
  /** Error headline (caller owns i18n). */
  errorTitle?: ReactNode;
  errorDescription?: ReactNode;
  retryLabel?: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Screen-level error boundary for the fan surfaces (SPEC-PRD-055 Spec-AC-01,
 * error path). Convex `useQuery` throws to the nearest boundary on failure;
 * this one renders an `@fh/ui` ErrorState with a retry that clears the error and
 * remounts the children (re-running the query), instead of the whole app falling
 * to the top-level boundary. Wrap a route element that queries.
 */
export class QueryErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private retry = (): void => this.setState({ error: null });

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorState
          icon={<FhIcon name="close" sx={{ fontSize: 40 }} />}
          title={this.props.errorTitle}
          description={this.props.errorDescription}
          action={
            <Button variant="contained" onClick={this.retry} sx={{ borderRadius: '12px', fontWeight: 800, px: 3 }}>
              {this.props.retryLabel}
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
