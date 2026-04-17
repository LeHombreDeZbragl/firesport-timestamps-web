interface FilterPillProps {
  label: string;
  onRemove: () => void;
}

export function FilterPill({ label, onRemove }: FilterPillProps): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-700 px-2.5 py-0.5 text-xs font-medium text-white">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="ml-0.5 rounded-full p-0.5 hover:bg-primary-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3 w-3"
          aria-hidden="true"
        >
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </span>
  );
}
