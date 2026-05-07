"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabaseClient";
import { logAuthError, logSupabasePublicEnvDebug } from "@/lib/supabase/debug-env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const nome = String(fd.get("nome") ?? "").trim();
    const telefone = String(fd.get("telefone") ?? "").trim();
    const nome_barbearia = String(fd.get("nome_barbearia") ?? "").trim();
    const endereco = String(fd.get("endereco") ?? "").trim();

    logSupabasePublicEnvDebug("register:before-signUp");

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch (cfgErr) {
      setLoading(false);
      logAuthError("register:createClient", cfgErr);
      toast.error(
        cfgErr instanceof Error
          ? cfgErr.message
          : "Configuração do Supabase inválida. Verifique .env.local."
      );
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${window.location.origin}/login`
              : undefined,
          data: {
            nome,
            telefone,
            role: "barber",
          },
        },
      });

      if (error) {
        logAuthError("register:signUp", error);
        setLoading(false);
        toast.error(error.message);
        return;
      }

      // eslint-disable-next-line no-console
      console.log("[register] signUp ok", {
        userId: data.user?.id ?? null,
        hasSession: Boolean(data.session),
      });

      if (data.session && data.user) {
        const { error: shopError } = await supabase.from("barbershops").insert({
          user_id: data.user.id,
          nome_barbearia,
          endereco,
        });

        if (shopError) {
          logAuthError("register:barbershop-insert", shopError);
          setLoading(false);
          toast.error(shopError.message);
          return;
        }

        toast.success("Conta criada! Redirecionando…");
        router.push("/assinatura");
        router.refresh();
        setLoading(false);
        return;
      }

      toast.success(
        "Conta criada. Verifique seu e-mail para confirmar. Depois faça login e cadastre a barbearia no painel."
      );
      router.push("/login");
      router.refresh();
    } catch (err) {
      logAuthError("register:signUp-exception", err);
      setLoading(false);
      const msg =
        err instanceof Error
          ? err.message
          : "Falha de rede ao falar com o Supabase (fetch failed). Verifique a URL do projeto e sua conexão.";
      toast.error(msg);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input name="nome" label="Seu nome" required autoComplete="name" />
      <Input
        name="telefone"
        label="Telefone (WhatsApp)"
        required
        autoComplete="tel"
      />
      <Input name="nome_barbearia" label="Nome da barbearia" required />
      <Input name="endereco" label="Endereço" />
      <Input name="email" type="email" label="E-mail" required autoComplete="email" />
      <Input
        name="password"
        type="password"
        label="Senha"
        required
        autoComplete="new-password"
        minLength={6}
      />
      <Button type="submit" className="w-full !py-3" disabled={loading}>
        {loading ? "Criando…" : "Criar conta"}
      </Button>
    </form>
  );
}
