import { requireActiveSubscription, requireBarber } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireBarber();
  await requireActiveSubscription();
  return <>{children}</>;
}
