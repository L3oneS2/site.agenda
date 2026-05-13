"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabaseClient";
import { logAppDebug, logAuthError, logSupabasePublicEnvDebug } from "@/lib/supabase/debug-env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
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

      if (error) {
        logAuthError("login:signIn", error);
        toast.error(error.message);
        return;
      }

      const {
        data: { user: signedUser },
      } = await supabase.auth.getUser();
      if (!signedUser?.id) {
        toast.error("Sessão não criada. Tente novamente.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", signedUser.id)
        .maybeSingle();

      toast.success("Bem-vindo de volta!");

      const safeRedirect =
        redirectTo &&
        redirectTo.startsWith("/") &&
        !redirectTo.startsWith("//")
          ? redirectTo
          : null;

      const dest =
        profile?.role === "barber"
          ? safeRedirect ?? "/dashboard"
          : "/cliente";

      router.push(dest);
      router.refresh();
    } catch (err) {
      logAuthError("login:signIn-exception", err);
      logAppDebug("auth", "login exceção", {
        message: err instanceof Error ? err.message : String(err),
      });
      toast.error(
        err instanceof Error
          ? err.message
          : "Falha de rede. Verifique NEXT_PUBLIC_SUPABASE_URL e sua conexão."
      );
    } finally {
      setLoading(false);
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
