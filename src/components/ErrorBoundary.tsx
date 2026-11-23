import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: unknown) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-[50vh] flex items-center justify-center p-8">
        <div className="card p-8 max-w-lg w-full text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-danger-500/10 flex items-center justify-center text-danger-500">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              Something went wrong
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              An unexpected error occurred. Reload the page to try again.
            </p>
          </div>
          <pre className="text-xs text-text-tertiary bg-bg-tertiary rounded-lg p-3 overflow-x-auto text-left">
            {this.state.error.message || String(this.state.error)}
          </pre>
          <button type="button" onClick={this.handleReset} className="btn btn-primary mx-auto">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reload
          </button>
        </div>
      </div>
    );
  }
}
