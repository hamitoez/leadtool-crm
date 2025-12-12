"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, Globe, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface QuickAddDialogProps {
  tableId: string;
  columns: { id: string; name: string; type: string }[];
  onLeadsAdded: () => void;
  children?: React.ReactNode;
  // Controlled mode props
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function QuickAddDialog({
  tableId,
  columns,
  onLeadsAdded,
  children,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: QuickAddDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setUncontrolledOpen;
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Find relevant columns for auto-fill
  const urlColumn = columns.find(
    (c) =>
      c.type === "URL" ||
      c.name.toLowerCase().includes("website") ||
      c.name.toLowerCase().includes("url") ||
      c.name.toLowerCase().includes("webseite")
  );

  const companyColumn = columns.find(
    (c) =>
      c.type === "COMPANY" ||
      c.name.toLowerCase().includes("firma") ||
      c.name.toLowerCase().includes("company") ||
      c.name.toLowerCase().includes("unternehmen") ||
      c.name.toLowerCase().includes("name")
  );

  // Parse input - each line is a new lead
  const parseInput = (text: string) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines.map((line) => {
      // Check if it's a URL
      const isUrl =
        line.startsWith("http://") ||
        line.startsWith("https://") ||
        line.startsWith("www.") ||
        /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/.test(line);

      if (isUrl) {
        // Normalize URL
        let url = line;
        if (!url.startsWith("http")) {
          url = "https://" + url;
        }

        // Extract company name from domain
        try {
          const domain = new URL(url).hostname.replace("www.", "");
          const companyName = domain.split(".")[0];
          const formattedName =
            companyName.charAt(0).toUpperCase() + companyName.slice(1);
          return { url, companyName: formattedName, type: "url" as const };
        } catch {
          return { url, companyName: "", type: "url" as const };
        }
      } else {
        // It's a company name
        return { url: "", companyName: line, type: "company" as const };
      }
    });
  };

  const parsedLeads = parseInput(input);
  const urlCount = parsedLeads.filter((l) => l.type === "url").length;
  const companyCount = parsedLeads.filter((l) => l.type === "company").length;

  const handleSubmit = async () => {
    if (parsedLeads.length === 0) {
      toast.error("Bitte gib mindestens eine URL oder Firma ein");
      return;
    }

    setIsLoading(true);

    try {
      // Create rows with cell data
      const rowsData = parsedLeads.map((lead) => {
        const cells: Record<string, string> = {};

        if (urlColumn && lead.url) {
          cells[urlColumn.id] = lead.url;
        }

        if (companyColumn && lead.companyName) {
          cells[companyColumn.id] = lead.companyName;
        }

        return cells;
      });

      const response = await fetch(`/api/tables/${tableId}/rows/bulk-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsData }),
      });

      if (!response.ok) {
        throw new Error("Failed to add leads");
      }

      const result = await response.json();
      toast.success(`${result.count} Lead(s) hinzugefügt`);
      setInput("");
      setOpen(false);
      onLeadsAdded();
    } catch (error) {
      console.error("Error adding leads:", error);
      toast.error("Fehler beim Hinzufügen der Leads");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Only render trigger if children provided or not controlled */}
      {(children || !isControlled) && (
        <DialogTrigger asChild>
          {children || (
            <Button variant="outline" size="sm" className="h-9">
              <PlusCircle className="h-4 w-4 mr-2" />
              Quick Add
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5" />
            Leads manuell hinzufügen
          </DialogTitle>
          <DialogDescription>
            Gib URLs oder Firmennamen ein - eine pro Zeile. URLs werden
            automatisch erkannt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="leads-input">URLs / Firmennamen</Label>
            <Textarea
              id="leads-input"
              placeholder={`https://example.com
www.firma.de
Mustermann GmbH
https://another-company.com`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          {/* Preview */}
          {parsedLeads.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Vorschau</Label>
              <div className="flex gap-2">
                {urlCount > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Globe className="h-3 w-3" />
                    {urlCount} URL{urlCount !== 1 ? "s" : ""}
                  </Badge>
                )}
                {companyCount > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {companyCount} Firma{companyCount !== 1 ? "en" : ""}
                  </Badge>
                )}
              </div>

              <div className="max-h-[150px] overflow-y-auto rounded-md border bg-muted/30 p-2">
                <ul className="space-y-1 text-sm">
                  {parsedLeads.slice(0, 10).map((lead, i) => (
                    <li key={i} className="flex items-center gap-2">
                      {lead.type === "url" ? (
                        <Globe className="h-3 w-3 text-blue-500 flex-shrink-0" />
                      ) : (
                        <Building2 className="h-3 w-3 text-orange-500 flex-shrink-0" />
                      )}
                      <span className="truncate">
                        {lead.type === "url" ? lead.url : lead.companyName}
                      </span>
                      {lead.type === "url" && lead.companyName && (
                        <span className="text-xs text-muted-foreground">
                          → {lead.companyName}
                        </span>
                      )}
                    </li>
                  ))}
                  {parsedLeads.length > 10 && (
                    <li className="text-muted-foreground">
                      ... und {parsedLeads.length - 10} weitere
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Column info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>URL-Spalte:</strong>{" "}
              {urlColumn ? urlColumn.name : "Nicht gefunden"}
            </p>
            <p>
              <strong>Firmen-Spalte:</strong>{" "}
              {companyColumn ? companyColumn.name : "Nicht gefunden"}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={parsedLeads.length === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Hinzufügen...
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4 mr-2" />
                {parsedLeads.length} Lead{parsedLeads.length !== 1 ? "s" : ""}{" "}
                hinzufügen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
