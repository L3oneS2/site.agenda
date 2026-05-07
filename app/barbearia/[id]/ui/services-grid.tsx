"use client";

import { Button } from "@/components/ui/button";
import type { Service } from "@/lib/types";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function ServicesGrid({
  services,
  onBook,
}: {
  services: Service[];
  onBook: () => void;
}) {
  if (services.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center">
        <p className="text-sm text-[var(--muted)]">
          Nenhum serviço cadastrado ainda. Volte em breve ou fale com a barbearia.
        </p>
        <Button type="button" variant="outline" className="mt-6" onClick={onBook}>
          Ir para agendamento
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="text-sm text-[var(--muted)]">
          Escolha um serviço e depois siga para o agendamento.
        </p>
        <Button type="button" onClick={onBook} className="w-full sm:w-auto">
          Agendar horário
        </Button>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {services.map((s) => (
          <li
            key={s.id}
            className="group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--card)] to-black/[0.02] p-5 shadow-soft transition hover:border-gold-500/35 hover:shadow-gold dark:from-[var(--card)] dark:to-white/[0.03]"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-semibold leading-tight text-[var(--fg)]">
                {s.nome}
              </h3>
              <span className="shrink-0 rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-medium text-gold-700 ring-1 ring-gold-500/25 dark:text-gold-300">
                ⏱ {s.duracao_minutos} min
              </span>
            </div>
            <p className="mt-4 font-display text-2xl font-bold text-gold-600">
              {brl.format(s.preco)}
            </p>
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gold-500/10 blur-2xl transition group-hover:bg-gold-500/15" />
          </li>
        ))}
      </ul>
    </div>
  );
}
