import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Get user's 2FA status
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      twoFactorEnabled: true,
      password: true,
    },
  });

  const twoFactorEnabled = user?.twoFactorEnabled ?? false;
  const hasPassword = !!user?.password;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground">
          Verwalte dein Konto und deine Anwendungseinstellungen
        </p>
      </div>

      <SettingsClient
        user={{
          name: session.user.name ?? null,
          email: session.user.email ?? null,
        }}
        twoFactorEnabled={twoFactorEnabled}
        hasPassword={hasPassword}
      />
    </div>
  );
}
