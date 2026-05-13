import { fetchAppointmentByAccessToken } from "@/app/actions/appointment-public-token";
import { AppointmentTokenView } from "./appointment-token-view";

export const dynamic = "force-dynamic";

export default async function AgendamentoPorTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await fetchAppointmentByAccessToken(token);

  if (res.error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-display text-xl font-semibold text-[var(--fg)]">
          Não foi possível carregar
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          O serviço está temporariamente indisponível. Tente novamente em instantes.
        </p>
      </div>
    );
  }

  if (res.notFound || !res.row) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-display text-xl font-semibold text-[var(--fg)]">
          Link inválido ou expirado
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Não encontramos um agendamento para este endereço. Confira se copiou o link
          completo ou peça um novo link à barbearia.
        </p>
      </div>
    );
  }

  return <AppointmentTokenView token={token} initial={res.row} />;
}
