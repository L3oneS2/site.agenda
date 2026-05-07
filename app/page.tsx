import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ClientQuickAccess } from "@/components/client-quick-access";

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(212,175,55,0.35), transparent)",
        }}
      />
      <section className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center animate-fade-in">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
            SaaS para barbearias
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-6xl">
            Sua agenda premium.{" "}
            <span className="text-gradient-gold">Seus clientes</span>, sem
            fricção.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--muted)]">
            Assinatura mensal com Stripe, confirmação automática e página pública
            para agendamentos — tudo com visual minimalista preto, branco e
            dourado.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
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
          <p className="mx-auto mt-4 max-w-lg text-center text-sm text-[var(--muted)]">
            Clientes agendam sem criar conta pelo link da barbearia. Barbeiros usam{" "}
            <span className="text-[var(--fg)]">Entrar</span> para o painel.
          </p>
        </div>

        <section
          id="area-cliente"
          className="mx-auto mt-20 max-w-3xl scroll-mt-24 rounded-3xl border border-gold-500/25 bg-gradient-to-b from-gold-500/10 to-transparent px-6 py-12 text-center sm:px-10"
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

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {[
            {
              title: "Assinatura Stripe",
              body: "Checkout seguro, webhooks validados e bloqueio do painel sem plano ativo.",
            },
            {
              title: "Agenda inteligente",
              body: "Defina faixas por dia da semana e veja apenas horários livres em tempo real.",
            },
            {
              title: "Cliente sem login",
              body: "Link público da barbearia: escolha data, horário e pronto.",
            },
          ].map((item) => (
            <Card
              key={item.title}
              className="animate-fade-in hover:-translate-y-0.5"
            >
              <h3 className="font-display text-xl font-semibold text-[var(--fg)]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
