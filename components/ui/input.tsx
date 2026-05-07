import { type InputHTMLAttributes, forwardRef } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, className = "", id, ...props },
  ref
) {
  const inputId = id ?? props.name;
  return (
    <label className="block w-full space-y-1.5" htmlFor={inputId}>
      {label ? (
        <span className="text-sm font-medium text-[var(--muted)]">{label}</span>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={`w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-[var(--fg)] outline-none transition focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/20 ${className}`}
        {...props}
      />
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
    </label>
  );
});
