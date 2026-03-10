"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <button
        onClick={reset}
        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded"
      >
        Try again
      </button>
    </div>
  );
}
