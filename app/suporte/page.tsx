import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SuportePage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="font-display text-4xl font-bold">Suporte</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Precisa de ajuda com assinatura, trial ou acesso à conta? Fale conosco pelo
        seu e-mail cadastrado ou use o canal oficial do produto.
      </p>
      <Card className="mt-10 space-y-4 p-6">
        <p className="text-sm text-[var(--muted)]">
          Se o período de teste expirou, renove em <strong className="text-[var(--fg)]">Assinatura</strong>.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/assinatura">
            <Button>Ir para assinatura</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Início</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
