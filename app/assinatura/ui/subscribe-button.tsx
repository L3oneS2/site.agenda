"use client";

import { useState } from "react";
import { toast } from "sonner";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { Button } from "@/components/ui/button";

const CHECKOUT_FETCH_MS = 30_000;

export function SubscribeButton() {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      type="button"
      className="!px-8"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetchWithTimeout(
            "/api/create-checkout",
            {
              method: "POST",
              credentials: "same-origin",
            },
            CHECKOUT_FETCH_MS
          );
          let data: { ok?: boolean; url?: string; error?: string };
          try {
            data = (await res.json()) as { ok?: boolean; url?: string; error?: string };
          } catch {
            toast.error(
              res.ok
                ? "Resposta inválida do servidor (JSON)."
                : `Falha ao processar resposta (${res.status}).`
            );
            return;
          }
          if (!res.ok) {
            toast.error(data.error ?? "Não foi possível iniciar o checkout.");
            return;
          }
          if (data.url) window.location.href = data.url;
          else toast.error("URL de checkout ausente.");
        } catch (err) {
          const aborted =
            err instanceof DOMException && err.name === "AbortError";
          toast.error(
            aborted
              ? "A conexão demorou demais. Verifique a rede e tente de novo."
              : err instanceof Error
                ? err.message
                : "Erro de rede ao iniciar checkout."
          );
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Redirecionando…" : "Assinar agora"}
    </Button>
  );
}
