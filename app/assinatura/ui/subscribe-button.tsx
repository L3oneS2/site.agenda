"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

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
          const res = await fetch("/api/create-checkout", {
            method: "POST",
            credentials: "same-origin",
          });
          const data = (await res.json()) as { url?: string; error?: string };
          if (!res.ok) {
            toast.error(data.error ?? "Não foi possível iniciar o checkout.");
            return;
          }
          if (data.url) window.location.href = data.url;
          else toast.error("URL de checkout ausente.");
        } catch {
          toast.error("Erro de rede.");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Redirecionando…" : "Assinar agora"}
    </Button>
  );
}
