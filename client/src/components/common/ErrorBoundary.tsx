import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-xl font-semibold text-red-400">Něco se pokazilo</h1>
          <p className="max-w-md text-sm text-surface-400">
            {this.state.error?.message ?? 'Nastala neočekávaná chyba.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md border border-surface-500 bg-surface-700 px-4 py-1.5 text-sm font-semibold text-surface-200 transition-colors hover:border-primary-400 hover:bg-surface-600 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            Načíst znovu
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
