import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ClientQuickAccess } from "@/components/client-quick-access";

export const revalidate = 300;

export default function ClientePage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center px-4 py-16">
      <Card className="w-full">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
          Área do cliente
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">
          Agende sem login
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Cole o link (ou o código) que seu barbeiro enviou para abrir a página
          de agendamento.
        </p>

        <ClientQuickAccess />

        <p className="mt-8 text-center text-sm text-[var(--muted)]">
          Você é barbeiro?{" "}
          <Link href="/login" className="font-medium text-gold-600 hover:underline">
            Entrar no painel
          </Link>
        </p>
      </Card>
    </div>
  );
}

