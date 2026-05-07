"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveBarbershopForCurrentUser(
  formData: FormData
): Promise<{ ok?: boolean; error?: string }> {
  const nome_barbearia = String(formData.get("nome_barbearia") ?? "").trim();
  const endereco = String(formData.get("endereco") ?? "").trim();

  if (!nome_barbearia) {
    return { error: "Informe o nome da barbearia." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Faça login para cadastrar a barbearia." };
  }

  const { error } = await supabase.from("barbershops").insert({
    user_id: user.id,
    nome_barbearia,
    endereco,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Barbearia já cadastrada para esta conta." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true };
}
