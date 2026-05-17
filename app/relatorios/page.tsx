import { requireBarber } from "@/lib/auth";
import { ReportsDashboard } from "./ui/reports-dashboard";

export default async function RelatoriosPage() {
  const { user } = await requireBarber();
  return <ReportsDashboard barberUserId={user.id} />;
}
