interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-10 w-10 text-red-400"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
          clipRule="evenodd"
        />
      </svg>
      <p className="text-sm text-surface-300">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-primary-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors"
        >
          Zkusit znovu
        </button>
      )}
    </div>
  );
}
