import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center p-8">
        <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-danger" />
        </div>
        <div>
          <p className="text-lg font-semibold text-text-primary dark:text-text-dark">Something went wrong</p>
          <p className="text-sm text-text-muted mt-1 max-w-sm">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => this.setState({ hasError: false, error: null })}>
          Try again
        </Button>
      </div>
    );
  }
}
