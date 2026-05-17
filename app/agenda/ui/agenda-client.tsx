"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  cancelBarberAppointment,
  getBarberAppointmentPublicLink,
  markBarberAppointmentNoShow,
} from "@/app/actions/barber";
import { logAppDebug } from "@/lib/supabase/debug-env";
import { Button } from "@/components/ui/button";

export function CancelAppointmentButton({
  id,
  className,
  label = "Cancelar agendamento",
}: {
  id: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  async function confirmCancel() {
    dialogRef.current?.close();
    setLoading(true);
    try {
      const r = await cancelBarberAppointment(id);
      if (r.error) {
        toast.error("Não foi possível cancelar. Tente novamente.");
      } else {
        toast.success("Agendamento cancelado com sucesso");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("agenda:appointments-changed"));
        }
        router.refresh();
      }
    } catch (err) {
      logAppDebug("agenda", "cancelBarberAppointment exceção", {
        message: err instanceof Error ? err.message : String(err),
      });
      toast.error("Não foi possível cancelar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={className ?? "!py-2 !px-3 text-xs"}
        disabled={loading}
        onClick={() => dialogRef.current?.showModal()}
      >
        {loading ? "Cancelando…" : label}
      </Button>
      <dialog
        ref={dialogRef}
        className="fixed left-1/2 top-1/2 z-50 max-h-[min(90dvh,24rem)] w-[min(calc(100vw-2rem),22rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 text-[var(--fg)] shadow-lg [&::backdrop]:fixed [&::backdrop]:inset-0 [&::backdrop]:bg-black/45"
      >
        <p className="text-sm font-medium">Cancelar este agendamento?</p>
        <p className="mt-2 text-xs text-[var(--muted)]">
          O horário volta a ficar disponível para novas reservas. Esta ação não pode
          ser desfeita.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="!py-2 !px-3 text-xs"
            disabled={loading}
            onClick={() => dialogRef.current?.close()}
          >
            Voltar
          </Button>
          <Button
            type="button"
            variant="danger"
            className="!py-2 !px-3 text-xs"
            disabled={loading}
            onClick={() => void confirmCancel()}
          >
            Confirmar cancelamento
          </Button>
        </div>
      </dialog>
    </>
  );
}

function dispatchAgendaChanged(router: ReturnType<typeof useRouter>) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("agenda:appointments-changed"));
  }
  router.refresh();
}

export function MarkAppointmentNoShowButton({
  id,
  className,
  label = "Não veio",
}: {
  id: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? "!py-2 !px-3 text-xs"}
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const r = await markBarberAppointmentNoShow(id);
          if (r.error) toast.error(r.error);
          else {
            toast.success("Marcado como não compareceu");
            dispatchAgendaChanged(router);
          }
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "…" : label}
    </Button>
  );
}

export function CopyAppointmentLinkButton({ appointmentId }: { appointmentId: string }) {
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
          const r = await getBarberAppointmentPublicLink(appointmentId);
          if ("error" in r) {
            toast.error(r.error);
            return;
          }
          const text =
            r.fullUrl ??
            (typeof window !== "undefined"
              ? `${window.location.origin}${r.path}`
              : r.path);
          await navigator.clipboard.writeText(text);
          toast.success("Link copiado para a área de transferência");
        } catch (err) {
          logAppDebug("agenda", "getBarberAppointmentPublicLink exceção", {
            message: err instanceof Error ? err.message : String(err),
          });
          toast.error("Não foi possível copiar o link.");
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? "…" : "Link do cliente"}
    </Button>
  );
}
