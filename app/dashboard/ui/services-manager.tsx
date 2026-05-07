"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createService, deleteService, updateService } from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Service } from "@/lib/types";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function ServicesManager({ initialServices }: { initialServices: Service[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="mt-6 space-y-6">
      <form
        className="grid gap-3 rounded-2xl border border-[var(--border)] bg-black/[0.02] p-4 dark:bg-white/[0.03] sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          const r = await createService(new FormData(e.currentTarget));
          setLoading(false);
          if (r.error) toast.error(r.error);
          else {
            toast.success("Serviço criado");
            e.currentTarget.reset();
            router.refresh();
          }
        }}
      >
        <p className="font-medium sm:col-span-2">Novo serviço</p>
        <Input name="nome" label="Nome" required placeholder="Ex.: Corte + barba" />
        <Input
          name="preco"
          label="Preço (R$)"
          type="number"
          step="0.01"
          min="0"
          required
        />
        <Input
          name="duracao_minutos"
          label="Duração (min)"
          type="number"
          min="1"
          max="720"
          required
          defaultValue="30"
          className="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <Button type="submit" disabled={loading}>
            Adicionar
          </Button>
        </div>
      </form>

      <ul className="space-y-3">
        {initialServices.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">
            Nenhum serviço. Adicione acima para aparecer na página pública.
          </li>
        ) : (
          initialServices.map((s) => (
            <li
              key={s.id}
              className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm"
            >
              {editingId === s.id ? (
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setLoading(true);
                    const fd = new FormData(e.currentTarget);
                    fd.set("id", s.id);
                    const r = await updateService(fd);
                    setLoading(false);
                    if (r.error) toast.error(r.error);
                    else {
                      toast.success("Serviço atualizado");
                      setEditingId(null);
                      router.refresh();
                    }
                  }}
                >
                  <input type="hidden" name="id" value={s.id} />
                  <Input name="nome" label="Nome" required defaultValue={s.nome} />
                  <Input
                    name="preco"
                    label="Preço (R$)"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    defaultValue={String(s.preco)}
                  />
                  <Input
                    name="duracao_minutos"
                    label="Duração (min)"
                    type="number"
                    min="1"
                    max="720"
                    required
                    defaultValue={String(s.duracao_minutos)}
                    className="sm:col-span-2"
                  />
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <Button type="submit" className="!py-2 !px-4" disabled={loading}>
                      Salvar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="!py-2 !px-4"
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{s.nome}</p>
                    <p className="text-[var(--muted)]">
                      {brl.format(s.preco)} · ⏱ {s.duracao_minutos} min
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="!py-2 !px-4"
                      onClick={() => setEditingId(s.id)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="!py-2 !px-4"
                      onClick={async () => {
                        if (!confirm("Excluir este serviço?")) return;
                        const r = await deleteService(s.id);
                        if (r.error) toast.error(r.error);
                        else {
                          toast.success("Removido");
                          router.refresh();
                        }
                      }}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
