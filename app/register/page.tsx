import Link from "next/link";
import { RegisterForm } from "./ui/register-form";
import { Card } from "@/components/ui/card";

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center px-4 py-16">
      <Card className="w-full">
        <h1 className="font-display text-3xl font-bold">Criar conta</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Cadastro exclusivo para barbeiros. Clientes agendam pelo link público.
        </p>
        <div className="mt-8">
          <RegisterForm />
        </div>
        <p className="mt-6 text-center text-sm text-[var(--muted)]">
          Já possui conta?{" "}
          <Link href="/login" className="font-medium text-gold-600 hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}
