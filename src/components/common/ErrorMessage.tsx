interface ErrorMessageProps {
  message: string;
  className?: string;
}

export function ErrorMessage({ message, className = '' }: ErrorMessageProps) {
  if (!message) return null;

  return (
    <div
      className={`rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200 ${className}`}
    >
      {message}
    </div>
  );
}
