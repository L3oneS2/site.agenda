"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireBarber } from "@/lib/auth";

export async function createService(formData: FormData) {
  const { user } = await requireBarber();
  const nome = String(formData.get("nome") ?? "").trim();
  const preco = Number(formData.get("preco"));
  const duracao_minutos = Number(formData.get("duracao_minutos"));

  if (!nome) return { error: "Informe o nome do serviço." };
  if (!Number.isFinite(preco) || preco < 0) return { error: "Preço inválido." };
  if (!Number.isFinite(duracao_minutos) || duracao_minutos < 1 || duracao_minutos > 720) {
    return { error: "Duração deve ser entre 1 e 720 minutos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("services").insert({
    user_id: user.id,
    nome,
    preco,
    duracao_minutos,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  return { ok: true };
}

export async function updateService(formData: FormData) {
  const { user } = await requireBarber();
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const preco = Number(formData.get("preco"));
  const duracao_minutos = Number(formData.get("duracao_minutos"));

  if (!id) return { error: "Serviço inválido." };
  if (!nome) return { error: "Informe o nome do serviço." };
  if (!Number.isFinite(preco) || preco < 0) return { error: "Preço inválido." };
  if (!Number.isFinite(duracao_minutos) || duracao_minutos < 1 || duracao_minutos > 720) {
    return { error: "Duração deve ser entre 1 e 720 minutos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ nome, preco, duracao_minutos })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  return { ok: true };
}

export async function deleteService(id: string) {
  const { user } = await requireBarber();
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  return { ok: true };
}
