import { Component } from 'react';
import { reportFrontendError } from '../utils/errorReporter.js';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    reportFrontendError(error, {
      severity: 'critical',
      module: 'React ErrorBoundary',
      rawMetadata: { componentStack: info?.componentStack },
      suggestedFix: 'Check the component stack and recent UI changes for render-time exceptions.',
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md rounded-lg border border-red-500/30 bg-red-950/30 p-5">
            <h1 className="text-lg font-bold text-red-100">Something went wrong</h1>
            <p className="mt-2 text-sm text-red-100/75">
              The error was sent to the Error Center. Refresh the page to continue.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
