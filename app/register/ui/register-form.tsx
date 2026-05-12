"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabaseClient";
import { finalizeBarberBootstrap } from "@/app/actions/bootstrap-barber";
import { logAppDebug, logAuthError, logClientDebug, logSupabasePublicEnvDebug } from "@/lib/supabase/debug-env";
import { DevicePayloadField } from "@/components/device-payload-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deviceReady, setDeviceReady] = useState(false);

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
        toast.error(error.message);
        return;
      }

      logClientDebug("auth", "signUp ok", {
        userId: data.user?.id ?? null,
        hasSession: Boolean(data.session),
      });

      if (data.session && data.user) {
        const r = await finalizeBarberBootstrap(new FormData(form));
        if (!r.ok) {
          logAuthError("register:bootstrap", new Error(r.error ?? "bootstrap"));
          logAppDebug("bootstrap", "finalizeBarberBootstrap falhou", {
            error: r.error ?? null,
          });
          toast.error(r.error ?? "Falha ao finalizar cadastro.");
          return;
        }
        if (r.alreadyInitialized) {
          toast.success("Conta pronta!");
          router.push("/dashboard");
          router.refresh();
          return;
        }
        if (r.trialEligible === false) {
          logAppDebug("bootstrap", "trial não elegível após bootstrap", {
            alreadyInitialized: r.alreadyInitialized,
          });
          toast.warning(
            "Este telefone, e-mail ou dispositivo/rede já utilizou o período gratuito. Assine para continuar."
          );
          router.push("/assinatura?trial_denied=1");
          router.refresh();
          return;
        }
        toast.success("Conta criada! Seu teste de 14 dias começou.");
        router.push("/dashboard");
        router.refresh();
        return;
      }

      toast.success(
        "Conta criada. Verifique seu e-mail para confirmar. Depois faça login e cadastre a barbearia no painel."
      );
      router.push("/login");
      router.refresh();
    } catch (err) {
      logAuthError("register:signUp-exception", err);
      logAppDebug("auth", "register exceção", {
        message: err instanceof Error ? err.message : String(err),
      });
      const msg =
        err instanceof Error
          ? err.message
          : "Falha de rede ao falar com o Supabase (fetch failed). Verifique a URL do projeto e sua conexão.";
      toast.error(msg);
    } finally {
      setLoading(false);
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
        minLength={10}
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
      <DevicePayloadField onReadyChange={setDeviceReady} />
      <Button
        type="submit"
        className="w-full !py-3"
        disabled={loading || !deviceReady}
        title={!deviceReady ? "Preparando identificador seguro…" : undefined}
      >
        {loading ? "Criando…" : "Criar conta"}
      </Button>
    </form>
  );
}
