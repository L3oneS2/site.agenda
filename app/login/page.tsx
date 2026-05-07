import Link from "next/link";
import { LoginForm } from "./ui/login-form";
import { Card } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const sp = await searchParams;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-16">
      <Card className="w-full">
        <h1 className="font-display text-3xl font-bold">Entrar</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Acesso ao painel do barbeiro.
        </p>
        <div className="mt-8">
          <LoginForm redirectTo={sp.redirect} />
        </div>
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          Novo por aqui?{" "}
          <Link
            href="/register"
            className="font-medium text-gold-600 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </Card>
    </div>
  );
}
