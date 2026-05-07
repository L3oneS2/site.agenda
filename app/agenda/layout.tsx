import { requireActiveSubscription, requireBarber } from "@/lib/auth";

export default async function AgendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireBarber();
  await requireActiveSubscription();
  return <>{children}</>;
}
