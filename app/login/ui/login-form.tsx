"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabaseClient";
import { logAuthError, logSupabasePublicEnvDebug } from "@/lib/supabase/debug-env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    logSupabasePublicEnvDebug("login:before-signIn");

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch (cfgErr) {
      setLoading(false);
      logAuthError("login:createClient", cfgErr);
      toast.error(
        cfgErr instanceof Error
          ? cfgErr.message
          : "Configuração do Supabase inválida."
      );
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setLoading(false);

      if (error) {
        logAuthError("login:signIn", error);
        toast.error(error.message);
        return;
      }

      toast.success("Bem-vindo de volta!");
      const safe =
        redirectTo &&
        redirectTo.startsWith("/") &&
        !redirectTo.startsWith("//")
          ? redirectTo
          : "/dashboard";
      router.push(safe);
      router.refresh();
    } catch (err) {
      setLoading(false);
      logAuthError("login:signIn-exception", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Falha de rede. Verifique NEXT_PUBLIC_SUPABASE_URL e sua conexão."
      );
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Input name="email" type="email" label="E-mail" required autoComplete="email" />
      <Input
        name="password"
        type="password"
        label="Senha"
        required
        autoComplete="current-password"
      />
      <Button type="submit" className="w-full !py-3" disabled={loading}>
        {loading ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
