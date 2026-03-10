"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[rgb(var(--background-rgb))]">
      <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
      <button
        onClick={reset}
        className="rounded-lg bg-slate-700 px-4 py-2 text-white hover:bg-slate-600"
      >
        Try again
      </button>
    </div>
  );
}
