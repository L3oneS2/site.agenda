"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ClientQuickAccess() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  function goToBarbershop(raw: string) {
    const trimmed = raw.trim();
    let id = trimmed;

    const barbeariaMatch = trimmed.match(/\/barbearia\/([0-9a-f-]{36})/i);
    if (barbeariaMatch) {
      id = barbeariaMatch[1];
    }

    if (!UUID_RE.test(id)) {
      toast.error(
        "Cole o código da barbearia (UUID) ou o link completo enviado pelo seu barbeiro."
      );
      return false;
    }
    router.push(`/barbearia/${id}`);
    return true;
  }

  return (
    <form
      className="mx-auto mt-8 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-stretch"
      onSubmit={(e) => {
        e.preventDefault();
        setLoading(true);
        const ok = goToBarbershop(value);
        setLoading(false);
        if (ok) toast.success("Abrindo agenda…");
      }}
    >
      <input
        type="text"
        name="barbearia"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Cole o link ou o código da barbearia"
        autoComplete="off"
        className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--fg)] outline-none transition placeholder:text-[var(--muted)] focus:border-gold-500/60 focus:ring-2 focus:ring-gold-500/20"
        aria-label="Link ou código da barbearia"
      />
      <Button type="submit" className="shrink-0 !py-3 sm:!px-8" disabled={loading}>
        Acessar agenda
      </Button>
    </form>
  );
}
