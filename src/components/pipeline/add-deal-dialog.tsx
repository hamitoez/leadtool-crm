"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Loader2, Building2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  cells: Array<{
    value: unknown;
    column: { name: string; type: string };
  }>;
}

interface AddDealDialogProps {
  stageId: string;
  stageName: string;
  projectId: string;
  onDealAdded: () => void;
  children?: React.ReactNode;
}

export function AddDealDialog({
  stageId,
  stageName,
  projectId,
  onDealAdded,
  children,
}: AddDealDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [dealValue, setDealValue] = useState("");

  const fetchAvailableRows = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch rows that don't have deals yet
      const res = await fetch(`/api/projects/${projectId}/rows-without-deals`);
      if (res.ok) {
        const data = await res.json();
        setRows(data);
      }
    } catch (error) {
      console.error("Error fetching rows:", error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      fetchAvailableRows();
    }
  }, [open, fetchAvailableRows]);

  const getRowDisplayInfo = (row: Row) => {
    const companyCell = row.cells.find(
      (c) => c.column.type === "COMPANY" || c.column.name.toLowerCase().includes("firma")
    );
    const nameCell = row.cells.find(
      (c) => c.column.type === "TEXT" || c.column.name.toLowerCase().includes("name")
    );
    const emailCell = row.cells.find((c) => c.column.type === "EMAIL");
    const phoneCell = row.cells.find((c) => c.column.type === "PHONE");

    return {
      company: companyCell?.value as string || null,
      name: nameCell?.value as string || null,
      email: emailCell?.value as string || null,
      phone: phoneCell?.value as string || null,
    };
  };

  const filteredRows = rows.filter((row) => {
    const info = getRowDisplayInfo(row);
    const searchLower = search.toLowerCase();
    return (
      (info.company?.toLowerCase().includes(searchLower)) ||
      (info.name?.toLowerCase().includes(searchLower)) ||
      (info.email?.toLowerCase().includes(searchLower))
    );
  });

  const handleAddDeal = async () => {
    if (!selectedRow) return;

    setSaving(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowId: selectedRow,
          stageId,
          value: dealValue ? parseFloat(dealValue) : null,
        }),
      });

      if (res.ok) {
        toast.success("Deal hinzugefuegt");
        setOpen(false);
        setSelectedRow(null);
        setDealValue("");
        onDealAdded();
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Erstellen des Deals");
      }
    } catch (error) {
      console.error("Error creating deal:", error);
      toast.error("Fehler beim Erstellen des Deals");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" className="w-full justify-start text-muted-foreground">
            <Plus className="h-4 w-4 mr-2" />
            Deal hinzufuegen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle className="truncate">Deal zu &quot;{stageName}&quot; hinzufuegen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Lead suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Rows List */}
          <div className="h-[300px] border rounded-md overflow-hidden">
            <ScrollArea className="h-full w-full">
              {loading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-center p-4">
                  <p className="text-muted-foreground">
                    {rows.length === 0
                      ? "Keine verfuegbaren Leads. Alle Leads sind bereits in der Pipeline."
                      : "Keine Leads gefunden."}
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredRows.map((row) => {
                    const info = getRowDisplayInfo(row);
                    const displayName = info.company || info.name || info.email || "Unbekannt";

                    return (
                      <button
                        key={row.id}
                        onClick={() => setSelectedRow(row.id)}
                        className={cn(
                          "w-full text-left p-3 rounded-md border transition-colors overflow-hidden",
                          selectedRow === row.id
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:bg-muted"
                        )}
                      >
                        <div className="flex items-start gap-3 overflow-hidden">
                          <div className="p-2 rounded-md bg-muted shrink-0">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="font-medium truncate">{displayName}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground overflow-hidden">
                              {info.email && (
                                <span className="flex items-center gap-1 truncate min-w-0 flex-1">
                                  <Mail className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{info.email}</span>
                                </span>
                              )}
                              {info.phone && (
                                <span className="flex items-center gap-1 shrink-0">
                                  <Phone className="h-3 w-3" />
                                  {info.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Deal Value */}
          {selectedRow && (
            <div className="space-y-2">
              <Label htmlFor="dealValue">Deal-Wert (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  EUR
                </span>
                <Input
                  id="dealValue"
                  type="number"
                  placeholder="0"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  className="pl-12"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleAddDeal} disabled={!selectedRow || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deal erstellen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
