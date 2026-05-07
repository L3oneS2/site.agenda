import { requireBarber, requireBarberDashboardAccess } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireBarber();
  await requireBarberDashboardAccess();
  return <>{children}</>;
}
