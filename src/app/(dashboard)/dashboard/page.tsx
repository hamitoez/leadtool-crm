import { auth } from "@/lib/auth";
import { CRMDashboard } from "@/components/dashboard";

export default async function DashboardPage() {
  const session = await auth();

  return <CRMDashboard userName={session?.user?.name || "User"} />;
}
