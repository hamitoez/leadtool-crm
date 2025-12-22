"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface NoteTemplate {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  content: string;
  variables: string[];
  isActive: boolean;
}

interface NoteTemplateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: NoteTemplate | null;
  onSuccess?: () => void;
}

const categories = [
  { value: "meeting", label: "Meeting-Notiz" },
  { value: "call", label: "Anruf-Notiz" },
  { value: "general", label: "Allgemein" },
  { value: "followup", label: "Follow-up" },
  { value: "feedback", label: "Feedback" },
];

const availableVariables = [
  { name: "datum", label: "Aktuelles Datum" },
  { name: "uhrzeit", label: "Aktuelle Uhrzeit" },
  { name: "firma", label: "Firmenname" },
  { name: "ansprechpartner", label: "Ansprechpartner" },
  { name: "email", label: "E-Mail-Adresse" },
  { name: "telefon", label: "Telefonnummer" },
];

export function NoteTemplateForm({
  open,
  onOpenChange,
  template,
  onSuccess,
}: NoteTemplateFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: template?.name || "",
    description: template?.description || "",
    category: template?.category || "",
    content: template?.content || "",
  });

  // Extract variables from content
  const extractedVariables = formData.content.match(/\{\{(\w+)\}\}/g)?.map(
    (v) => v.replace(/\{\{|\}\}/g, "")
  ) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(
        template ? `/api/note-templates/${template.id}` : "/api/note-templates",
        {
          method: template ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        }
      );

      if (!res.ok) throw new Error("Failed to save template");

      toast.success(template ? "Vorlage aktualisiert" : "Vorlage erstellt");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Fehler beim Speichern der Vorlage");
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (varName: string) => {
    const textarea = document.getElementById("note-content") as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.content;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newContent = `${before}{{${varName}}}${after}`;
      setFormData((prev) => ({ ...prev, content: newContent }));

      // Reset cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + varName.length + 4, start + varName.length + 4);
      }, 0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {template ? "Notiz-Vorlage bearbeiten" : "Neue Notiz-Vorlage"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="z.B. Meeting-Protokoll"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie waehlen..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Input
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Wofuer ist diese Vorlage?"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Vorlage-Text *</Label>
              <div className="flex gap-1 flex-wrap">
                {availableVariables.map((v) => (
                  <Button
                    key={v.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-6 px-2"
                    onClick={() => insertVariable(v.name)}
                  >
                    {`{{${v.name}}}`}
                  </Button>
                ))}
              </div>
            </div>
            <Textarea
              id="note-content"
              value={formData.content}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, content: e.target.value }))
              }
              placeholder="Vorlagen-Text eingeben. Verwenden Sie {{variable}} fuer dynamische Werte."
              rows={8}
              className="font-mono text-sm"
              required
            />
            <div className="text-xs text-muted-foreground">
              Tipp: Verwenden Sie {`{{variable}}`} fuer dynamische Werte, die beim Erstellen der Notiz ersetzt werden.
            </div>
          </div>

          {extractedVariables.length > 0 && (
            <div className="space-y-2">
              <Label>Erkannte Variablen</Label>
              <div className="flex gap-2 flex-wrap">
                {extractedVariables.map((v) => (
                  <Badge key={v} variant="secondary">
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {template ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
