import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useAuthStore } from '@/shared/stores/authStore';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[INTEGRA] UI crash', error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <h1 className="text-2xl font-bold text-integra-gray-900">Не удалось открыть экран</h1>
        <p className="mt-2 max-w-md text-sm text-integra-gray-600">
          Обновите страницу. Записи и пациенты на месте — это сбой экрана, не данных.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white"
            onClick={() => this.setState({ error: null })}
          >
            Повторить
          </button>
          <button
            type="button"
            className="rounded-xl border border-integra-gray-200 px-4 py-2 text-sm font-medium text-integra-gray-800"
            onClick={() => {
              useAuthStore.getState().logout();
              window.location.href = '/login';
            }}
          >
            Выйти
          </button>
        </div>
      </div>
    );
  }
}
