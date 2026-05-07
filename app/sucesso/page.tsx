import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SucessoPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-16">
      <Card className="w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gold-500/15 text-3xl">
          ✓
        </div>
        <h1 className="font-display text-3xl font-bold">Pagamento confirmado</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Sua assinatura será ativada em instantes após o webhook do Stripe
          processar o evento. Você já pode acessar o painel.
        </p>
        {sp.session_id ? (
          <p className="mt-4 break-all text-xs text-[var(--muted)]">
            Sessão: {sp.session_id}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard">
            <Button>Ir ao painel</Button>
          </Link>
          <Link href="/assinatura">
            <Button variant="outline">Status da assinatura</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
