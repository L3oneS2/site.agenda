export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-soft transition hover:shadow-lg ${className}`}
    >
      {children}
    </div>
  );
}
