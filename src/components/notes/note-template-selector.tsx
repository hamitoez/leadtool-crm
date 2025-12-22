"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";

interface NoteTemplate {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  content: string;
  variables: string[];
}

interface NoteTemplateSelectorProps {
  onApply: (content: string) => void;
  contactData?: Record<string, string>;
}

export function NoteTemplateSelector({
  onApply,
  contactData = {},
}: NoteTemplateSelectorProps) {
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState<NoteTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (selected) {
      // Pre-fill variables from contact data
      const newVars: Record<string, string> = {};
      (selected.variables as string[]).forEach((v) => {
        if (v === "datum") {
          newVars[v] = new Date().toLocaleDateString("de-DE");
        } else if (v === "uhrzeit") {
          newVars[v] = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
        } else if (contactData[v]) {
          newVars[v] = contactData[v];
        } else {
          newVars[v] = "";
        }
      });
      setVariables(newVars);
    }
  }, [selected, contactData]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/note-templates?active=true");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId) || null;
    setSelected(template);
  };

  const handleApply = async () => {
    if (!selected) return;
    setApplying(true);

    try {
      const res = await fetch(`/api/note-templates/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables }),
      });

      if (res.ok) {
        const data = await res.json();
        onApply(data.content);
        setSelected(null);
        setVariables({});
      }
    } catch (error) {
      console.error("Error applying template:", error);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Lade Vorlagen...</div>;
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <Select value={selected?.id || ""} onValueChange={handleSelect}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Vorlage auswaehlen..." />
          </SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                <div className="flex items-center gap-2">
                  <span>{template.name}</span>
                  {template.category && (
                    <Badge variant="outline" className="text-xs">
                      {template.category}
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && (selected.variables as string[]).length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs">Variablen ausfuellen:</Label>
          <div className="grid grid-cols-2 gap-2">
            {(selected.variables as string[]).map((v) => (
              <div key={v}>
                <Input
                  placeholder={v}
                  value={variables[v] || ""}
                  onChange={(e) =>
                    setVariables((prev) => ({ ...prev, [v]: e.target.value }))
                  }
                  className="text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <Button
          type="button"
          size="sm"
          onClick={handleApply}
          disabled={applying}
          className="w-full"
        >
          {applying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Vorlage anwenden
        </Button>
      )}
    </div>
  );
}
