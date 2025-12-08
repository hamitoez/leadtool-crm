import { auth } from "@/lib/auth";
import { DashboardClient } from "@/components/dashboard";

export default async function DashboardPage() {
  const session = await auth();

  return <DashboardClient userName={session?.user?.name || "User"} />;
}
