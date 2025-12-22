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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailAccount {
  id: string;
  name: string;
  email: string;
  isDefault: boolean;
}

interface EmailTemplate {
  id: string;
  name: string;
  category: string | null;
  subject: string;
  bodyHtml: string;
  variables: string[];
}

interface ComposeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowId?: string;
  defaultTo?: string;
  defaultToName?: string;
  defaultSubject?: string;
  onSuccess?: () => void;
  // Contact data for variable replacement
  contactData?: Record<string, string>;
}

export function ComposeEmailDialog({
  open,
  onOpenChange,
  rowId,
  defaultTo = "",
  defaultToName = "",
  defaultSubject = "",
  onSuccess,
  contactData = {},
}: ComposeEmailDialogProps) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [accountId, setAccountId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [to, setTo] = useState(defaultTo);
  const [toName, setToName] = useState(defaultToName);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [bodyHtml, setBodyHtml] = useState("");

  // Load accounts and templates
  useEffect(() => {
    if (open) {
      loadAccounts();
      loadTemplates();
      setTo(defaultTo);
      setToName(defaultToName);
      setSubject(defaultSubject);
    }
  }, [open, defaultTo, defaultToName, defaultSubject]);

  const loadAccounts = async () => {
    try {
      const res = await fetch("/api/email/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        // Set default account
        const defaultAccount = data.accounts?.find((a: EmailAccount) => a.isDefault);
        if (defaultAccount) {
          setAccountId(defaultAccount.id);
        }
      }
    } catch (error) {
      console.error("Error loading accounts:", error);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch("/api/email/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  };

  const handleTemplateSelect = (id: string) => {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (template) {
      // Replace variables with contact data
      let newSubject = template.subject;
      let newBody = template.bodyHtml;

      // Common variable mappings
      const variables: Record<string, string> = {
        vorname: contactData.firstName || contactData.vorname || "",
        nachname: contactData.lastName || contactData.nachname || "",
        firma: contactData.company || contactData.firma || "",
        anrede: contactData.anrede || "Sehr geehrte Damen und Herren",
        email: contactData.email || to,
        ...contactData,
      };

      // Replace variables
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
        newSubject = newSubject.replace(regex, value);
        newBody = newBody.replace(regex, value);
      });

      setSubject(newSubject);
      setBodyHtml(newBody);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!to.trim()) {
      toast.error("Bitte geben Sie eine Empfaenger-E-Mail ein");
      return;
    }

    if (!subject.trim()) {
      toast.error("Bitte geben Sie einen Betreff ein");
      return;
    }

    if (!bodyHtml.trim()) {
      toast.error("Bitte geben Sie eine Nachricht ein");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: accountId || undefined,
          rowId,
          templateId: templateId || undefined,
          to: to.trim(),
          toName: toName.trim() || undefined,
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject: subject.trim(),
          bodyHtml,
          variables: contactData,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Fehler beim Senden");
      }

      toast.success("E-Mail erfolgreich gesendet");
      onOpenChange(false);
      onSuccess?.();

      // Reset form
      setTemplateId("");
      setSubject("");
      setBodyHtml("");
      setCc("");
      setBcc("");
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Senden der E-Mail");
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find((a) => a.id === accountId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            E-Mail verfassen
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account Selection */}
          {accounts.length > 1 && (
            <div className="space-y-2">
              <Label>Von</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="E-Mail-Konto waehlen" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {accounts.length === 1 && (
            <div className="text-sm text-muted-foreground">
              Von: {selectedAccount?.name} ({selectedAccount?.email})
            </div>
          )}

          {accounts.length === 0 && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md text-sm text-yellow-800 dark:text-yellow-200">
              Kein E-Mail-Konto eingerichtet. Bitte richten Sie zuerst ein E-Mail-Konto in den Einstellungen ein.
            </div>
          )}

          {/* Template Selection */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Vorlage
              </Label>
              <Select value={templateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Vorlage auswaehlen (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keine Vorlage</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.category && (
                        <span className="text-muted-foreground ml-2">({template.category})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* To */}
          <div className="space-y-2">
            <Label htmlFor="to">An *</Label>
            <div className="flex gap-2">
              <Input
                id="to"
                type="email"
                placeholder="empfaenger@example.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
                className="flex-1"
              />
              <Input
                placeholder="Name (optional)"
                value={toName}
                onChange={(e) => setToName(e.target.value)}
                className="w-40"
              />
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Erweiterte Optionen
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 pl-4 border-l-2">
              <div className="space-y-2">
                <Label htmlFor="cc">CC</Label>
                <Input
                  id="cc"
                  type="email"
                  placeholder="cc@example.com"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bcc">BCC</Label>
                <Input
                  id="bcc"
                  type="email"
                  placeholder="bcc@example.com"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">Betreff *</Label>
            <Input
              id="subject"
              placeholder="Betreff der E-Mail"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Nachricht *</Label>
            <Textarea
              id="body"
              placeholder="Ihre Nachricht..."
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={10}
              required
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Verfuegbare Variablen: {"{{vorname}}"}, {"{{nachname}}"}, {"{{firma}}"}, {"{{anrede}}"}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading || accounts.length === 0}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gesendet...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Senden
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
