import { redirect } from "next/navigation";
import { tryCreateClient } from "@/lib/supabase/server";
import { requireBarber } from "@/lib/auth";
import { normalizeJoinedAppointments } from "@/lib/appointment-rows";
import { Card } from "@/components/ui/card";
import { CancelAppointmentButton, CopyAppointmentLinkButton } from "./ui/agenda-client";
import { AgendaPlanner } from "./ui/agenda-planner";
import { DayTimeline } from "./ui/day-timeline";
import type { Appointment } from "@/lib/types";

/** Limite de janela + linhas para lista “Reservas futuras” (compatível com timeline por dia). */
const AGENDA_FUTURE_DAYS = 120;
const AGENDA_FUTURE_ROWS_CAP = 200;

function addDaysToISODate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export default async function AgendaPage() {
  const { user } = await requireBarber();
  const supabase = await tryCreateClient();
  if (!supabase) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);
  const futureUntil = addDaysToISODate(today, AGENDA_FUTURE_DAYS);

  const { data: appts } = await supabase
    .from("appointments")
    .select(
      "id, barber_id, servico_id, cliente_nome, cliente_telefone, data, hora_inicio, hora_fim, status, created_at, updated_at, services ( id, nome, preco, duracao_minutos )"
    )
    .eq("barber_id", user.id)
    .eq("status", "scheduled")
    .gte("data", today)
    .lte("data", futureUntil)
    .order("data", { ascending: true })
    .order("hora_inicio", { ascending: true })
    .limit(AGENDA_FUTURE_ROWS_CAP);

  const list = normalizeJoinedAppointments(appts) as Appointment[];
  const todayAppts = list.filter((a) => a.data === today);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-4xl font-bold">Agenda</h1>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">
        Defina horários por data no calendário; o link público lista exatamente esses
        inícios de atendimento. Reservas aparecem na linha do tempo e na lista ao
        lado, com atualização em tempo quase real.
      </p>

      <Card className="mt-10">
        <h2 className="font-display text-xl font-semibold">
          Disponibilidade por data
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Cada horário pertence só à data escolhida. Indicadores: verde (há vagas),
          vermelho (tudo ocupado), cinza (sem cadastro).
        </p>
        <AgendaPlanner barberUserId={user.id} />
      </Card>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl font-semibold">Linha do tempo (dia)</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Altura de cada bloco é proporcional à duração. Cores variam por serviço.
          </p>
          <DayTimeline
            barberUserId={user.id}
            initialDate={today}
            initialAppointments={normalizeJoinedAppointments(todayAppts)}
          />
        </Card>

        <Card>
          <h2 className="font-display text-xl font-semibold">Reservas futuras</h2>
          <ul className="mt-4 space-y-3">
            {list.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">
                Nenhum agendamento futuro.
              </li>
            ) : (
              list.map((a) => {
                const svc =
                  a.services &&
                  typeof a.services === "object" &&
                  "nome" in a.services
                    ? (a.services as { nome: string }).nome
                    : null;
                const scheduled = a.status === "scheduled";
                return (
                  <li
                    key={a.id}
                    className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
                      scheduled
                        ? "border-[var(--border)]"
                        : "border-dashed border-zinc-500/40 bg-zinc-500/5 opacity-90"
                    }`}
                  >
                    <div>
                      <p className="font-medium">{a.cliente_nome}</p>
                      <p className="text-[var(--muted)]">
                        {a.data} · {String(a.hora_inicio).slice(0, 5)} –{" "}
                        {String(a.hora_fim).slice(0, 5)}
                        {svc ? ` · ${svc}` : ""}
                      </p>
                      <p
                        className={`mt-1 text-xs font-medium uppercase tracking-wide ${
                          scheduled ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"
                        }`}
                      >
                        {scheduled ? "Confirmado" : "Cancelado"}
                      </p>
                    </div>
                    {scheduled ? (
                      <div className="flex flex-wrap gap-2">
                        <CopyAppointmentLinkButton appointmentId={a.id} />
                        <CancelAppointmentButton id={a.id} />
                      </div>
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
