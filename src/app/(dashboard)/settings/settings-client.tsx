"use client";

import { useState } from "react";
import { SettingsLayout } from "@/components/settings/settings-layout";
import { ProfileForm, PasswordForm, ApiKeysForm } from "@/components/settings/settings-form";
import { TwoFactorForm } from "@/components/settings/two-factor-form";
import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { CallScriptsSettings } from "@/components/call-scripts/call-scripts-settings";
import { NoteTemplatesSettings } from "@/components/notes/note-templates-settings";
import { ApiKeysSettings } from "@/components/settings/api-keys-settings";
import { WebhookSettings } from "@/components/settings/webhook-settings";
import { InboundEmailSettings } from "@/components/settings/inbound-email-settings";

interface SettingsClientProps {
  user: {
    name: string | null;
    email: string | null;
  };
  twoFactorEnabled: boolean;
  hasPassword: boolean;
}

export function SettingsClient({
  user,
  twoFactorEnabled,
  hasPassword,
}: SettingsClientProps) {
  const [activeSection, setActiveSection] = useState("profile");

  const renderContent = () => {
    switch (activeSection) {
      case "profile":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Profil</h2>
              <p className="text-sm text-muted-foreground">
                Verwalte deine persönlichen Daten
              </p>
            </div>
            <ProfileForm user={user} />
            {hasPassword && (
              <>
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium mb-4">Passwort ändern</h3>
                  <PasswordForm />
                </div>
              </>
            )}
          </div>
        );

      case "security":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Sicherheit</h2>
              <p className="text-sm text-muted-foreground">
                Zwei-Faktor-Authentifizierung und Sicherheitsoptionen
              </p>
            </div>
            <TwoFactorForm enabled={twoFactorEnabled} hasPassword={hasPassword} />
          </div>
        );

      case "ai":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">KI-Anbieter</h2>
              <p className="text-sm text-muted-foreground">
                Konfiguriere deinen bevorzugten KI-Anbieter für automatische Datenextraktion
              </p>
            </div>
            <ApiKeysForm />
          </div>
        );

      case "inbound-email":
        return <InboundEmailSettings />;

      case "api-keys":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">API-Schlüssel</h2>
              <p className="text-sm text-muted-foreground">
                Erstelle und verwalte API-Schlüssel für externe Integrationen
              </p>
            </div>
            <ApiKeysSettings />
          </div>
        );

      case "webhooks":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Webhooks</h2>
              <p className="text-sm text-muted-foreground">
                Sende Events an externe Dienste wie Zapier oder Make.com
              </p>
            </div>
            <WebhookSettings />
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Benachrichtigungen</h2>
              <p className="text-sm text-muted-foreground">
                Konfiguriere wann und wie du benachrichtigt wirst
              </p>
            </div>
            <NotificationSettingsForm />
          </div>
        );

      case "call-scripts":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Anruf-Scripts</h2>
              <p className="text-sm text-muted-foreground">
                Erstelle Gesprächsleitfäden für Vertriebsanrufe
              </p>
            </div>
            <CallScriptsSettings />
          </div>
        );

      case "note-templates":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Notiz-Vorlagen</h2>
              <p className="text-sm text-muted-foreground">
                Erstelle wiederverwendbare Vorlagen für Notizen
              </p>
            </div>
            <NoteTemplatesSettings />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <SettingsLayout
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      {renderContent()}
    </SettingsLayout>
  );
}
