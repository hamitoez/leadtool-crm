import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileForm, PasswordForm, ApiKeysForm } from "@/components/settings/settings-form";
import { TwoFactorForm } from "@/components/settings/two-factor-form";
import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";

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

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="security">Sicherheit</TabsTrigger>
          <TabsTrigger value="api">API Keys</TabsTrigger>
          <TabsTrigger value="notifications">Benachrichtigungen</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <ProfileForm
            user={{
              name: session.user.name ?? null,
              email: session.user.email ?? null,
            }}
          />
          {hasPassword && <PasswordForm />}
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <TwoFactorForm enabled={twoFactorEnabled} hasPassword={hasPassword} />
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <ApiKeysForm />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationSettingsForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
