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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Phone, ChevronDown, ChevronUp, Star } from "lucide-react";

interface Question {
  question: string;
  hint?: string;
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
}

interface CallScriptSelectorProps {
  onSelect?: (script: CallScript | null) => void;
  selectedId?: string | null;
  showPreview?: boolean;
}

export function CallScriptSelector({
  onSelect,
  selectedId,
  showPreview = true,
}: CallScriptSelectorProps) {
  const [scripts, setScripts] = useState<CallScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CallScript | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchScripts();
  }, []);

  const fetchScripts = async () => {
    try {
      const res = await fetch("/api/call-scripts?active=true");
      if (res.ok) {
        const data = await res.json();
        setScripts(data.scripts);

        // Auto-select default or first script
        if (selectedId) {
          const found = data.scripts.find((s: CallScript) => s.id === selectedId);
          if (found) setSelected(found);
        } else {
          const defaultScript = data.scripts.find((s: CallScript) => s.isDefault);
          if (defaultScript) {
            setSelected(defaultScript);
            onSelect?.(defaultScript);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching scripts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (scriptId: string) => {
    const script = scripts.find((s) => s.id === scriptId) || null;
    setSelected(script);
    onSelect?.(script);
  };

  const trackUsage = async () => {
    if (!selected) return;
    try {
      await fetch(`/api/call-scripts/${selected.id}`, { method: "POST" });
    } catch {
      // Ignore tracking errors
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Lade Scripts...</div>;
  }

  if (scripts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Keine Anruf-Scripts vorhanden
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-muted-foreground" />
        <Select value={selected?.id || ""} onValueChange={handleSelect}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Script auswaehlen..." />
          </SelectTrigger>
          <SelectContent>
            {scripts.map((script) => (
              <SelectItem key={script.id} value={script.id}>
                <div className="flex items-center gap-2">
                  {script.isDefault && <Star className="h-3 w-3 text-yellow-500" />}
                  <span>{script.name}</span>
                  {script.category && (
                    <Badge variant="outline" className="text-xs">
                      {script.category}
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showPreview && selected && (
        <div className="border rounded-lg">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-between px-4 py-2"
            onClick={() => setExpanded(!expanded)}
          >
            <span className="text-sm font-medium">Script-Leitfaden</span>
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {expanded && (
            <ScrollArea className="max-h-80">
              <div className="p-4 space-y-4 text-sm">
                {/* Introduction */}
                {selected.introduction && (
                  <div>
                    <div className="font-medium text-green-600 mb-1">Begruessung</div>
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded-md whitespace-pre-wrap">
                      {selected.introduction}
                    </div>
                  </div>
                )}

                {/* Questions */}
                {(selected.questions as Question[])?.length > 0 && (
                  <div>
                    <div className="font-medium text-blue-600 mb-2">Fragen</div>
                    <div className="space-y-2">
                      {(selected.questions as Question[]).map((q, i) => (
                        <div key={i} className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md">
                          <div className="font-medium">{i + 1}. {q.question}</div>
                          {q.hint && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Tipp: {q.hint}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Objections */}
                {(selected.objections as Objection[])?.length > 0 && (
                  <div>
                    <div className="font-medium text-orange-600 mb-2">Einwaende</div>
                    <div className="space-y-2">
                      {(selected.objections as Objection[]).map((o, i) => (
                        <div key={i} className="bg-orange-50 dark:bg-orange-950 p-3 rounded-md">
                          <div className="font-medium text-orange-700 dark:text-orange-300">
                            &quot;{o.objection}&quot;
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            → {o.response}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Closing */}
                {selected.closingNotes && (
                  <div>
                    <div className="font-medium text-purple-600 mb-1">Abschluss</div>
                    <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-md whitespace-pre-wrap">
                      {selected.closingNotes}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {selected && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={trackUsage}
        >
          <Phone className="h-4 w-4 mr-2" />
          Anruf starten mit Script
        </Button>
      )}
    </div>
  );
}
