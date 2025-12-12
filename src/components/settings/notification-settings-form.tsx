"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, Mail, Globe, FileDown, AlertTriangle } from "lucide-react";

interface NotificationSettings {
  notifyScrapingComplete: boolean;
  notifyScrapingFailed: boolean;
  notifyImportComplete: boolean;
  notifyImportFailed: boolean;
  emailNotifications: boolean;
}

const defaultSettings: NotificationSettings = {
  notifyScrapingComplete: true,
  notifyScrapingFailed: true,
  notifyImportComplete: true,
  notifyImportFailed: true,
  emailNotifications: false,
};

export function NotificationSettingsForm() {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<NotificationSettings>(defaultSettings);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/notifications/settings");
        if (response.ok) {
          const data = await response.json();
          setSettings(data.settings);
          setOriginalSettings(data.settings);
        }
      } catch (error) {
        console.error("Failed to load notification settings:", error);
        toast.error("Fehler beim Laden der Einstellungen");
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Check for changes
  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  const handleToggle = (key: keyof NotificationSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setOriginalSettings(settings);
      setHasChanges(false);
      toast.success("Benachrichtigungseinstellungen gespeichert");
    } catch (error) {
      console.error("Failed to save notification settings:", error);
      toast.error("Fehler beim Speichern der Einstellungen");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(originalSettings);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* In-App Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            In-App Benachrichtigungen
          </CardTitle>
          <CardDescription>
            Wähle welche Benachrichtigungen du in der App erhalten möchtest
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Scraping Notifications */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Globe className="h-4 w-4" />
              Web Scraping
            </div>

            <div className="ml-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="scraping-complete" className="font-normal">
                    Scraping abgeschlossen
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Benachrichtigung wenn Kontaktdaten erfolgreich extrahiert wurden
                  </p>
                </div>
                <Switch
                  id="scraping-complete"
                  checked={settings.notifyScrapingComplete}
                  onCheckedChange={() => handleToggle("notifyScrapingComplete")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="scraping-failed" className="font-normal flex items-center gap-2">
                    Scraping fehlgeschlagen
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Benachrichtigung wenn ein Scraping-Vorgang fehlschlägt
                  </p>
                </div>
                <Switch
                  id="scraping-failed"
                  checked={settings.notifyScrapingFailed}
                  onCheckedChange={() => handleToggle("notifyScrapingFailed")}
                />
              </div>
            </div>
          </div>

          {/* Import Notifications */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <FileDown className="h-4 w-4" />
              Daten-Import
            </div>

            <div className="ml-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="import-complete" className="font-normal">
                    Import abgeschlossen
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Benachrichtigung wenn Leads erfolgreich importiert wurden
                  </p>
                </div>
                <Switch
                  id="import-complete"
                  checked={settings.notifyImportComplete}
                  onCheckedChange={() => handleToggle("notifyImportComplete")}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="import-failed" className="font-normal flex items-center gap-2">
                    Import fehlgeschlagen
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Benachrichtigung wenn ein Import fehlschlägt
                  </p>
                </div>
                <Switch
                  id="import-failed"
                  checked={settings.notifyImportFailed}
                  onCheckedChange={() => handleToggle("notifyImportFailed")}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            E-Mail Benachrichtigungen
          </CardTitle>
          <CardDescription>
            Erhalte wichtige Benachrichtigungen auch per E-Mail
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications" className="font-normal">
                E-Mail Benachrichtigungen aktivieren
              </Label>
              <p className="text-sm text-muted-foreground">
                Du erhältst E-Mails für alle aktivierten Benachrichtigungen
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={settings.emailNotifications}
              onCheckedChange={() => handleToggle("emailNotifications")}
            />
          </div>

          {settings.emailNotifications && (
            <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                E-Mails werden an deine registrierte E-Mail-Adresse gesendet.
                Du kannst diese Einstellung jederzeit ändern.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="flex items-center justify-end gap-3 sticky bottom-4 bg-background/80 backdrop-blur-sm p-4 rounded-lg border shadow-lg">
          <p className="text-sm text-muted-foreground mr-auto">
            Du hast ungespeicherte Änderungen
          </p>
          <Button variant="outline" onClick={handleReset} disabled={isSaving}>
            Zurücksetzen
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </div>
      )}
    </div>
  );
}
