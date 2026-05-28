import { useState, useCallback, useEffect, useRef } from 'react';
import { login } from '../services/api';

interface AdminLoginModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

export function AdminLoginModal({ onSuccess, onClose }: AdminLoginModalProps): React.JSX.Element {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input as soon as the modal mounts.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password.trim()) return;

      setIsLoading(true);
      setError(null);

      try {
        await login(password);
        setPassword('');
        onSuccess();
      } catch {
        setError('Invalid password. Please try again.');
        setPassword('');
        inputRef.current?.focus();
      } finally {
        setIsLoading(false);
      }
    },
    [password, onSuccess],
  );

  return (
    /* Backdrop — click outside to close */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-login-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-sm rounded-xl border border-surface-700 bg-surface-900 p-8 shadow-2xl">
        {/* X button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded p-1 text-surface-400 transition-colors hover:bg-surface-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        <h2
          id="admin-login-title"
          className="mb-1 text-lg font-semibold text-white"
        >
          Admin login
        </h2>
        <p className="mb-6 text-sm text-surface-400">
          Enter the admin password to enable write access.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium text-surface-300">
            Password
          </label>
          <input
            ref={inputRef}
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-lg border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Admin password"
            autoComplete="current-password"
            disabled={isLoading}
          />

          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !password.trim()}
            className="w-full rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
