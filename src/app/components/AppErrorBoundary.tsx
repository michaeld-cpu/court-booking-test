import React from 'react';
import { AppErrorPage } from '../pages/AppErrorPage';

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message ?? 'Unexpected application error.',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <AppErrorPage
          onRetry={this.handleRetry}
          onGoHome={this.handleGoHome}
          errorMessage={this.state.errorMessage}
        />
      );
    }

    return this.props.children;
  }
}
