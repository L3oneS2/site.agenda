import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ErroPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-16">
      <Card className="w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-3xl text-red-500">
          !
        </div>
        <h1 className="font-display text-3xl font-bold">Pagamento não concluído</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          O checkout foi cancelado ou recusado. Nenhuma cobrança foi efetuada.
          Tente novamente ou use outro cartão.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/assinatura">
            <Button>Voltar para assinatura</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Início</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
