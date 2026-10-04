import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-start justify-center gap-3 p-4">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p role="alert" className="text-sm text-muted-foreground">
          {this.state.error.message}
        </p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </main>
    );
  }
}
