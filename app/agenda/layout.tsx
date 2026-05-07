import { requireBarber, requireBarberAgendaAccess } from "@/lib/auth";

export default async function AgendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireBarber();
  await requireBarberAgendaAccess();
  return <>{children}</>;
}
