import { type ButtonHTMLAttributes, forwardRef } from "react";

const variants = {
  primary:
    "bg-gold-500 text-ink-950 hover:bg-gold-400 shadow-gold hover:shadow-lg",
  outline:
    "border border-[var(--border)] bg-[var(--card)] hover:border-gold-500/50 hover:shadow-soft",
  ghost: "hover:bg-black/5 dark:hover:bg-white/10",
  danger: "bg-red-600 text-white hover:bg-red-500",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className = "", variant = "primary", disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...props}
    />
  );
});
