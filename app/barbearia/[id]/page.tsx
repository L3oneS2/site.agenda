import { notFound } from "next/navigation";
import { tryCreateClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { PublicBarbershop } from "./ui/public-barbershop";
import type { Barbershop, Service } from "@/lib/types";

function mapServiceRow(r: Record<string, unknown>): Service {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    nome: String(r.nome),
    preco: Number(r.preco),
    duracao_minutos: Number(r.duracao_minutos),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export default async function BarbeariaPublicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await tryCreateClient();
  if (!supabase) notFound();

  const { data: shop, error } = await supabase
    .from("barbershops")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !shop) notFound();

  const barbershop = shop as Barbershop;

  const { data: rawServices } = await supabase
    .from("services")
    .select("*")
    .eq("user_id", barbershop.user_id)
    .order("nome");

  const services = (rawServices ?? []).map((row) =>
    mapServiceRow(row as Record<string, unknown>)
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
          Agende seu horário
        </p>
        <h1 className="mt-3 font-display text-4xl font-bold">
          {barbershop.nome_barbearia}
        </h1>
        {barbershop.endereco ? (
          <p className="mt-2 text-sm text-[var(--muted)]">{barbershop.endereco}</p>
        ) : null}
      </div>

      <Card className="mt-10">
        <PublicBarbershop barbershop={barbershop} services={services} />
      </Card>
    </div>
  );
}
