"use client";

/**
 * Inbound Email Settings Component
 *
 * Allows users to configure Mailgun/SendGrid/Postmark for
 * near-realtime reply detection via webhooks.
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  ExternalLink,
  Mail,
  Zap,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

interface InboundSettings {
  id: string;
  provider: string;
  isActive: boolean;
  isVerified: boolean;
  inboundDomain: string | null;
  mailgunRegion: string | null;
  hasApiKey: boolean;
  hasWebhookSecret: boolean;
  webhookUrl: string | null;
  lastWebhookAt: string | null;
  totalReceived: number;
  totalProcessed: number;
  totalFailed: number;
  verificationError: string | null;
}

interface VerificationResult {
  success: boolean;
  apiKeyValid: boolean;
  mxRecordsValid: boolean;
  errors: string[];
  details: {
    provider: string;
    domain: string;
    expectedMx?: string[];
    actualMx?: string[];
  };
}

export function InboundEmailSettings() {
  const [settings, setSettings] = useState<InboundSettings | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  // Form state
  const [provider, setProvider] = useState<string>("NONE");
  const [inboundDomain, setInboundDomain] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [webhookSecret, setWebhookSecret] = useState<string>("");
  const [mailgunRegion, setMailgunRegion] = useState<string>("EU");
  const [isActive, setIsActive] = useState<boolean>(false);

  // Load settings
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/organizations/inbound-email");
      const data = await response.json();

      if (data.settings) {
        setSettings(data.settings);
        setProvider(data.settings.provider || "NONE");
        setInboundDomain(data.settings.inboundDomain || "");
        setMailgunRegion(data.settings.mailgunRegion || "EU");
        setIsActive(data.settings.isActive || false);
      }
      setWebhookUrl(data.webhookUrl || "");
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error("Fehler beim Laden der Einstellungen");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/organizations/inbound-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          inboundDomain,
          apiKey: apiKey || undefined,
          webhookSecret: webhookSecret || undefined,
          mailgunRegion,
          isActive,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        setApiKey(""); // Clear sensitive fields
        setWebhookSecret("");
        toast.success("Einstellungen gespeichert");
      } else {
        const error = await response.json();
        toast.error(error.error || "Fehler beim Speichern");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerificationResult(null);
    try {
      const response = await fetch("/api/organizations/inbound-email/verify", {
        method: "POST",
      });
      const result = await response.json();
      setVerificationResult(result);

      if (result.success) {
        toast.success("Konfiguration erfolgreich verifiziert!");
        loadSettings(); // Reload to update isVerified
      } else {
        toast.error("Verifizierung fehlgeschlagen");
      }
    } catch (error) {
      console.error("Verification failed:", error);
      toast.error("Verifizierung fehlgeschlagen");
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("In Zwischenablage kopiert");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium">Inbound E-Mail (Reply Detection)</h3>
        <p className="text-sm text-muted-foreground">
          Konfiguriere einen Inbound E-Mail Service für Echtzeit-Antwort-Erkennung.
          Replies werden in unter 1 Sekunde erkannt und automatisch kategorisiert.
        </p>
      </div>

      {/* Feature Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Zap className="h-4 w-4 text-yellow-500" />
              Echtzeit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Replies in &lt;1 Sekunde erkennen statt 10 Minuten mit IMAP
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Mail className="h-4 w-4 text-blue-500" />
              KI-Analyse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Automatische Intent-Erkennung (Interesse, Meeting, Absage, etc.)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Shield className="h-4 w-4 text-green-500" />
              IMAP Fallback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              IMAP als Backup für direkte Antworten ohne Reply-To
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Card */}
      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Status</span>
              <div className="flex gap-2">
                {settings.isActive ? (
                  <Badge variant="default" className="bg-green-600">Aktiv</Badge>
                ) : (
                  <Badge variant="secondary">Inaktiv</Badge>
                )}
                {settings.isVerified ? (
                  <Badge variant="outline" className="border-green-600 text-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verifiziert
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-yellow-600 text-yellow-600">
                    <XCircle className="h-3 w-3 mr-1" />
                    Nicht verifiziert
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Empfangen</p>
                <p className="text-2xl font-bold">{settings.totalReceived}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Verarbeitet</p>
                <p className="text-2xl font-bold text-green-600">{settings.totalProcessed}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fehlgeschlagen</p>
                <p className="text-2xl font-bold text-red-600">{settings.totalFailed}</p>
              </div>
            </div>
            {settings.lastWebhookAt && (
              <p className="text-xs text-muted-foreground mt-4">
                Letzter Webhook: {new Date(settings.lastWebhookAt).toLocaleString("de-DE")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Konfiguration</CardTitle>
          <CardDescription>
            Wähle einen Inbound E-Mail Provider und konfiguriere die Zugangsdaten.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Provider auswählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Keiner (nur IMAP)</SelectItem>
                <SelectItem value="MAILGUN">Mailgun</SelectItem>
                <SelectItem value="SENDGRID">SendGrid</SelectItem>
                <SelectItem value="POSTMARK">Postmark</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider !== "NONE" && (
            <>
              {/* Inbound Domain */}
              <div className="space-y-2">
                <Label>Inbound Domain</Label>
                <Input
                  placeholder="reply.meinedomain.de"
                  value={inboundDomain}
                  onChange={(e) => setInboundDomain(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Diese Domain wird für Reply-To Adressen verwendet (z.B. r-abc123@reply.meinedomain.de)
                </p>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label>API Key {settings?.hasApiKey && <Badge variant="outline" className="ml-2">Gespeichert</Badge>}</Label>
                <Input
                  type="password"
                  placeholder={settings?.hasApiKey ? "••••••••" : "API Key eingeben"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              {/* Mailgun Region */}
              {provider === "MAILGUN" && (
                <div className="space-y-2">
                  <Label>Mailgun Region</Label>
                  <Select value={mailgunRegion} onValueChange={setMailgunRegion}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EU">EU (api.eu.mailgun.net)</SelectItem>
                      <SelectItem value="US">US (api.mailgun.net)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Webhook Secret */}
              <div className="space-y-2">
                <Label>Webhook Secret (optional) {settings?.hasWebhookSecret && <Badge variant="outline" className="ml-2">Gespeichert</Badge>}</Label>
                <Input
                  type="password"
                  placeholder={settings?.hasWebhookSecret ? "••••••••" : "Wird automatisch generiert"}
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                />
              </div>

              {/* Webhook URL */}
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${webhookUrl}?provider=${provider.toLowerCase()}`}
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(`${webhookUrl}?provider=${provider.toLowerCase()}`)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Trage diese URL in deinem {provider} Dashboard als Inbound Webhook ein.
                </p>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Aktivieren</Label>
                  <p className="text-xs text-muted-foreground">
                    Reply Detection über Webhooks aktivieren
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={!settings?.isVerified && provider !== "NONE"}
                />
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Speichern
            </Button>
            {provider !== "NONE" && (
              <Button variant="outline" onClick={handleVerify} disabled={verifying || !inboundDomain}>
                {verifying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Konfiguration testen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Verification Result */}
      {verificationResult && (
        <Alert variant={verificationResult.success ? "default" : "destructive"}>
          {verificationResult.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {verificationResult.success ? "Verifizierung erfolgreich" : "Verifizierung fehlgeschlagen"}
          </AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                {verificationResult.apiKeyValid ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span>API Key: {verificationResult.apiKeyValid ? "Gültig" : "Ungültig"}</span>
              </div>
              <div className="flex items-center gap-2">
                {verificationResult.mxRecordsValid ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span>MX Records: {verificationResult.mxRecordsValid ? "Korrekt" : "Fehlerhaft"}</span>
              </div>
              {verificationResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Fehler:</p>
                  <ul className="list-disc list-inside text-sm">
                    {verificationResult.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Setup Instructions */}
      {provider !== "NONE" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Setup-Anleitung
              <ExternalLink className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {provider === "MAILGUN" && (
              <div className="space-y-2 text-sm">
                <p className="font-medium">1. Domain in Mailgun hinzufügen</p>
                <p className="text-muted-foreground">Gehe zu Mailgun → Sending → Domains → Add Domain</p>

                <p className="font-medium mt-4">2. MX Records konfigurieren</p>
                <p className="text-muted-foreground">Füge folgende MX Records hinzu:</p>
                <code className="block bg-muted p-2 rounded text-xs">
                  {inboundDomain || "reply.meinedomain.de"} MX 10 mxa.mailgun.org.<br/>
                  {inboundDomain || "reply.meinedomain.de"} MX 10 mxb.mailgun.org.
                </code>

                <p className="font-medium mt-4">3. Inbound Route erstellen</p>
                <p className="text-muted-foreground">Gehe zu Mailgun → Receiving → Create Route:</p>
                <ul className="list-disc list-inside text-muted-foreground">
                  <li>Expression Type: Match Recipient</li>
                  <li>Recipient: .*@{inboundDomain || "reply.meinedomain.de"}</li>
                  <li>Action: Forward → Store and notify</li>
                  <li>Webhook URL: {webhookUrl}?provider=mailgun</li>
                </ul>
              </div>
            )}

            {provider === "SENDGRID" && (
              <div className="space-y-2 text-sm">
                <p className="font-medium">1. MX Record konfigurieren</p>
                <code className="block bg-muted p-2 rounded text-xs">
                  {inboundDomain || "reply.meinedomain.de"} MX 10 mx.sendgrid.net.
                </code>

                <p className="font-medium mt-4">2. Inbound Parse einrichten</p>
                <p className="text-muted-foreground">Gehe zu SendGrid → Settings → Inbound Parse:</p>
                <ul className="list-disc list-inside text-muted-foreground">
                  <li>Domain: {inboundDomain || "reply.meinedomain.de"}</li>
                  <li>Destination URL: {webhookUrl}?provider=sendgrid</li>
                  <li>POST the raw, full MIME message: No</li>
                </ul>
              </div>
            )}

            {provider === "POSTMARK" && (
              <div className="space-y-2 text-sm">
                <p className="font-medium">1. MX Record konfigurieren</p>
                <code className="block bg-muted p-2 rounded text-xs">
                  {inboundDomain || "reply.meinedomain.de"} MX 10 inbound.postmarkapp.com.
                </code>

                <p className="font-medium mt-4">2. Inbound Domain einrichten</p>
                <p className="text-muted-foreground">Gehe zu Postmark → Servers → Inbound:</p>
                <ul className="list-disc list-inside text-muted-foreground">
                  <li>Domain: {inboundDomain || "reply.meinedomain.de"}</li>
                  <li>Webhook URL: {webhookUrl}?provider=postmark</li>
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
