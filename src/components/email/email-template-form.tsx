"use client";

import { useState } from "react";
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
import { Loader2, FileText, Variable } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EmailTemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    subject: string;
    bodyHtml: string;
    variables: string[];
  } | null;
  categories?: string[];
  onSuccess?: () => void;
}

const defaultCategories = [
  "Erstkontakt",
  "Follow-up",
  "Angebot",
  "Nachfassen",
  "Termin",
  "Allgemein",
];

const availableVariables = [
  { key: "vorname", description: "Vorname des Kontakts" },
  { key: "nachname", description: "Nachname des Kontakts" },
  { key: "firma", description: "Firmenname" },
  { key: "anrede", description: "Formelle Anrede" },
  { key: "email", description: "E-Mail-Adresse" },
  { key: "telefon", description: "Telefonnummer" },
  { key: "datum", description: "Aktuelles Datum" },
];

export function EmailTemplateForm({
  open,
  onOpenChange,
  template,
  categories = [],
  onSuccess,
}: EmailTemplateFormProps) {
  const isEdit = !!template;
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [category, setCategory] = useState(template?.category || "");
  const [subject, setSubject] = useState(template?.subject || "");
  const [bodyHtml, setBodyHtml] = useState(template?.bodyHtml || "");

  const allCategories = [...new Set([...defaultCategories, ...categories])];

  // Extract used variables
  const usedVariables = [...new Set([
    ...subject.matchAll(/\{\{(\w+)\}\}/g),
    ...bodyHtml.matchAll(/\{\{(\w+)\}\}/g),
  ].map((m) => m[1]))];

  const insertVariable = (key: string) => {
    const variable = `{{${key}}}`;
    setBodyHtml((prev) => prev + variable);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      toast.error("Bitte fuellen Sie alle Pflichtfelder aus");
      return;
    }

    setLoading(true);

    try {
      const url = isEdit ? `/api/email/templates/${template.id}` : "/api/email/templates";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          category: category || null,
          subject: subject.trim(),
          bodyHtml: bodyHtml.trim(),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Fehler beim Speichern");
      }

      toast.success(isEdit ? "Vorlage aktualisiert" : "Vorlage erstellt");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isEdit ? "Vorlage bearbeiten" : "Neue E-Mail-Vorlage"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Vorlagenname *</Label>
              <Input
                id="name"
                placeholder="z.B. Erstkontakt Anschreiben"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie waehlen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keine Kategorie</SelectItem>
                  {allCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Input
              id="description"
              placeholder="Kurze Beschreibung der Vorlage"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Betreff *</Label>
            <Input
              id="subject"
              placeholder="Betreff der E-Mail - z.B. Anfrage von {{firma}}"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="body">E-Mail-Text *</Label>
              <div className="flex items-center gap-1">
                <Variable className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Variablen einfuegen:</span>
              </div>
            </div>

            {/* Variable buttons */}
            <div className="flex flex-wrap gap-1 pb-2">
              {availableVariables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
                  title={v.description}
                >
                  {`{{${v.key}}}`}
                </button>
              ))}
            </div>

            <Textarea
              id="body"
              placeholder={`Sehr geehrte(r) {{anrede}} {{nachname}},

vielen Dank fuer Ihr Interesse an unseren Dienstleistungen.

Mit freundlichen Gruessen`}
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={12}
              required
              className="font-mono text-sm"
            />
          </div>

          {/* Used variables display */}
          {usedVariables.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Verwendete Variablen:</span>
              {usedVariables.map((v) => (
                <Badge key={v} variant="secondary" className="text-xs">
                  {`{{${v}}}`}
                </Badge>
              ))}
            </div>
          )}

          <DialogFooter>
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
                isEdit ? "Speichern" : "Vorlage erstellen"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
