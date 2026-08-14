import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Validation Ledger render failure', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-surface-50 p-5">
          <section className="panel max-w-md px-6 py-10 text-center">
            <AlertTriangle className="mx-auto text-orange-500" size={38} />
            <h1 className="mt-4 text-xl font-bold text-surface-950">The workspace could not render</h1>
            <p className="mt-2 text-sm leading-6 text-surface-500">Your local data has not been deleted. Reload the app; if the issue continues, export a backup from Settings after recovery.</p>
            <button type="button" onClick={() => window.location.reload()} className="button-primary mt-6"><RefreshCw size={17} />Reload Application</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
