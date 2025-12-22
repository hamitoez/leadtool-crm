import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TeamSettings } from "@/components/team/team-settings";

export default async function TeamPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Team</h1>
        <p className="text-muted-foreground">
          Verwalte deine Organisationen und Teammitglieder
        </p>
      </div>

      <TeamSettings />
    </div>
  );
}
