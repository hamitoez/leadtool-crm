"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Loader2,
  Euro,
  Calendar,
  Building,
  User,
  Mail,
  Phone,
  ExternalLink,
  Clock,
  PhoneCall,
  MessageSquare,
  CalendarPlus,
  FileText,
  CheckSquare,
  Pencil,
  TrendingUp,
  ArrowRight,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ContactTimeline } from "@/components/timeline/contact-timeline";
import { CreateActivityDialog } from "@/components/activities/create-activity-dialog";
import { CreateReminderDialog } from "@/components/reminders/create-reminder-dialog";
import { ComposeEmailDialog } from "@/components/email/compose-email-dialog";

interface Cell {
  id: string;
  value: unknown;
  column: {
    id: string;
    name: string;
    type: string;
  };
}

interface Row {
  id: string;
  cells: Cell[];
  table?: {
    id: string;
    name: string;
    projectId: string;
  };
}

interface Deal {
  id: string;
  rowId: string;
  stageId: string;
  value: number | null;
  probability: number;
  expectedClose: string | null;
  position: number;
  row: Row;
  stageChangedAt: string;
  createdAt?: string;
  stage?: {
    id: string;
    name: string;
    color: string;
    stageType: string;
  };
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
  dueDate: string | null;
  completedAt: string | null;
  priority: string | null;
}

interface DealDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal | null;
  onUpdated?: () => void;
}

const activityTypeLabels: Record<string, string> = {
  CALL: "Anruf",
  EMAIL: "E-Mail",
  MEETING: "Meeting",
  NOTE: "Notiz",
  TASK: "Aufgabe",
  DOCUMENT: "Dokument",
};

const quickActions = [
  { type: "CALL", icon: PhoneCall, label: "Anruf", color: "text-green-600" },
  { type: "EMAIL", icon: MessageSquare, label: "E-Mail", color: "text-blue-600" },
  { type: "MEETING", icon: CalendarPlus, label: "Meeting", color: "text-purple-600" },
  { type: "NOTE", icon: FileText, label: "Notiz", color: "text-orange-600" },
  { type: "TASK", icon: CheckSquare, label: "Aufgabe", color: "text-red-600" },
];

