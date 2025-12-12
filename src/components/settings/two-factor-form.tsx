"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Copy,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface TwoFactorFormProps {
  enabled: boolean;
  hasPassword: boolean;
}

export function TwoFactorForm({ enabled, hasPassword }: TwoFactorFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Setup state
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCode: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Disable state
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");

  async function handleStartSetup() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/2fa/setup", {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Fehler beim Setup");
        return;
      }

      const data = await response.json();
      setSetupData(data);
      setShowSetup(true);
    } catch {
      toast.error("Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifySetup() {
    if (!setupData || verifyCode.length !== 6) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: setupData.secret,
          code: verifyCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Verifizierung fehlgeschlagen");
        return;
      }

      setBackupCodes(data.backupCodes);
      setShowSetup(false);
      setShowBackupCodes(true);
      toast.success("2FA wurde erfolgreich aktiviert!");
    } catch {
      toast.error("Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDisable() {
    if (disableCode.length !== 6) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: disablePassword,
          code: disableCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Deaktivierung fehlgeschlagen");
        return;
      }

      setShowDisable(false);
      setDisablePassword("");
      setDisableCode("");
      toast.success("2FA wurde deaktiviert");
      router.refresh();
    } catch {
      toast.error("Ein Fehler ist aufgetreten");
    } finally {
      setIsLoading(false);
    }
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("Backup-Codes kopiert!");
  }

  function closeBackupCodes() {
    setShowBackupCodes(false);
    setBackupCodes([]);
    setSetupData(null);
    setVerifyCode("");
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Zwei-Faktor-Authentifizierung
          </CardTitle>
          <CardDescription>
            Schütze dein Konto mit einer zusätzlichen Sicherheitsebene
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {enabled ? (
                <>
                  <div className="rounded-full bg-green-100 p-2 dark:bg-green-900">
                    <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">2FA ist aktiviert</p>
                    <p className="text-sm text-muted-foreground">
                      Dein Konto ist durch 2FA geschützt
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900">
                    <ShieldOff className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium">2FA ist deaktiviert</p>
                    <p className="text-sm text-muted-foreground">
                      Aktiviere 2FA für mehr Sicherheit
                    </p>
                  </div>
                </>
              )}
            </div>

            {enabled ? (
              <Button
                variant="destructive"
                onClick={() => setShowDisable(true)}
              >
                Deaktivieren
              </Button>
            ) : (
              <Button onClick={handleStartSetup} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aktivieren
              </Button>
            )}
          </div>

          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>
              Mit 2FA musst du bei jedem Login zusätzlich zu deinem Passwort
              einen 6-stelligen Code aus einer Authenticator-App eingeben
              (z.B. Google Authenticator, Authy, 1Password).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={showSetup} onOpenChange={setShowSetup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>2FA einrichten</DialogTitle>
            <DialogDescription>
              Scanne den QR-Code mit deiner Authenticator-App
            </DialogDescription>
          </DialogHeader>

          {setupData && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={setupData.qrCode}
                  alt="QR Code"
                  className="rounded-lg border"
                />
              </div>

              <div className="space-y-2">
                <Label>Oder gib diesen Code manuell ein:</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono">
                    {setupData.secret}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(setupData.secret);
                      toast.success("Secret kopiert!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verify-code">Verifizierungscode</Label>
                <Input
                  id="verify-code"
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Gib den 6-stelligen Code aus deiner Authenticator-App ein
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetup(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleVerifySetup}
              disabled={verifyCode.length !== 6 || isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verifizieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodes} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              2FA aktiviert
            </DialogTitle>
            <DialogDescription>
              Speichere diese Backup-Codes an einem sicheren Ort
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Wichtig!</AlertTitle>
            <AlertDescription>
              Diese Codes werden nur einmal angezeigt. Speichere sie jetzt!
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-2 rounded-lg border p-4">
            {backupCodes.map((code, index) => (
              <code key={index} className="text-center font-mono text-sm">
                {code}
              </code>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            Verwende diese Codes, wenn du keinen Zugriff auf deine
            Authenticator-App hast. Jeder Code kann nur einmal verwendet werden.
          </p>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={copyBackupCodes} variant="outline" className="w-full">
              <Copy className="mr-2 h-4 w-4" />
              Backup-Codes kopieren
            </Button>
            <Button onClick={closeBackupCodes} className="w-full">
              Ich habe die Codes gespeichert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={showDisable} onOpenChange={setShowDisable}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>2FA deaktivieren</DialogTitle>
            <DialogDescription>
              Bestätige deine Identität, um 2FA zu deaktivieren
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {hasPassword && (
              <div className="space-y-2">
                <Label htmlFor="disable-password">Passwort</Label>
                <Input
                  id="disable-password"
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  placeholder="Dein Passwort"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="disable-code">2FA-Code</Label>
              <Input
                id="disable-code"
                placeholder="000000"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Code aus deiner Authenticator-App
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisable(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={disableCode.length !== 6 || (hasPassword && !disablePassword) || isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deaktivieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
