"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useOrganization } from "@/lib/organization-context";
import { Loader2, Mail } from "lucide-react";

interface EmailAccount {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
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

export function CreateCampaignDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateCampaignDialogProps) {
  const router = useRouter();
  const { currentOrg } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [sendingDays, setSendingDays] = useState<string[]>(["MON", "TUE", "WED", "THU", "FRI"]);
  const [sendingHoursStart, setSendingHoursStart] = useState(9);
  const [sendingHoursEnd, setSendingHoursEnd] = useState(17);
  const [stopOnReply, setStopOnReply] = useState(true);
  const [stopOnBounce, setStopOnBounce] = useState(true);
  const [trackOpens, setTrackOpens] = useState(true);
  const [trackClicks, setTrackClicks] = useState(true);

  useEffect(() => {
    if (open && currentOrg?.id) {
      fetchEmailAccounts();
    }
  }, [open, currentOrg?.id]);

  const fetchEmailAccounts = async () => {
    try {
      const response = await fetch(
        `/api/email/accounts?organizationId=${currentOrg?.id}`
      );
      if (response.ok) {
        const data = await response.json();
        setEmailAccounts(data.filter((a: EmailAccount) => a.isActive));
      }
    } catch (error) {
      console.error("Error fetching email accounts:", error);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setSelectedAccounts([]);
    setDailyLimit(50);
    setSendingDays(["MON", "TUE", "WED", "THU", "FRI"]);
    setSendingHoursStart(9);
    setSendingHoursEnd(17);
    setStopOnReply(true);
    setStopOnBounce(true);
    setTrackOpens(true);
    setTrackClicks(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Bitte geben Sie einen Namen ein");
      return;
    }

    if (!currentOrg?.id) {
      toast.error("Keine Organisation ausgewaehlt");
      return;
    }

    if (selectedAccounts.length === 0) {
      toast.error("Bitte waehlen Sie mindestens ein E-Mail-Konto aus");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          organizationId: currentOrg.id,
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
        throw new Error(error.error || "Fehler beim Erstellen der Kampagne");
      }

      const campaign = await response.json();
      toast.success("Kampagne erstellt");
      resetForm();
      onSuccess();

      // Direkt zur Bearbeitung navigieren
      router.push(`/campaigns/${campaign.id}`);
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Erstellen");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue Kampagne erstellen</DialogTitle>
          <DialogDescription>
            Erstellen Sie eine neue E-Mail-Kampagne mit automatischen Sequences.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Kampagnenname *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Q1 Akquise Kampagne"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optionale Beschreibung..."
                rows={2}
              />
            </div>
          </div>

          {/* Email Accounts */}
          <div className="space-y-3">
            <Label>E-Mail-Konten *</Label>
            <p className="text-sm text-muted-foreground">
              Waehlen Sie die Konten aus, die fuer den Versand verwendet werden sollen.
            </p>
            {emailAccounts.length === 0 ? (
              <div className="text-sm text-muted-foreground border rounded-lg p-4 text-center">
                <Mail className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p>Keine E-Mail-Konten vorhanden.</p>
                <p className="mt-1">
                  Bitte konfigurieren Sie zuerst ein E-Mail-Konto in den Einstellungen.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {emailAccounts.map((account) => (
                  <div
                    key={account.id}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      selectedAccounts.includes(account.id)
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleAccount(account.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedAccounts.includes(account.id)}
                        onCheckedChange={() => toggleAccount(account.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{account.name}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {account.email}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Daily Limit */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Taegliches Limit</Label>
              <span className="text-sm font-medium">{dailyLimit} E-Mails/Tag</span>
            </div>
            <Slider
              value={[dailyLimit]}
              onValueChange={([value]) => setDailyLimit(value)}
              min={10}
              max={500}
              step={10}
            />
            <p className="text-sm text-muted-foreground">
              Maximale Anzahl E-Mails, die pro Tag gesendet werden.
            </p>
          </div>

          {/* Sending Days */}
          <div className="space-y-3">
            <Label>Versandtage</Label>
            <div className="flex gap-2">
              {DAYS.map((day) => (
                <Button
                  key={day.value}
                  type="button"
                  variant={sendingDays.includes(day.value) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDay(day.value)}
                >
                  {day.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Sending Hours */}
          <div className="space-y-3">
            <Label>Versandzeiten</Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm">Von</span>
                <Select
                  value={sendingHoursStart.toString()}
                  onValueChange={(v) => setSendingHoursStart(parseInt(v))}
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

          {/* Options */}
          <div className="space-y-3">
            <Label>Optionen</Label>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="stopOnReply"
                  checked={stopOnReply}
                  onCheckedChange={(checked) => setStopOnReply(checked === true)}
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
                />
                <label htmlFor="trackClicks" className="text-sm cursor-pointer">
                  Klicks tracken
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kampagne erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
