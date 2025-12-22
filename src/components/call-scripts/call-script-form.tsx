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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface Question {
  question: string;
  hint?: string;
  required?: boolean;
}

interface Objection {
  objection: string;
  response: string;
}

interface CallScript {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  introduction?: string | null;
  questions: Question[];
  objections: Objection[];
  closingNotes?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

interface CallScriptFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  script?: CallScript | null;
  onSuccess?: () => void;
}

const categories = [
  { value: "erstkontakt", label: "Erstkontakt" },
  { value: "follow-up", label: "Follow-up" },
  { value: "qualifizierung", label: "Qualifizierung" },
  { value: "angebot", label: "Angebotsbesprechung" },
  { value: "abschluss", label: "Abschluss" },
  { value: "support", label: "Support" },
];

export function CallScriptForm({
  open,
  onOpenChange,
  script,
  onSuccess,
}: CallScriptFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: script?.name || "",
    description: script?.description || "",
    category: script?.category || "",
    introduction: script?.introduction || "",
    closingNotes: script?.closingNotes || "",
    isDefault: script?.isDefault || false,
  });
  const [questions, setQuestions] = useState<Question[]>(
    (script?.questions as Question[]) || [{ question: "", hint: "" }]
  );
  const [objections, setObjections] = useState<Objection[]>(
    (script?.objections as Objection[]) || []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        questions: questions.filter((q) => q.question.trim()),
        objections: objections.filter((o) => o.objection.trim() && o.response.trim()),
      };

      const res = await fetch(
        script ? `/api/call-scripts/${script.id}` : "/api/call-scripts",
        {
          method: script ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) throw new Error("Failed to save script");

      toast.success(script ? "Script aktualisiert" : "Script erstellt");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving script:", error);
      toast.error("Fehler beim Speichern des Scripts");
    } finally {
      setLoading(false);
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, { question: "", hint: "" }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: keyof Question, value: string | boolean) => {
    setQuestions(
      questions.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  };

  const addObjection = () => {
    setObjections([...objections, { objection: "", response: "" }]);
  };

  const removeObjection = (index: number) => {
    setObjections(objections.filter((_, i) => i !== index));
  };

  const updateObjection = (index: number, field: keyof Objection, value: string) => {
    setObjections(
      objections.map((o, i) => (i === index ? { ...o, [field]: value } : o))
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {script ? "Anruf-Script bearbeiten" : "Neues Anruf-Script"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="z.B. Erstkontakt B2B"
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
              placeholder="Wann dieses Script verwenden?"
            />
          </div>

          {/* Introduction */}
          <div className="space-y-2">
            <Label>Begruessung / Einstieg</Label>
            <Textarea
              value={formData.introduction}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, introduction: e.target.value }))
              }
              placeholder="Guten Tag, mein Name ist... Ich rufe an weil..."
              rows={3}
            />
          </div>

          {/* Questions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Fragen / Leitfaden</Label>
              <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                <Plus className="h-4 w-4 mr-1" />
                Frage
              </Button>
            </div>
            {questions.map((q, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <Input
                    value={q.question}
                    onChange={(e) => updateQuestion(index, "question", e.target.value)}
                    placeholder={`Frage ${index + 1}`}
                  />
                  <Input
                    value={q.hint || ""}
                    onChange={(e) => updateQuestion(index, "hint", e.target.value)}
                    placeholder="Hinweis/Tipp (optional)"
                    className="text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeQuestion(index)}
                  disabled={questions.length <= 1}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          {/* Objections */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Einwaende & Antworten</Label>
              <Button type="button" variant="outline" size="sm" onClick={addObjection}>
                <Plus className="h-4 w-4 mr-1" />
                Einwand
              </Button>
            </div>
            {objections.map((o, index) => (
              <div key={index} className="flex gap-2 items-start border rounded-lg p-3">
                <div className="flex-1 space-y-2">
                  <Input
                    value={o.objection}
                    onChange={(e) => updateObjection(index, "objection", e.target.value)}
                    placeholder="Einwand des Kunden..."
                  />
                  <Textarea
                    value={o.response}
                    onChange={(e) => updateObjection(index, "response", e.target.value)}
                    placeholder="Ihre Antwort..."
                    rows={2}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeObjection(index)}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>

          {/* Closing Notes */}
          <div className="space-y-2">
            <Label>Abschluss-Hinweise</Label>
            <Textarea
              value={formData.closingNotes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, closingNotes: e.target.value }))
              }
              placeholder="Naechste Schritte vereinbaren, Zusammenfassung..."
              rows={2}
            />
          </div>

          {/* Default Switch */}
          <div className="flex items-center justify-between">
            <Label htmlFor="is-default">Als Standard-Script setzen</Label>
            <Switch
              id="is-default"
              checked={formData.isDefault}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, isDefault: checked }))
              }
            />
          </div>

          {/* Actions */}
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
              {script ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
