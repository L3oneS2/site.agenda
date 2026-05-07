"use client";

import Link from "next/link";
import { useTheme } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";

export function SiteHeader({
  userEmail,
}: {
  userEmail?: string | null;
}) {
  const { toggle, theme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          <span className="text-gradient-gold">Corte</span>
          <span className="text-[var(--fg)]">Pro</span>
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggle}
            className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:border-gold-500/40"
            aria-label="Alternar tema"
          >
            {theme === "dark" ? "Claro" : "Escuro"}
          </button>
          {userEmail ? (
            <>
              <Link
                href="/dashboard"
                className="hidden text-sm text-[var(--muted)] hover:text-gold-500 sm:inline"
              >
                Painel
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/#area-cliente"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold transition-all duration-200 hover:border-gold-500/50 hover:shadow-soft sm:px-4"
              >
                Área do cliente
              </Link>
              <Link href="/login" className="text-sm text-[var(--muted)] hover:text-gold-500">
                Entrar
              </Link>
              <Link href="/register">
                <Button className="!py-2 !px-4">Começar</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
