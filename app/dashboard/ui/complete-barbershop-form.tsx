"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveBarbershopForCurrentUser } from "@/app/actions/barbershop";
import { DevicePayloadField } from "@/components/device-payload-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CompleteBarbershopForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const fd = new FormData(e.currentTarget);
        const r = await saveBarbershopForCurrentUser(fd);
        setLoading(false);
        if (r.error) {
          toast.error(r.error);
          return;
        }
        if (r.trialEligible === false) {
          toast.warning(
            "Não foi possível liberar novo teste gratuito com estes dados. Assine para continuar."
          );
          router.push("/assinatura?trial_denied=1");
          router.refresh();
          return;
        }
        toast.success("Barbearia cadastrada!");
        router.push("/dashboard");
        router.refresh();
      }}
    >
      <Input name="nome_barbearia" label="Nome da barbearia" required />
      <Input name="endereco" label="Endereço" />
      <DevicePayloadField />
      <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
        {loading ? "Salvando…" : "Salvar barbearia"}
      </Button>
    </form>
  );
}
