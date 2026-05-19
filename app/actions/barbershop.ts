"use server";

import { revalidatePath } from "next/cache";
import { finalizeBarberBootstrap } from "@/app/actions/bootstrap-barber";
import { requireBarber } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { barberWriteDeniedMessage } from "@/lib/barber-write-guard";

export async function saveBarbershopForCurrentUser(
  formData: FormData
): Promise<{ ok?: boolean; error?: string; trialEligible?: boolean }> {
  const nome_barbearia = String(formData.get("nome_barbearia") ?? "").trim();
  const endereco = String(formData.get("endereco") ?? "").trim();

  if (!nome_barbearia) {
    return { error: "Informe o nome da barbearia." };
  }

  const { user } = await requireBarber();
  const supabase = await createClient();

  const { data: subRow } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subRow) {
    const r = await finalizeBarberBootstrap(formData);
    if (!r.ok) return { error: r.error ?? "Falha ao finalizar cadastro." };
    return {
      ok: true,
      trialEligible: r.trialEligible ?? true,
    };
  }

  const denied = await barberWriteDeniedMessage();
  if (denied) return { error: denied };

  const { error } = await supabase.from("barbershops").upsert(
    {
      user_id: user.id,
      nome_barbearia,
      endereco: endereco ?? "",
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
