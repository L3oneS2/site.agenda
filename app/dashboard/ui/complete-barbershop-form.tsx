"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveBarbershopForCurrentUser } from "@/app/actions/barbershop";
import { logAppDebug } from "@/lib/supabase/debug-env";
import { DevicePayloadField } from "@/components/device-payload-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CompleteBarbershopForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deviceReady, setDeviceReady] = useState(false);

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const fd = new FormData(e.currentTarget);
        try {
          const r = await saveBarbershopForCurrentUser(fd);
          if (r.error) {
            toast.error(r.error);
            return;
          }
          if (r.trialEligible === false) {
            logAppDebug("bootstrap", "complete barbershop: trial não elegível", {});
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
        } catch (err) {
          logAppDebug("bootstrap", "saveBarbershopForCurrentUser exceção", {
            message: err instanceof Error ? err.message : String(err),
          });
          toast.error("Falha ao salvar. Tente novamente.");
        } finally {
          setLoading(false);
        }
      }}
    >
      <Input name="nome_barbearia" label="Nome da barbearia" required />
      <Input name="endereco" label="Endereço" />
      <DevicePayloadField onReadyChange={setDeviceReady} />
      <Button
        type="submit"
        className="w-full sm:w-auto"
        disabled={loading || !deviceReady}
        title={!deviceReady ? "Preparando identificador seguro…" : undefined}
      >
        {loading ? "Salvando…" : "Salvar barbearia"}
      </Button>
    </form>
  );
}