export function DealDetailSheet({
  open,
  onOpenChange,
  deal,
  onUpdated,
}: DealDetailSheetProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editProbability, setEditProbability] = useState(50);
  const [editExpectedClose, setEditExpectedClose] = useState<Date | undefined>();
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [activityType, setActivityType] = useState("NOTE");
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  // Extract contact info from deal
  const getDisplayData = useCallback(() => {
    if (!deal) return { name: "", company: "", email: "", phone: "", website: "" };

    const cells = deal.row.cells;
    const getValue = (types: string[], namePatterns: string[]) => {
      const cell = cells.find(
        (c) =>
          types.includes(c.column.type) ||
          namePatterns.some((p) => c.column.name.toLowerCase().includes(p))
      );
      if (!cell?.value) return "";
      if (typeof cell.value === "string") return cell.value;
      if (typeof cell.value === "object" && cell.value !== null && "name" in cell.value) {
        return (cell.value as { name: string }).name;
      }
      return String(cell.value);
    };

    return {
      company: getValue(["COMPANY"], ["firma", "company", "unternehmen"]),
      name: getValue(["PERSON"], ["name", "kontakt", "ansprechpartner"]),
      email: getValue(["EMAIL"], ["email", "e-mail", "mail"]),
      phone: getValue(["PHONE"], ["telefon", "phone", "tel"]),
      website: getValue(["URL"], ["website", "url", "webseite"]),
    };
  }, [deal]);

  const displayData = getDisplayData();

  // Fetch activities
  const fetchActivities = useCallback(async () => {
    if (!deal) return;

    setLoadingActivities(true);
    try {
      const res = await fetch(`/api/rows/${deal.rowId}/activities`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoadingActivities(false);
    }
  }, [deal]);

  useEffect(() => {
    if (open && deal) {
      fetchActivities();
      setEditValue(deal.value?.toString() || "");
      setEditProbability(deal.probability);
      setEditExpectedClose(deal.expectedClose ? new Date(deal.expectedClose) : undefined);
    }
  }, [open, deal, fetchActivities]);

  const handleSaveDeal = async () => {
    if (!deal) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: editValue ? parseFloat(editValue) : null,
          probability: editProbability,
          expectedClose: editExpectedClose?.toISOString() || null,
        }),
      });

      if (res.ok) {
        toast.success("Deal aktualisiert");
        setEditMode(false);
        onUpdated?.();
      } else {
        toast.error("Fehler beim Speichern");
      }
    } catch (error) {
      console.error("Error saving deal:", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAction = (type: string) => {
    if (type === "EMAIL") {
      setEmailDialogOpen(true);
    } else {
      setActivityType(type);
      setActivityDialogOpen(true);
    }
  };

  const handleActivityCreated = () => {
    setActivityDialogOpen(false);
    fetchActivities();
  };

  // Calculate days in current stage
  const daysInStage = deal
    ? Math.floor(
        (Date.now() - new Date(deal.stageChangedAt).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  // Probability color
  const getProbabilityColor = (prob: number) => {
    if (prob >= 70) return "text-green-600 bg-green-100";
    if (prob >= 40) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  if (!deal) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
          {/* Header */}
          <SheetHeader className="p-6 pb-4 border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1 min-w-0">
                  <SheetTitle className="text-xl font-bold truncate">
                    {displayData.company || displayData.name || "Deal"}
                  </SheetTitle>
                  {displayData.company && displayData.name && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {displayData.name}
                    </p>
                  )}
                </div>
                {deal.stage && (
                  <Badge
                    style={{ backgroundColor: deal.stage.color }}
                    className="text-white shrink-0"
                  >
                    {deal.stage.name}
                  </Badge>
                )}
              </div>

              {/* Quick Stats */}
              <div className="flex items-center gap-4 text-sm">
                {deal.value && (
                  <div className="flex items-center gap-1">
                    <Euro className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">
                      {deal.value.toLocaleString("de-DE")}
                    </span>
                  </div>
                )}
                <Badge
                  variant="secondary"
                  className={cn("text-xs", getProbabilityColor(deal.probability))}
                >
                  {deal.probability}%
                </Badge>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {daysInStage} Tage
                </span>
              </div>
            </div>
          </SheetHeader>

          {/* Content with Tabs */}
          <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-4 grid grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="activities">
                Aktivitaeten
                {activities.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {activities.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              {/* Details Tab */}
              <TabsContent value="details" className="p-6 space-y-6 mt-0">
                {/* Contact Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Kontaktdaten
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {displayData.email && (
                      <a
                        href={`mailto:${displayData.email}`}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      >
                        <Mail className="h-4 w-4" />
                        {displayData.email}
                      </a>
                    )}
                    {displayData.phone && (
                      <a
                        href={`tel:${displayData.phone}`}
                        className="flex items-center gap-2 text-sm text-green-600 hover:underline"
                      >
                        <Phone className="h-4 w-4" />
                        {displayData.phone}
                      </a>
                    )}
                    {displayData.website && (
                      <a
                        href={displayData.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-purple-600 hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Website
                      </a>
                    )}
                    {!displayData.email && !displayData.phone && !displayData.website && (
                      <p className="text-sm text-muted-foreground">
                        Keine Kontaktdaten vorhanden
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Deal Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Deal-Informationen
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditMode(!editMode)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        {editMode ? "Abbrechen" : "Bearbeiten"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {editMode ? (
                      <>
                        <div className="space-y-2">
                          <Label>Deal-Wert (EUR)</Label>
                          <Input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Wahrscheinlichkeit: {editProbability}%</Label>
                          <Slider
                            value={[editProbability]}
                            onValueChange={(v) => setEditProbability(v[0])}
                            min={0}
                            max={100}
                            step={5}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Erwarteter Abschluss</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !editExpectedClose && "text-muted-foreground"
                                )}
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                {editExpectedClose
                                  ? format(editExpectedClose, "dd.MM.yyyy", { locale: de })
                                  : "Datum waehlen"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <CalendarComponent
                                mode="single"
                                selected={editExpectedClose}
                                onSelect={setEditExpectedClose}
                                locale={de}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <Button
                          onClick={handleSaveDeal}
                          disabled={saving}
                          className="w-full"
                        >
                          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Speichern
                        </Button>
                      </>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Wert</p>
                          <p className="font-semibold">
                            {deal.value
                              ? `${deal.value.toLocaleString("de-DE")} EUR`
                              : "Nicht angegeben"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Wahrscheinlichkeit</p>
                          <p className="font-semibold">{deal.probability}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Erwarteter Abschluss</p>
                          <p className="font-semibold">
                            {deal.expectedClose
                              ? format(new Date(deal.expectedClose), "dd.MM.yyyy", {
                                  locale: de,
                                })
                              : "Nicht angegeben"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Erstellt</p>
                          <p className="font-semibold">
                            {deal.createdAt
                              ? formatDistanceToNow(new Date(deal.createdAt), {
                                  addSuffix: true,
                                  locale: de,
                                })
                              : "Unbekannt"}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Link to Table */}
                {deal.row.table && (
                  <Button
                    variant="outline"
                    className="w-full"
                    asChild
                  >
                    <a
                      href={`/projects/${deal.row.table.projectId}?tableId=${deal.row.table.id}`}
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      In Tabelle anzeigen
                    </a>
                  </Button>
                )}
              </TabsContent>

              {/* Activities Tab */}
              <TabsContent value="activities" className="p-6 space-y-4 mt-0">
                {/* Quick Actions */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Schnellaktionen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {quickActions.map((action) => (
                        <Button
                          key={action.type}
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickAction(action.type)}
                          className="flex items-center gap-1.5"
                        >
                          <action.icon className={cn("h-4 w-4", action.color)} />
                          {action.label}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReminderDialogOpen(true)}
                        className="flex items-center gap-1.5"
                      >
                        <Bell className="h-4 w-4 text-yellow-600" />
                        Erinnerung
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Activities List */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Letzte Aktivitaeten
                  </h3>
                  {loadingActivities ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Keine Aktivitaeten vorhanden
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activities.slice(0, 10).map((activity) => (
                        <Card key={activity.id} className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {activityTypeLabels[activity.type] || activity.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(activity.createdAt), {
                                    addSuffix: true,
                                    locale: de,
                                  })}
                                </span>
                              </div>
                              <p className="font-medium text-sm mt-1 truncate">
                                {activity.title}
                              </p>
                              {activity.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {activity.description}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant={
                                activity.status === "COMPLETED"
                                  ? "default"
                                  : activity.status === "PLANNED"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="shrink-0 text-xs"
                            >
                              {activity.status === "COMPLETED"
                                ? "Erledigt"
                                : activity.status === "PLANNED"
                                ? "Geplant"
                                : activity.status}
                            </Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Timeline Tab */}
              <TabsContent value="timeline" className="p-6 mt-0">
                <ContactTimeline rowId={deal.rowId} />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Create Activity Dialog */}
      <CreateActivityDialog
        open={activityDialogOpen}
        onOpenChange={setActivityDialogOpen}
        rowId={deal?.rowId || ""}
        defaultType={activityType}
        onSuccess={handleActivityCreated}
      />

      {/* Create Reminder Dialog */}
      <CreateReminderDialog
        open={reminderDialogOpen}
        onOpenChange={setReminderDialogOpen}
        rowId={deal?.rowId}
        defaultTitle={displayData.company || displayData.name || ""}
        onSuccess={() => setReminderDialogOpen(false)}
      />

      {/* Compose Email Dialog */}
      <ComposeEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        rowId={deal?.rowId}
        defaultTo={displayData.email}
        defaultToName={displayData.name || displayData.company}
        contactData={{
          firma: displayData.company,
          company: displayData.company,
          email: displayData.email,
          telefon: displayData.phone,
          phone: displayData.phone,
          anrede: displayData.name ? `Sehr geehrte(r) ${displayData.name}` : "Sehr geehrte Damen und Herren",
        }}
        onSuccess={() => setEmailDialogOpen(false)}
      />
    </>
  );
}
