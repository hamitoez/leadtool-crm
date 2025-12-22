"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Trash2,
  Clock,
  Mail,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
  Eye,
  Variable,
  Wand2,
  Info,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DEFAULT_VARIABLES, previewEmail, countSpintaxVariants } from "@/lib/email/spintax";

interface Sequence {
  id: string;
  stepNumber: number;
  subject: string;
  body: string;
  delayDays: number;
  delayHours: number;
}

interface SequenceEditorProps {
  campaignId: string;
  sequences: Sequence[];
  isEditable: boolean;
  onUpdate: () => void;
}

export function SequenceEditor({
  campaignId,
  sequences,
  isEditable,
  onUpdate,
}: SequenceEditorProps) {
  const [loading, setLoading] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(
    sequences[0]?.id || null
  );
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string; body: string } | null>(null);

  // New sequence form state
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newDelayDays, setNewDelayDays] = useState(1);
  const [newDelayHours, setNewDelayHours] = useState(0);

  // AI state
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPurpose, setAiPurpose] = useState("");
  const [aiTargetAudience, setAiTargetAudience] = useState("");
  const [aiTone, setAiTone] = useState<"formal" | "casual" | "friendly" | "professional">("professional");
  const [aiCallToAction, setAiCallToAction] = useState("");

  // Spam check state
  const [showSpamCheck, setShowSpamCheck] = useState(false);
  const [spamLoading, setSpamLoading] = useState(false);
  const [spamResult, setSpamResult] = useState<{
    score: number;
    rating: string;
    issues: Array<{ type: string; description: string; severity: string }>;
    suggestions: string[];
  } | null>(null);

  // Spintax state
  const [spintaxLoading, setSpintaxLoading] = useState(false);

  const resetForm = () => {
    setNewSubject("");
    setNewBody("");
    setNewDelayDays(1);
    setNewDelayHours(0);
  };

  // AI Email Generation
  const handleAIGenerate = async () => {
    if (!aiPurpose || !aiTargetAudience || !aiCallToAction) {
      toast.error("Bitte füllen Sie alle Felder aus");
      return;
    }

    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: aiPurpose,
          targetAudience: aiTargetAudience,
          tone: aiTone,
          callToAction: aiCallToAction,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewSubject(data.email.subject);
        setNewBody(data.email.body);
        setShowAIGenerator(false);
        toast.success("E-Mail generiert!");
      } else {
        const error = await response.json();
        toast.error(error.error || "Fehler bei der Generierung");
      }
    } catch (error) {
      toast.error("Fehler bei der KI-Generierung");
    } finally {
      setAiLoading(false);
    }
  };

  // Spam Check
  const handleSpamCheck = async () => {
    if (!newSubject || !newBody) {
      toast.error("Bitte fügen Sie erst Betreff und Inhalt hinzu");
      return;
    }

    setSpamLoading(true);
    setShowSpamCheck(true);
    setSpamResult(null);

    try {
      const response = await fetch("/api/ai/email/spam-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newSubject,
          body: newBody,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSpamResult(data);
      } else {
        const error = await response.json();
        toast.error(error.error || "Fehler bei der Analyse");
        setShowSpamCheck(false);
      }
    } catch (error) {
      toast.error("Fehler bei der Spam-Analyse");
      setShowSpamCheck(false);
    } finally {
      setSpamLoading(false);
    }
  };

  // Spintax Generation
  const handleGenerateSpintax = async () => {
    if (!newBody) {
      toast.error("Bitte fügen Sie erst Inhalt hinzu");
      return;
    }

    setSpintaxLoading(true);
    try {
      const response = await fetch("/api/ai/email/spintax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: newBody,
          variationLevel: "moderate",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewBody(data.body);
        toast.success("Spintax hinzugefügt!");
      } else {
        const error = await response.json();
        toast.error(error.error || "Fehler bei der Generierung");
      }
    } catch (error) {
      toast.error("Fehler bei der Spintax-Generierung");
    } finally {
      setSpintaxLoading(false);
    }
  };

  const handleAddSequence = async () => {
    if (!newSubject.trim() || !newBody.trim()) {
      toast.error("Bitte fuellen Sie Betreff und Inhalt aus");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/sequences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newSubject,
          body: newBody,
          delayDays: newDelayDays,
          delayHours: newDelayHours,
          stepNumber: sequences.length + 1,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Hinzufuegen");
      }

      toast.success("E-Mail-Schritt hinzugefuegt");
      resetForm();
      setShowAddDialog(false);
      onUpdate();
    } catch (error) {
      console.error("Error adding sequence:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Hinzufuegen");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSequence = async (sequence: Sequence) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/sequences/${sequence.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: sequence.subject,
            body: sequence.body,
            delayDays: sequence.delayDays,
            delayHours: sequence.delayHours,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Speichern");
      }

      toast.success("Aenderungen gespeichert");
      setEditingSequence(null);
      onUpdate();
    } catch (error) {
      console.error("Error updating sequence:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Speichern");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSequence = async (sequenceId: string) => {
    if (!confirm("E-Mail-Schritt wirklich loeschen?")) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/sequences/${sequenceId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Fehler beim Loeschen");
      }

      toast.success("E-Mail-Schritt geloescht");
      onUpdate();
    } catch (error) {
      console.error("Error deleting sequence:", error);
      toast.error(error instanceof Error ? error.message : "Fehler beim Loeschen");
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (subject: string, body: string) => {
    const preview = previewEmail(subject, body);
    setPreviewData(preview);
    setShowPreview(true);
  };

  const insertVariable = (variable: string, field: "subject" | "body") => {
    const insertion = `{{${variable}}}`;
    if (field === "subject") {
      setNewSubject((prev) => prev + insertion);
    } else {
      setNewBody((prev) => prev + insertion);
    }
  };

  const formatDelay = (days: number, hours: number) => {
    const parts = [];
    if (days > 0) parts.push(`${days} Tag${days !== 1 ? "e" : ""}`);
    if (hours > 0) parts.push(`${hours} Stunde${hours !== 1 ? "n" : ""}`);
    return parts.length > 0 ? parts.join(" ") : "Sofort";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">E-Mail Sequence</h3>
          <p className="text-sm text-muted-foreground">
            Definieren Sie die E-Mails, die automatisch versendet werden.
          </p>
        </div>
        {isEditable && (
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Schritt hinzufuegen
          </Button>
        )}
      </div>

      {sequences.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="font-medium mb-2">Noch keine E-Mail-Schritte</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Fuegen Sie Ihren ersten E-Mail-Schritt hinzu, um die Sequence zu starten.
            </p>
            {isEditable && (
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Ersten Schritt hinzufuegen
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sequences
            .sort((a, b) => a.stepNumber - b.stepNumber)
            .map((sequence, index) => (
              <Card key={sequence.id}>
                <CardHeader
                  className="cursor-pointer"
                  onClick={() =>
                    setExpandedStep(
                      expandedStep === sequence.id ? null : sequence.id
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                        {sequence.stepNumber}
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {sequence.subject || "Kein Betreff"}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          {index === 0
                            ? "Sofort nach Start"
                            : `${formatDelay(sequence.delayDays, sequence.delayHours)} nach Schritt ${sequence.stepNumber - 1}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {countSpintaxVariants(sequence.subject + sequence.body) > 1 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Wand2 className="h-4 w-4 text-purple-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              {countSpintaxVariants(sequence.subject + sequence.body)} Spintax-Varianten
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {expandedStep === sequence.id ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                {expandedStep === sequence.id && (
                  <CardContent className="space-y-4 border-t pt-4">
                    {editingSequence?.id === sequence.id ? (
                      // Edit Mode
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Betreff</Label>
                          <Input
                            value={editingSequence.subject}
                            onChange={(e) =>
                              setEditingSequence({
                                ...editingSequence,
                                subject: e.target.value,
                              })
                            }
                            placeholder="Betreff der E-Mail"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Inhalt</Label>
                          <Textarea
                            value={editingSequence.body}
                            onChange={(e) =>
                              setEditingSequence({
                                ...editingSequence,
                                body: e.target.value,
                              })
                            }
                            placeholder="E-Mail Inhalt..."
                            rows={10}
                          />
                        </div>
                        <div className="flex gap-4">
                          <div className="space-y-2">
                            <Label>Verzoegerung (Tage)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={editingSequence.delayDays}
                              onChange={(e) =>
                                setEditingSequence({
                                  ...editingSequence,
                                  delayDays: parseInt(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Stunden</Label>
                            <Input
                              type="number"
                              min={0}
                              max={23}
                              value={editingSequence.delayHours}
                              onChange={(e) =>
                                setEditingSequence({
                                  ...editingSequence,
                                  delayHours: parseInt(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleUpdateSequence(editingSequence)}
                            disabled={loading}
                          >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Save className="mr-2 h-4 w-4" />
                            Speichern
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setEditingSequence(null)}
                          >
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="space-y-4">
                        <div>
                          <Label className="text-muted-foreground text-xs">
                            INHALT
                          </Label>
                          <div className="mt-2 p-4 bg-muted/50 rounded-lg whitespace-pre-wrap text-sm">
                            {sequence.body || "Kein Inhalt"}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              handlePreview(sequence.subject, sequence.body)
                            }
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Vorschau
                          </Button>
                          {isEditable && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingSequence(sequence)}
                              >
                                Bearbeiten
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteSequence(sequence.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
        </div>
      )}

      {/* Add Sequence Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>E-Mail-Schritt hinzufuegen</DialogTitle>
            <DialogDescription>
              Fuegen Sie einen neuen Schritt zur E-Mail-Sequence hinzu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Delay */}
            {sequences.length > 0 && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    Verzoegerung nach Schritt {sequences.length}
                  </span>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={newDelayDays}
                      onChange={(e) => setNewDelayDays(parseInt(e.target.value) || 0)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">Tage</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={newDelayHours}
                      onChange={(e) => setNewDelayHours(parseInt(e.target.value) || 0)}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">Stunden</span>
                  </div>
                </div>
              </div>
            )}

            {/* Subject */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Betreff</Label>
                <div className="flex gap-1">
                  {DEFAULT_VARIABLES.slice(0, 4).map((v) => (
                    <Button
                      key={v.name}
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => insertVariable(v.name, "subject")}
                    >
                      {`{{${v.name}}}`}
                    </Button>
                  ))}
                </div>
              </div>
              <Input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="z.B. Kurze Frage zu {{company}}"
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Inhalt</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6">
                        <Info className="h-3 w-3 mr-1" />
                        Spintax
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="font-medium mb-1">Spintax-Syntax</p>
                      <p className="text-sm">
                        Verwenden Sie {"{Option1|Option2|Option3}"} um zufaellige
                        Varianten zu erstellen.
                      </p>
                      <p className="text-sm mt-1">
                        Beispiel: {"{Hallo|Hi|Guten Tag}"} wird zufaellig zu
                        &quot;Hallo&quot;, &quot;Hi&quot; oder &quot;Guten Tag&quot;.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {DEFAULT_VARIABLES.map((v) => (
                  <Button
                    key={v.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => insertVariable(v.name, "body")}
                  >
                    {v.label}
                  </Button>
                ))}
              </div>
              <Textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder={`{Hallo|Hi|Guten Tag} {{firstName}},

ich hoffe, es geht Ihnen gut.

{Ich wollte mich kurz vorstellen|Kurz zu mir}: ...

Beste Gruesse`}
                rows={12}
              />
              {countSpintaxVariants(newSubject + newBody) > 1 && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Wand2 className="h-3 w-3 text-purple-500" />
                  {countSpintaxVariants(newSubject + newBody)} moegliche Varianten
                  durch Spintax
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAIGenerator(true)}
              >
                <Sparkles className="mr-1 h-4 w-4" />
                KI-Generator
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateSpintax}
                disabled={!newBody || spintaxLoading}
              >
                {spintaxLoading ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-1 h-4 w-4" />
                )}
                Spintax
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSpamCheck}
                disabled={!newSubject || !newBody}
              >
                <AlertTriangle className="mr-1 h-4 w-4" />
                Spam-Check
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePreview(newSubject, newBody)}
                disabled={!newSubject || !newBody}
              >
                <Eye className="mr-1 h-4 w-4" />
                Vorschau
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleAddSequence} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Hinzufuegen
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>E-Mail Vorschau</DialogTitle>
            <DialogDescription>
              So koennte die E-Mail mit Beispieldaten aussehen.
            </DialogDescription>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">BETREFF</Label>
                <div className="mt-1 p-3 bg-muted rounded-lg font-medium">
                  {previewData.subject}
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">INHALT</Label>
                <div className="mt-1 p-4 bg-muted rounded-lg whitespace-pre-wrap">
                  {previewData.body}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowPreview(false)}>Schliessen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Generator Dialog */}
      <Dialog open={showAIGenerator} onOpenChange={setShowAIGenerator}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              KI E-Mail Generator
            </DialogTitle>
            <DialogDescription>
              Beschreiben Sie Ihre E-Mail und die KI erstellt sie für Sie.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Zweck der E-Mail</Label>
              <Input
                value={aiPurpose}
                onChange={(e) => setAiPurpose(e.target.value)}
                placeholder="z.B. Kaltakquise für SaaS-Produkt"
              />
            </div>

            <div className="space-y-2">
              <Label>Zielgruppe</Label>
              <Input
                value={aiTargetAudience}
                onChange={(e) => setAiTargetAudience(e.target.value)}
                placeholder="z.B. CEOs von mittelständischen Unternehmen"
              />
            </div>

            <div className="space-y-2">
              <Label>Tonalität</Label>
              <Select value={aiTone} onValueChange={(v) => setAiTone(v as typeof aiTone)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professionell</SelectItem>
                  <SelectItem value="formal">Formell</SelectItem>
                  <SelectItem value="friendly">Freundlich</SelectItem>
                  <SelectItem value="casual">Locker</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Call-to-Action</Label>
              <Input
                value={aiCallToAction}
                onChange={(e) => setAiCallToAction(e.target.value)}
                placeholder="z.B. Termin für Demo vereinbaren"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIGenerator(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAIGenerate} disabled={aiLoading}>
              {aiLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Sparkles className="mr-2 h-4 w-4" />
              Generieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Spam Check Dialog */}
      <Dialog open={showSpamCheck} onOpenChange={setShowSpamCheck}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Spam-Analyse
            </DialogTitle>
            <DialogDescription>
              Prüfung auf mögliche Spam-Trigger und Zustellbarkeitsprobleme.
            </DialogDescription>
          </DialogHeader>

          {spamLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-3 text-muted-foreground">Analysiere E-Mail...</span>
            </div>
          ) : spamResult ? (
            <div className="space-y-4">
              {/* Score */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                <div className="flex items-center gap-3">
                  {spamResult.rating === "safe" && (
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  )}
                  {spamResult.rating === "caution" && (
                    <AlertTriangle className="h-8 w-8 text-yellow-500" />
                  )}
                  {spamResult.rating === "warning" && (
                    <AlertTriangle className="h-8 w-8 text-orange-500" />
                  )}
                  {spamResult.rating === "danger" && (
                    <XCircle className="h-8 w-8 text-red-500" />
                  )}
                  <div>
                    <div className="font-semibold">
                      Spam-Score: {spamResult.score}/100
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {spamResult.rating === "safe" && "Sehr gute Zustellbarkeit"}
                      {spamResult.rating === "caution" && "Kleine Verbesserungen möglich"}
                      {spamResult.rating === "warning" && "Überarbeitung empfohlen"}
                      {spamResult.rating === "danger" && "Hohe Spam-Wahrscheinlichkeit"}
                    </div>
                  </div>
                </div>
                <Badge
                  variant={
                    spamResult.rating === "safe"
                      ? "default"
                      : spamResult.rating === "caution"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {spamResult.rating === "safe" && "Sicher"}
                  {spamResult.rating === "caution" && "Vorsicht"}
                  {spamResult.rating === "warning" && "Warnung"}
                  {spamResult.rating === "danger" && "Gefahr"}
                </Badge>
              </div>

              {/* Issues */}
              {spamResult.issues.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Gefundene Probleme</Label>
                  <div className="mt-2 space-y-2">
                    {spamResult.issues.map((issue, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-2 rounded bg-muted/50 text-sm"
                      >
                        <Badge
                          variant="outline"
                          className={
                            issue.severity === "high"
                              ? "text-red-600 border-red-300"
                              : issue.severity === "medium"
                              ? "text-orange-600 border-orange-300"
                              : "text-yellow-600 border-yellow-300"
                          }
                        >
                          {issue.severity === "high" ? "Hoch" : issue.severity === "medium" ? "Mittel" : "Niedrig"}
                        </Badge>
                        <span>{issue.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {spamResult.suggestions.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Verbesserungsvorschläge</Label>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {spamResult.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setShowSpamCheck(false)}>Schließen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
