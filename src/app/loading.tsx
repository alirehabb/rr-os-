export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-6 py-10">
      <div className="mb-8 h-7 w-48 rounded-lg bg-surface-subtle" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-border bg-surface-subtle" />
        ))}
      </div>
    </div>
  );
}
