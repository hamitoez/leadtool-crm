"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Mail, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface EmailAccount {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  healthScore: number;
}

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: string;
  accountIds: string[];
  dailyLimit: number;
  sendingDays: string[];
  sendingHoursStart: number;
  sendingHoursEnd: number;
  timezone: string;
  stopOnReply: boolean;
  stopOnBounce: boolean;
  trackOpens: boolean;
  trackClicks: boolean;
  organization: { id: string; name: string };
}

interface CampaignSettingsProps {
  campaign: Campaign;
  isEditable: boolean;
  onUpdate: () => void;
}

const DAYS = [
  { value: "MON", label: "Mo" },
  { value: "TUE", label: "Di" },
  { value: "WED", label: "Mi" },
  { value: "THU", label: "Do" },
  { value: "FRI", label: "Fr" },
  { value: "SAT", label: "Sa" },
  { value: "SUN", label: "So" },
];

export function CampaignSettings({
  campaign,
  isEditable,
  onUpdate,
}: CampaignSettingsProps) {
  const [loading, setLoading] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);

  // Form state
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description || "");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    campaign.accountIds
  );
  const [dailyLimit, setDailyLimit] = useState(campaign.dailyLimit);
  const [sendingDays, setSendingDays] = useState<string[]>(campaign.sendingDays);
  const [sendingHoursStart, setSendingHoursStart] = useState(
    campaign.sendingHoursStart
  );
  const [sendingHoursEnd, setSendingHoursEnd] = useState(campaign.sendingHoursEnd);
  const [stopOnReply, setStopOnReply] = useState(campaign.stopOnReply);
  const [stopOnBounce, setStopOnBounce] = useState(campaign.stopOnBounce);
  const [trackOpens, setTrackOpens] = useState(campaign.trackOpens);
  const [trackClicks, setTrackClicks] = useState(campaign.trackClicks);

  useEffect(() => {
    fetchEmailAccounts();
  }, []);

  const fetchEmailAccounts = async () => {
    try {
      const response = await fetch(
        `/api/email/accounts?organizationId=${campaign.organization.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setEmailAccounts(data);
      }
    } catch (error) {
      console.error("Error fetching email accounts:", error);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          accountIds: selectedAccounts,
          dailyLimit,
          sendingDays,
          sendingHoursStart,
          sendingHoursEnd,
          stopOnReply,
          stopOnBounce,
          trackOpens,
          trackClicks,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Speichern");
      }

      toast.success("Einstellungen gespeichert");
      onUpdate();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: string) => {
    if (sendingDays.includes(day)) {
      setSendingDays(sendingDays.filter((d) => d !== day));
    } else {
      setSendingDays([...sendingDays, day]);
    }
  };

  const toggleAccount = (accountId: string) => {
    if (selectedAccounts.includes(accountId)) {
      setSelectedAccounts(selectedAccounts.filter((id) => id !== accountId));
    } else {
      setSelectedAccounts([...selectedAccounts, accountId]);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Kampagnen-Einstellungen</h3>
          <p className="text-sm text-muted-foreground">
            Konfigurieren Sie die Kampagnen-Parameter.
          </p>
        </div>
        {isEditable && (
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Speichern
          </Button>
        )}
      </div>

      {!isEditable && (
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">
            Einstellungen koennen nur im Entwurf-Status bearbeitet werden.
          </span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allgemein</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Kampagnenname</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isEditable}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!isEditable}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Daily Limit */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Versandlimit</CardTitle>
            <CardDescription>
              Maximale E-Mails pro Tag
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Taegliches Limit</span>
              <span className="text-lg font-bold">{dailyLimit}</span>
            </div>
            <Slider
              value={[dailyLimit]}
              onValueChange={([value]) => setDailyLimit(value)}
              min={10}
              max={500}
              step={10}
              disabled={!isEditable}
            />
            <p className="text-xs text-muted-foreground">
              Empfehlung: 50-100 E-Mails pro Tag fuer neue Konten
            </p>
          </CardContent>
        </Card>

        {/* Sending Schedule */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Versandzeiten</CardTitle>
            <CardDescription>
              Wann sollen E-Mails gesendet werden?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Versandtage</Label>
              <div className="flex gap-2">
                {DAYS.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    variant={sendingDays.includes(day.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleDay(day.value)}
                    disabled={!isEditable}
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Uhrzeiten</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Von</span>
                  <Select
                    value={sendingHoursStart.toString()}
                    onValueChange={(v) => setSendingHoursStart(parseInt(v))}
                    disabled={!isEditable}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i.toString().padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">bis</span>
                  <Select
                    value={sendingHoursEnd.toString()}
                    onValueChange={(v) => setSendingHoursEnd(parseInt(v))}
                    disabled={!isEditable}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i.toString().padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm">Uhr</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Behavior */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verhalten</CardTitle>
            <CardDescription>
              Automatische Reaktionen und Tracking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="stopOnReply"
                checked={stopOnReply}
                onCheckedChange={(checked) => setStopOnReply(checked === true)}
                disabled={!isEditable}
              />
              <label htmlFor="stopOnReply" className="text-sm cursor-pointer">
                Bei Antwort stoppen
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="stopOnBounce"
                checked={stopOnBounce}
                onCheckedChange={(checked) => setStopOnBounce(checked === true)}
                disabled={!isEditable}
              />
              <label htmlFor="stopOnBounce" className="text-sm cursor-pointer">
                Bei Bounce stoppen
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="trackOpens"
                checked={trackOpens}
                onCheckedChange={(checked) => setTrackOpens(checked === true)}
                disabled={!isEditable}
              />
              <label htmlFor="trackOpens" className="text-sm cursor-pointer">
                Oeffnungen tracken
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="trackClicks"
                checked={trackClicks}
                onCheckedChange={(checked) => setTrackClicks(checked === true)}
                disabled={!isEditable}
              />
              <label htmlFor="trackClicks" className="text-sm cursor-pointer">
                Klicks tracken
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">E-Mail-Konten</CardTitle>
          <CardDescription>
            Konten, die fuer den Versand verwendet werden (Rotation)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emailAccounts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2" />
              <p>Keine E-Mail-Konten konfiguriert.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {emailAccounts.map((account) => (
                <div
                  key={account.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedAccounts.includes(account.id)
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  } ${!isEditable ? "opacity-75 cursor-not-allowed" : ""}`}
                  onClick={() => isEditable && toggleAccount(account.id)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedAccounts.includes(account.id)}
                      onCheckedChange={() => isEditable && toggleAccount(account.id)}
                      disabled={!isEditable}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{account.name}</span>
                        {!account.isActive && (
                          <Badge variant="destructive" className="text-xs">
                            Inaktiv
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {account.email}
                      </div>
                      <div
                        className={`text-xs mt-1 ${getHealthColor(account.healthScore)}`}
                      >
                        Health Score: {account.healthScore}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {isEditable && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Gefahrenzone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Kampagne loeschen</p>
                <p className="text-sm text-muted-foreground">
                  Diese Aktion kann nicht rueckgaengig gemacht werden.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!confirm("Kampagne wirklich loeschen?")) return;
                  try {
                    const response = await fetch(`/api/campaigns/${campaign.id}`, {
                      method: "DELETE",
                    });
                    if (!response.ok) throw new Error("Fehler beim Loeschen");
                    toast.success("Kampagne geloescht");
                    window.location.href = "/campaigns";
                  } catch (error) {
                    toast.error("Fehler beim Loeschen der Kampagne");
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Loeschen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
