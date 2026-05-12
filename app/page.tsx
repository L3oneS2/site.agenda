import Link from "next/link";
import { ClientQuickAccess } from "@/components/client-quick-access";

/** Marketing estático: ISR leve entre deploys. */
export const revalidate = 300;

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30 dark:opacity-[0.18]"
        style={{
          background:
            "radial-gradient(ellipse 72% 45% at 50% -12%, rgba(212,175,55,0.22), transparent 65%)",
        }}
      />
      <section className="mx-auto max-w-6xl px-5 pb-28 pt-24 sm:px-8 sm:pt-28 lg:pb-36 lg:pt-36">
        <div className="mx-auto max-w-[42rem] text-center animate-fade-in">
          <h1 className="font-display text-[2.375rem] font-semibold leading-[1.12] tracking-[-0.02em] sm:text-5xl sm:leading-[1.1] lg:text-[3.25rem]">
            Sua agenda premium.{" "}
            <span className="text-gradient-gold">Seus clientes</span>, sem
            fricção.
          </h1>
          <p className="mx-auto mt-8 max-w-[28rem] text-[0.9375rem] leading-relaxed text-[var(--muted)] sm:mt-10 sm:max-w-md sm:text-base">
            Um aplicativo completo para gerenciar agendamentos, clientes e horários com
            praticidade e elegância.
          </p>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3 sm:mt-14 sm:gap-4">
            <Link
              href="/#area-cliente"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gold-500/40 bg-[var(--card)] px-8 py-3 text-base font-medium shadow-gold/20 transition-all duration-200 hover:border-gold-500 hover:shadow-gold"
            >
              Área do cliente
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gold-500 px-8 py-3 text-base font-medium text-ink-950 shadow-gold transition-all duration-200 hover:bg-gold-400 hover:shadow-lg"
            >
              Sou barbeiro — Começar
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-8 py-3 text-base font-medium transition-all duration-200 hover:border-gold-500/50 hover:shadow-soft"
            >
              Entrar (barbeiro)
            </Link>
          </div>
          <p className="mx-auto mt-6 max-w-lg text-center text-sm leading-relaxed text-[var(--muted)]">
            Clientes agendam sem criar conta pelo link da barbearia. Barbeiros usam{" "}
            <span className="text-[var(--fg)]">Entrar</span> para o painel.
          </p>
        </div>

        <section
          id="area-cliente"
          className="mx-auto mt-24 max-w-3xl scroll-mt-24 rounded-3xl border border-gold-500/25 bg-gradient-to-b from-gold-500/10 to-transparent px-6 py-12 text-center sm:mt-28 sm:px-10"
          aria-labelledby="area-cliente-titulo"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
            Para você que vai cortar
          </p>
          <h2
            id="area-cliente-titulo"
            className="mt-3 font-display text-3xl font-bold sm:text-4xl"
          >
            Área do cliente
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--muted)]">
            Você não precisa de login. Peça ao seu barbeiro o link ou o código da
            página de agendamento, cole abaixo e escolha data e horário na hora.
          </p>
          <ClientQuickAccess />
        </section>
      </section>
    </div>
  );
}
