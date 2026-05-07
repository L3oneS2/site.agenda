import { requireBarber } from "@/lib/auth";

export default async function AssinaturaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireBarber();
  return <>{children}</>;
}
