interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-7 w-7 border-2',
  lg: 'h-12 w-12 border-[3px]',
};

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`
        animate-spin rounded-full
        border-surface-600 border-t-primary-400
        ${sizeClasses[size]}
      `}
    />
  );
}
