"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Loader2, Mail, Server, Shield, Eye, EyeOff, Gauge } from "lucide-react";

interface EmailAccountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: {
    id: string;
    name: string;
    email: string;
    accountType: string;
    isDefault: boolean;
    isActive: boolean;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpSecure: boolean;
    smtpUser: string | null;
    imapHost: string | null;
    imapPort: number | null;
    imapSecure: boolean;
    imapUser: string | null;
    syncEnabled: boolean;
    signature: string | null;
    dailyLimit?: number;
  } | null;
  onSuccess?: () => void;
}

export function EmailAccountForm({
  open,
  onOpenChange,
  account,
  onSuccess,
}: EmailAccountFormProps) {
  const isEdit = !!account;
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [name, setName] = useState(account?.name || "");
  const [email, setEmail] = useState(account?.email || "");
  const [accountType, setAccountType] = useState(account?.accountType || "SMTP_IMAP");
  const [isDefault, setIsDefault] = useState(account?.isDefault || false);
  const [isActive, setIsActive] = useState(account?.isActive ?? true);

  // SMTP
  const [smtpHost, setSmtpHost] = useState(account?.smtpHost || "");
  const [smtpPort, setSmtpPort] = useState(account?.smtpPort || 587);
  const [smtpSecure, setSmtpSecure] = useState(account?.smtpSecure ?? true);
  const [smtpUser, setSmtpUser] = useState(account?.smtpUser || "");
  const [smtpPassword, setSmtpPassword] = useState("");

  // IMAP
  const [imapHost, setImapHost] = useState(account?.imapHost || "");
  const [imapPort, setImapPort] = useState(account?.imapPort || 993);
  const [imapSecure, setImapSecure] = useState(account?.imapSecure ?? true);
  const [imapUser, setImapUser] = useState(account?.imapUser || "");
  const [imapPassword, setImapPassword] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(account?.syncEnabled ?? true);

  // Signature
  const [signature, setSignature] = useState(account?.signature || "");

  // Marketing Settings
  const [dailyLimit, setDailyLimit] = useState(account?.dailyLimit || 50);

  // Reset form when dialog opens or account changes
  useEffect(() => {
    if (open) {
      setName(account?.name || "");
      setEmail(account?.email || "");
      setAccountType(account?.accountType || "SMTP_IMAP");
      setIsDefault(account?.isDefault || false);
      setIsActive(account?.isActive ?? true);
      setSmtpHost(account?.smtpHost || "");
      setSmtpPort(account?.smtpPort || 587);
      setSmtpSecure(account?.smtpSecure ?? true);
      setSmtpUser(account?.smtpUser || "");
      setSmtpPassword("");
      setImapHost(account?.imapHost || "");
      setImapPort(account?.imapPort || 993);
      setImapSecure(account?.imapSecure ?? true);
      setImapUser(account?.imapUser || "");
      setImapPassword("");
      setSyncEnabled(account?.syncEnabled ?? true);
      setSignature(account?.signature || "");
      setDailyLimit(account?.dailyLimit || 50);
      setShowPassword(false);
    }
  }, [open, account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim()) {
      toast.error("Bitte fuellen Sie alle Pflichtfelder aus");
      return;
    }

    setLoading(true);

    try {
      const url = isEdit ? `/api/email/accounts/${account.id}` : "/api/email/accounts";
      const method = isEdit ? "PATCH" : "POST";

      const payload: Record<string, unknown> = {
          name: name.trim(),
          email: email.trim(),
          accountType,
          isDefault,
          isActive,
        };

        // Only add SMTP fields if host is provided
        if (smtpHost.trim()) {
          payload.smtpHost = smtpHost.trim();
          payload.smtpPort = smtpPort || 587;
          payload.smtpSecure = smtpSecure;
          payload.smtpUser = smtpUser.trim() || undefined;
          if (smtpPassword) payload.smtpPassword = smtpPassword;
        }

        // Only add IMAP fields if sync is enabled and host is provided
        if (syncEnabled && imapHost.trim()) {
          payload.imapHost = imapHost.trim();
          payload.imapPort = imapPort || 993;
          payload.imapSecure = imapSecure;
          payload.imapUser = imapUser.trim() || undefined;
          if (imapPassword) payload.imapPassword = imapPassword;
        }

        if (signature.trim()) {
          payload.signature = signature.trim();
        }

        // Marketing settings
        payload.dailyLimit = dailyLimit;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Fehler beim Speichern");
      }

      toast.success(isEdit ? "E-Mail-Konto aktualisiert" : "E-Mail-Konto erstellt");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving email account:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {isEdit ? "E-Mail-Konto bearbeiten" : "Neues E-Mail-Konto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general">Allgemein</TabsTrigger>
              <TabsTrigger value="smtp">SMTP</TabsTrigger>
              <TabsTrigger value="imap">IMAP</TabsTrigger>
              <TabsTrigger value="marketing">Limits</TabsTrigger>
              <TabsTrigger value="signature">Signatur</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Kontoname *</Label>
                <Input
                  id="name"
                  placeholder="z.B. Firmen-E-Mail"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-Mail-Adresse *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ihre@email.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Kontotyp</Label>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMTP_IMAP">SMTP/IMAP</SelectItem>
                    <SelectItem value="GMAIL" disabled>Gmail (bald verfuegbar)</SelectItem>
                    <SelectItem value="OUTLOOK" disabled>Outlook (bald verfuegbar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Standardkonto</Label>
                  <p className="text-sm text-muted-foreground">
                    Als Standard fuer neue E-Mails verwenden
                  </p>
                </div>
                <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Aktiv</Label>
                  <p className="text-sm text-muted-foreground">
                    Konto fuer E-Mail-Versand aktivieren
                  </p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </TabsContent>

            {/* SMTP Tab */}
            <TabsContent value="smtp" className="space-y-4 mt-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-sm">
                <div className="flex items-center gap-2 font-medium text-blue-800 dark:text-blue-200 mb-1">
                  <Server className="h-4 w-4" />
                  SMTP-Einstellungen (zum Senden)
                </div>
                <p className="text-blue-700 dark:text-blue-300">
                  Diese Einstellungen benoetigen Sie, um E-Mails zu senden.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP-Server</Label>
                  <Input
                    id="smtpHost"
                    placeholder="smtp.example.com"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="smtpPort">Port</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    placeholder="587"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpUser">Benutzername</Label>
                <Input
                  id="smtpUser"
                  placeholder="ihre@email.de"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="smtpPassword">Passwort</Label>
                <div className="relative">
                  <Input
                    id="smtpPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={isEdit ? "Neues Passwort (leer lassen um zu behalten)" : "SMTP-Passwort"}
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    TLS/SSL
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Sichere Verbindung verwenden (empfohlen)
                  </p>
                </div>
                <Switch checked={smtpSecure} onCheckedChange={setSmtpSecure} />
              </div>
            </TabsContent>

            {/* IMAP Tab */}
            <TabsContent value="imap" className="space-y-4 mt-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md text-sm">
                <div className="flex items-center gap-2 font-medium text-purple-800 dark:text-purple-200 mb-1">
                  <Server className="h-4 w-4" />
                  IMAP-Einstellungen (zum Empfangen)
                </div>
                <p className="text-purple-700 dark:text-purple-300">
                  Diese Einstellungen benoetigen Sie, um E-Mails zu empfangen (optional).
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>E-Mail-Sync aktivieren</Label>
                  <p className="text-sm text-muted-foreground">
                    Eingehende E-Mails automatisch abrufen
                  </p>
                </div>
                <Switch checked={syncEnabled} onCheckedChange={setSyncEnabled} />
              </div>

              {syncEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="imapHost">IMAP-Server</Label>
                      <Input
                        id="imapHost"
                        placeholder="imap.example.com"
                        value={imapHost}
                        onChange={(e) => setImapHost(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="imapPort">Port</Label>
                      <Input
                        id="imapPort"
                        type="number"
                        placeholder="993"
                        value={imapPort}
                        onChange={(e) => setImapPort(parseInt(e.target.value) || 993)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="imapUser">Benutzername</Label>
                    <Input
                      id="imapUser"
                      placeholder="ihre@email.de"
                      value={imapUser}
                      onChange={(e) => setImapUser(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="imapPassword">Passwort</Label>
                    <Input
                      id="imapPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder={isEdit ? "Neues Passwort (leer lassen um zu behalten)" : "IMAP-Passwort"}
                      value={imapPassword}
                      onChange={(e) => setImapPassword(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Bei Gmail: App-Passwort verwenden (Google Konto → Sicherheit → App-Passwoerter)
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        TLS/SSL
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Sichere Verbindung verwenden
                      </p>
                    </div>
                    <Switch checked={imapSecure} onCheckedChange={setImapSecure} />
                  </div>
                </>
              )}
            </TabsContent>

            {/* Marketing Tab */}
            <TabsContent value="marketing" className="space-y-4 mt-4">
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md text-sm">
                <div className="flex items-center gap-2 font-medium text-orange-800 dark:text-orange-200 mb-1">
                  <Gauge className="h-4 w-4" />
                  Sende-Limits
                </div>
                <p className="text-orange-700 dark:text-orange-300">
                  Begrenzen Sie die Anzahl der E-Mails pro Tag, um Ihre Absender-Reputation zu schuetzen.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Taegliches Limit</Label>
                    <span className="text-lg font-bold">{dailyLimit} E-Mails/Tag</span>
                  </div>
                  <Slider
                    value={[dailyLimit]}
                    onValueChange={([value]) => setDailyLimit(value)}
                    min={10}
                    max={500}
                    step={10}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>10</span>
                    <span>100</span>
                    <span>250</span>
                    <span>500</span>
                  </div>
                </div>

                <div className="p-3 bg-muted/50 rounded-md text-sm">
                  <p className="font-medium mb-2">Empfohlene Limits:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Neues Konto: 20-50 E-Mails/Tag</li>
                    <li>• Aufgewaermtes Konto: 50-100 E-Mails/Tag</li>
                    <li>• Etabliertes Konto: 100-200 E-Mails/Tag</li>
                    <li>• Premium-Provider: bis 500 E-Mails/Tag</li>
                  </ul>
                </div>

                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <Gauge className="h-4 w-4" />
                  <span>Zu hohe Limits koennen zu Spam-Markierungen fuehren</span>
                </div>
              </div>
            </TabsContent>

            {/* Signature Tab */}
            <TabsContent value="signature" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="signature">E-Mail-Signatur</Label>
                <Textarea
                  id="signature"
                  placeholder="Mit freundlichen Gruessen&#10;Ihr Name&#10;Firma GmbH&#10;Tel: +49..."
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Diese Signatur wird automatisch am Ende jeder E-Mail eingefuegt.
                  HTML wird unterstuetzt.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                isEdit ? "Speichern" : "Konto erstellen"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
