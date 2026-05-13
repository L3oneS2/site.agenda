"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { cancelAppointment } from "@/app/actions/barber";
import { logAppDebug } from "@/lib/supabase/debug-env";
import { Button } from "@/components/ui/button";

export function CancelAppointmentButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className="!py-2 !px-3 text-xs"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const r = await cancelAppointment(id);
          if (r.error) toast.error(r.error);
          else {
            toast.success("Agendamento cancelado");
            router.refresh();
          }
        } catch (err) {
          logAppDebug("agenda", "cancelAppointment exceção", {
            message: err instanceof Error ? err.message : String(err),
          });
          toast.error("Falha ao cancelar. Tente novamente.");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "Cancelando…" : "Cancelar"}
    </Button>
  );
}
