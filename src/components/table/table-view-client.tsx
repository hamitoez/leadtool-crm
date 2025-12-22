"use client";

import React, { useCallback, useState, useEffect, Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "./data-table";
import { useCellUpdate } from "@/hooks/use-cell-update";
import { useTableShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { toast } from "sonner";
import { RowData, ColumnConfig, CellValue, TableView, TableViewConfig } from "@/types/table";
import { AddColumnDialog } from "./add-column-dialog";
import { QuickAddDialog } from "./quick-add-dialog";
import { Button } from "@/components/ui/button";
import { Plus, PlusCircle, Loader2 } from "lucide-react";
import { exportTable, getContactDataStats, ContactDataFilter, exportTableAdvanced, ExportDialogConfig } from "@/lib/export";
import type { ScrapeResult } from "./web-scraper";
import type { ExportConfig } from "./export-dialog";

// Lazy load heavy dialog components for better initial load performance
const RowDetailsSheet = lazy(() => import("./row-details-sheet").then(m => ({ default: m.RowDetailsSheet })));
const AIComplimentGenerator = lazy(() => import("./ai-compliment-generator").then(m => ({ default: m.AIComplimentGenerator })));
const WebScraper = lazy(() => import("./web-scraper").then(m => ({ default: m.WebScraper })));
const ExportDialog = lazy(() => import("./export-dialog").then(m => ({ default: m.ExportDialog })));
const KeyboardShortcutsDialog = lazy(() => import("./keyboard-shortcuts-dialog").then(m => ({ default: m.KeyboardShortcutsDialog })));

// Loading fallback for dialogs
const DialogLoader = () => (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

interface TableViewClientProps {
  initialRows: RowData[];
  columns: ColumnConfig[];
  tableId: string;
  tableName?: string;
}

export function TableViewClient({
  initialRows,
  columns,
  tableId,
  tableName = "table",
}: TableViewClientProps) {
  const router = useRouter();
  const [rows, setRows] = React.useState(initialRows);
  const [selectedRow, setSelectedRow] = useState<RowData | null>(null);
  const [isRowDetailsOpen, setIsRowDetailsOpen] = useState(false);

  // AI Compliment Generator state
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);
  const [selectedRowsForAI, setSelectedRowsForAI] = useState<RowData[]>([]);

  // Web Scraper state
  const [isWebScraperOpen, setIsWebScraperOpen] = useState(false);
  const [selectedRowsForScraper, setSelectedRowsForScraper] = useState<RowData[]>([]);

  // Export Dialog state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // Keyboard Shortcuts Dialog state
  const [isShortcutsDialogOpen, setIsShortcutsDialogOpen] = useState(false);

  // Quick Add Dialog state (for keyboard shortcut)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Saved Views state
  const [views, setViews] = useState<TableView[]>([]);
  const [currentViewId, setCurrentViewId] = useState<string | undefined>();

  React.useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  // Fetch saved views on mount
  useEffect(() => {
    const fetchViews = async () => {
      try {
        const response = await fetch(`/api/tables/${tableId}/views`);
        if (response.ok) {
          const data = await response.json();
          setViews(data);
          // Set default view if exists
          const defaultView = data.find((v: TableView) => v.isDefault);
          if (defaultView) {
            setCurrentViewId(defaultView.id);
          }
        }
      } catch {
        console.error("Failed to fetch views");
      }
    };
    fetchViews();
  }, [tableId]);

  const { updateCell, isUpdating } = useCellUpdate({
    // No individual toast per cell - bulk operations show their own summary toast
    onError: (err: Error) => {
      toast.error(`Failed to update cell: ${err.message}`);
    },
    debounceMs: 500,
  });

  // Keyboard shortcuts
  useTableShortcuts({
    onNewRow: () => handleAddRow(),
    onQuickAdd: () => setIsQuickAddOpen(true),
    onExport: () => setIsExportDialogOpen(true),
    onHelp: () => setIsShortcutsDialogOpen(true),
  });

  const handleCellUpdate = useCallback(
    async (cellId: string, value: CellValue) => {
      await updateCell(cellId, value);
      // Optimistically update the local state
      setRows((prevRows) =>
        prevRows.map((row) => {
          const cell = Object.values(row.cells).find((c) => c.id === cellId);
          if (cell) {
            return {
              ...row,
              cells: {
                ...row.cells,
                [cell.columnId]: {
                  ...cell,
                  value,
                },
              },
            };
          }
          return row;
        })
      );
    },
    [updateCell]
  );

  // Handle toggling favorite status
  const handleToggleFavorite = useCallback(
    async (rowId: string, isFavorite: boolean) => {
      try {
        const response = await fetch(`/api/tables/rows/${rowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFavorite }),
        });

        if (!response.ok) throw new Error("Failed to update favorite");

        // Optimistically update local state
        setRows((prevRows) =>
          prevRows.map((row) =>
            row.id === rowId ? { ...row, isFavorite } : row
          )
        );
      } catch {
        toast.error("Fehler beim Aktualisieren des Favoriten");
      }
    },
    []
  );

  // Handle updating notes
  const handleUpdateNotes = useCallback(
    async (rowId: string, notes: string | null) => {
      try {
        const response = await fetch(`/api/tables/rows/${rowId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        });

        if (!response.ok) throw new Error("Failed to update notes");

        // Optimistically update local state
        setRows((prevRows) =>
          prevRows.map((row) =>
            row.id === rowId ? { ...row, notes } : row
          )
        );
      } catch {
        toast.error("Fehler beim Speichern der Notiz");
      }
    },
    []
  );

  const handleColumnReorder = useCallback(
    async (columnIds: string[]) => {
      try {
        const response = await fetch(`/api/tables/${tableId}/columns/reorder`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columnIds }),
        });

        if (!response.ok) throw new Error("Failed to save column order");

        toast.success("Column order saved");
      } catch {
        toast.error("Failed to save column order");
      }
    },
    [tableId]
  );

  const handleColumnRename = useCallback(
    async (columnId: string, newName: string) => {
      try {
        const response = await fetch(`/api/tables/columns/${columnId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName }),
        });

        if (!response.ok) throw new Error("Failed to rename column");

        toast.success("Column renamed successfully");
        router.refresh();
      } catch {
        toast.error("Failed to rename column");
      }
    },
    [router]
  );

  const handleColumnDelete = useCallback(
    async (columnId: string) => {
      if (!confirm("Are you sure you want to delete this column?")) return;

      try {
        const response = await fetch(`/api/tables/columns/${columnId}`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error("Failed to delete column");

        toast.success("Column deleted successfully");
        router.refresh();
      } catch {
        toast.error("Failed to delete column");
      }
    },
    [router]
  );

  const handleColumnHide = useCallback(
    async (columnId: string) => {
      try {
        const response = await fetch(`/api/tables/columns/${columnId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isVisible: false }),
        });

        if (!response.ok) throw new Error("Failed to hide column");

        toast.success("Column hidden");
        router.refresh();
      } catch {
        toast.error("Failed to hide column");
      }
    },
    [router]
  );

  const handleClearColumn = useCallback(
    async (columnId: string) => {
      const columnName = columns.find(c => c.id === columnId)?.name || "Spalte";
      if (!confirm(`Alle Werte in "${columnName}" löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;

      try {
        const response = await fetch(`/api/tables/columns/${columnId}/clear`, {
          method: "POST",
        });

        if (!response.ok) throw new Error("Failed to clear column");

        const data = await response.json();
        toast.success(data.message || "Spalte geleert");

        // Update local state to reflect cleared values
        setRows((prevRows) =>
          prevRows.map((row) => {
            if (row.cells[columnId]) {
              return {
                ...row,
                cells: {
                  ...row.cells,
                  [columnId]: {
                    ...row.cells[columnId],
                    value: null,
                  },
                },
              };
            }
            return row;
          })
        );
      } catch {
        toast.error("Fehler beim Leeren der Spalte");
      }
    },
    [columns]
  );

  const handleAddRow = useCallback(async () => {
    try {
      const response = await fetch(`/api/tables/${tableId}/rows`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to create row");

      toast.success("Row added successfully");
      router.refresh();
    } catch {
      toast.error("Failed to add row");
    }
  }, [tableId, router]);

  const handleRowDelete = useCallback(
    async (rowId: string) => {
      if (!confirm("Are you sure you want to delete this row?")) return;

      try {
        const response = await fetch(`/api/tables/rows/${rowId}`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error("Failed to delete row");

        toast.success("Row deleted successfully");
        setRows((prevRows) => prevRows.filter((row) => row.id !== rowId));
        router.refresh();
      } catch {
        toast.error("Failed to delete row");
      }
    },
    [router]
  );

  const handleBulkRowDelete = useCallback(
    async (rowIds: string[]) => {
      if (!confirm(`Are you sure you want to delete ${rowIds.length} row(s)?`)) return;

      try {
        const response = await fetch(`/api/tables/${tableId}/rows/bulk-delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rowIds }),
        });

        if (!response.ok) throw new Error("Failed to delete rows");

        toast.success(`${rowIds.length} row(s) deleted successfully`);
        setRows((prevRows) => prevRows.filter((row) => !rowIds.includes(row.id)));
        router.refresh();
      } catch {
        toast.error("Failed to delete rows");
      }
    },
    [tableId, router]
  );

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  // Open export dialog
  const handleOpenExportDialog = useCallback(() => {
    setIsExportDialogOpen(true);
  }, []);

  // Handle export from dialog
  const handleExportFromDialog = useCallback(
    (config: ExportConfig) => {
      try {
        const exportConfig: ExportDialogConfig = {
          format: config.format,
          filterMode: config.filterMode,
          selectedFields: config.selectedFields,
          requireAll: config.requireAll,
        };
        exportTableAdvanced(rows, columns, tableName, exportConfig);

        let filterLabel = "";
        if (config.filterMode === "with-selected") {
          filterLabel = " (mit ausgewählten Kontaktdaten)";
        } else if (config.filterMode === "without-selected") {
          filterLabel = " (ohne ausgewählte Kontaktdaten)";
        }
        toast.success(`Exportiert als ${config.format.toUpperCase()}${filterLabel}`);
      } catch {
        toast.error("Export fehlgeschlagen");
      }
    },
    [rows, columns, tableName]
  );

  // Legacy export handler (for backwards compatibility)
  const handleExport = useCallback(
    (format: "csv" | "json", contactFilter: ContactDataFilter = "all") => {
      // If called without filter, open the dialog instead
      if (contactFilter === "all") {
        setIsExportDialogOpen(true);
        return;
      }
      try {
        exportTable(rows, columns, tableName, format, contactFilter);
        const filterLabel = contactFilter === "with-contact"
          ? " (mit Kontakt)"
          : contactFilter === "without-contact"
            ? " (ohne Kontakt)"
            : "";
        toast.success(`Exportiert als ${format.toUpperCase()}${filterLabel}`);
      } catch {
        toast.error("Export fehlgeschlagen");
      }
    },
    [rows, columns, tableName]
  );

  // Calculate contact data stats for export UI
  const contactDataStats = React.useMemo(
    () => getContactDataStats(rows, columns),
    [rows, columns]
  );

  const handleRowClick = useCallback((row: RowData) => {
    setSelectedRow(row);
    setIsRowDetailsOpen(true);
  }, []);

  const handleRowDetailsClose = useCallback(() => {
    setIsRowDetailsOpen(false);
    setSelectedRow(null);
  }, []);

  // AI Compliment Generator handlers
  const handleGenerateCompliments = useCallback((selectedRows: RowData[]) => {
    setSelectedRowsForAI(selectedRows);
    setIsAIGeneratorOpen(true);
  }, []);

  // Web Scraper handlers
  const handleScrapeWebsites = useCallback((selectedRows: RowData[]) => {
    setSelectedRowsForScraper(selectedRows);
    setIsWebScraperOpen(true);
  }, []);

  const handleBulkComplimentsComplete = useCallback(
    (results: Map<string, string>) => {
      // Update local rows with generated compliments
      setRows((prevRows) =>
        prevRows.map((row) => {
          const compliment = results.get(row.id);
          if (!compliment) return row;

          // Find the compliment column (AI_GENERATED or named "Kompliment")
          const complimentCol = columns.find(
            (c) =>
              c.name.toLowerCase().includes("kompliment") ||
              c.type === "AI_GENERATED"
          );

          if (!complimentCol) return row;

          const cell = row.cells[complimentCol.id];
          if (!cell) return row;

          return {
            ...row,
            cells: {
              ...row.cells,
              [complimentCol.id]: {
                ...cell,
                value: compliment,
              },
            },
          };
        })
      );

      setIsAIGeneratorOpen(false);
      router.refresh();
    },
    [columns, router]
  );

  // Web Scraper completion handler
  const handleScrapeComplete = useCallback(
    async (results: Map<string, ScrapeResult>) => {
      // Collect all cell updates to persist to database
      const cellUpdates: Array<{ cellId: string; value: CellValue }> = [];
      let skippedCount = 0;

      // Update local rows with scraped data
      setRows((prevRows) =>
        prevRows.map((row) => {
          const result = results.get(row.id);
          if (!result || !result.success) return row;

          const updatedCells = { ...row.cells };

          // Find columns to update based on name/type
          columns.forEach((col) => {
            const colNameLower = col.name.toLowerCase();
            const cell = updatedCells[col.id];
            if (!cell) return;

            // Check if cell already has a value - skip if not empty
            const existingValue = cell.value;
            const hasExistingValue = existingValue !== null &&
              existingValue !== undefined &&
              String(existingValue).trim() !== "";

            let newValue: CellValue | null = null;

            // First Name column (AI-extracted)
            if ((colNameLower.includes("vorname") || colNameLower === "first name" || colNameLower === "firstname") && result.firstName) {
              newValue = result.firstName;
            }

            // Last Name column (AI-extracted)
            if ((colNameLower.includes("nachname") || colNameLower === "last name" || colNameLower === "lastname") && result.lastName) {
              newValue = result.lastName;
            }

            // Email column - only if no existing email
            if ((colNameLower.includes("email") || colNameLower.includes("e-mail")) && result.emails.length > 0) {
              if (hasExistingValue) {
                skippedCount++;
                return; // Skip - email already exists
              }
              newValue = result.emails[0];
            }

            // Phone column - only if no existing phone
            if ((colNameLower.includes("phone") || colNameLower.includes("telefon") || colNameLower.includes("tel")) && result.phones.length > 0) {
              if (hasExistingValue) {
                skippedCount++;
                return; // Skip - phone already exists
              }
              newValue = result.phones[0];
            }

            // Address column
            if ((colNameLower.includes("address") || colNameLower.includes("adresse")) && result.addresses.length > 0) {
              if (hasExistingValue) {
                skippedCount++;
                return;
              }
              newValue = result.addresses[0];
            }

            // LinkedIn column
            if (colNameLower.includes("linkedin") && result.social.linkedin) {
              if (hasExistingValue) return;
              newValue = result.social.linkedin;
            }

            // Facebook column
            if (colNameLower.includes("facebook") && result.social.facebook) {
              if (hasExistingValue) return;
              newValue = result.social.facebook;
            }

            // Instagram column
            if (colNameLower.includes("instagram") && result.social.instagram) {
              if (hasExistingValue) return;
              newValue = result.social.instagram;
            }

            // Contact name column
            if ((colNameLower.includes("kontakt") || colNameLower.includes("ansprech") || colNameLower.includes("contact")) && result.persons.length > 0) {
              const person = result.persons[0];
              if (person.name && !hasExistingValue) {
                newValue = person.name;
              }
            }

            // Position column
            if ((colNameLower.includes("position") || colNameLower.includes("titel") || colNameLower.includes("role")) && result.persons.length > 0) {
              const person = result.persons[0];
              if (person.position && !hasExistingValue) {
                newValue = person.position;
              }
            }

            // If we have a new value, update local state and queue for DB
            if (newValue !== null) {
              updatedCells[col.id] = { ...cell, value: newValue };
              cellUpdates.push({ cellId: cell.id, value: newValue });
            }
          });

          return { ...row, cells: updatedCells };
        })
      );

      // Persist all cell updates to database (silently, no individual notifications)
      if (cellUpdates.length > 0) {
        // Update cells in parallel batches
        const batchSize = 10;
        for (let i = 0; i < cellUpdates.length; i += batchSize) {
          const batch = cellUpdates.slice(i, i + batchSize);
          await Promise.all(
            batch.map(({ cellId, value }) => updateCell(cellId, value))
          );
        }
      }

      setIsWebScraperOpen(false);

      // Single summary notification
      const successCount = Array.from(results.values()).filter(r => r.success).length;
      let message = `${successCount} Websites gescraped`;
      if (cellUpdates.length > 0) {
        message += `, ${cellUpdates.length} Zellen aktualisiert`;
      }
      if (skippedCount > 0) {
        message += ` (${skippedCount} übersprungen)`;
      }
      toast.success(message);

      router.refresh();
    },
    [columns, router, updateCell]
  );

  // Update selected row when cells are updated
  const handleCellUpdateInSheet = useCallback(
    async (cellId: string, value: CellValue) => {
      await handleCellUpdate(cellId, value);
      // Update selectedRow to reflect changes
      if (selectedRow) {
        const cell = Object.values(selectedRow.cells).find((c) => c.id === cellId);
        if (cell) {
          setSelectedRow((prev) =>
            prev
              ? {
                  ...prev,
                  cells: {
                    ...prev.cells,
                    [cell.columnId]: {
                      ...cell,
                      value,
                    },
                  },
                }
              : null
          );
        }
      }
    },
    [handleCellUpdate, selectedRow]
  );

  // Saved Views handlers
  const handleViewSelect = useCallback((view: TableView) => {
    setCurrentViewId(view.id || undefined);
    // Note: The actual view configuration (filters, sorting, etc.) would need
    // to be applied to the DataTable. For now, we just track the selected view.
  }, []);

  const handleViewCreate = useCallback(
    async (name: string, config: TableViewConfig, isDefault?: boolean) => {
      const response = await fetch(`/api/tables/${tableId}/views`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          isDefault: isDefault || false,
          ...config,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create view");
      }

      const newView = await response.json();
      setViews((prev) => [...prev, newView]);
      setCurrentViewId(newView.id);
    },
    [tableId]
  );

  const handleViewUpdate = useCallback(
    async (viewId: string, updates: Partial<TableView>) => {
      const response = await fetch(`/api/tables/views/${viewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update view");
      }

      const updatedView = await response.json();
      setViews((prev) =>
        prev.map((v) => (v.id === viewId ? updatedView : v))
      );
    },
    []
  );

  const handleViewDelete = useCallback(
    async (viewId: string) => {
      const response = await fetch(`/api/tables/views/${viewId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete view");
      }

      setViews((prev) => prev.filter((v) => v.id !== viewId));
      if (currentViewId === viewId) {
        setCurrentViewId(undefined);
      }
    },
    [currentViewId]
  );

  const handleViewsRefresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/tables/${tableId}/views`);
      if (response.ok) {
        const data = await response.json();
        setViews(data);
      }
    } catch {
      console.error("Failed to refresh views");
    }
  }, [tableId]);

  const addColumnButton = (
    <AddColumnDialog tableId={tableId} onColumnAdded={handleRefresh}>
      <Button variant="outline" size="sm" className="h-9">
        <Plus className="h-4 w-4 mr-2" />
        Column
      </Button>
    </AddColumnDialog>
  );

  const quickAddButton = (
    <QuickAddDialog
      tableId={tableId}
      columns={columns.map((c) => ({ id: c.id, name: c.name, type: c.type }))}
      onLeadsAdded={handleRefresh}
    >
      <Button variant="outline" size="sm" className="h-9 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950 dark:hover:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-800">
        <PlusCircle className="h-4 w-4 mr-2" />
        Quick Add
      </Button>
    </QuickAddDialog>
  );

  return (
    <>
      <DataTable
        data={rows}
        columns={columns}
        tableId={tableId}
        onCellUpdate={handleCellUpdate}
        onColumnReorder={handleColumnReorder}
        onColumnRename={handleColumnRename}
        onColumnDelete={handleColumnDelete}
        onColumnHide={handleColumnHide}
        onClearColumn={handleClearColumn}
        onAddRow={handleAddRow}
        onRowDelete={handleRowDelete}
        onBulkRowDelete={handleBulkRowDelete}
        onRowClick={handleRowClick}
        onExport={handleExport}
        onOpenExportDialog={handleOpenExportDialog}
        addColumnButton={addColumnButton}
        quickAddButton={quickAddButton}
        contactDataStats={contactDataStats}
        enableVirtualization={false}
        enableColumnReordering={true}
        enableRowSelection={true}
        pageSize={30}
        // AI Compliment Generator
        onGenerateCompliments={handleGenerateCompliments}
        // Web Scraper
        onScrapeWebsites={handleScrapeWebsites}
        // Favorites & Notes
        onToggleFavorite={handleToggleFavorite}
        onUpdateNotes={handleUpdateNotes}
        // Saved Views
        views={views}
        currentViewId={currentViewId}
        onViewSelect={handleViewSelect}
        onViewCreate={handleViewCreate}
        onViewUpdate={handleViewUpdate}
        onViewDelete={handleViewDelete}
        onViewsRefresh={handleViewsRefresh}
      />

      {/* Row Details Sheet - Lazy loaded */}
      {isRowDetailsOpen && (
        <Suspense fallback={<DialogLoader />}>
          <RowDetailsSheet
            open={isRowDetailsOpen}
            onOpenChange={setIsRowDetailsOpen}
            row={selectedRow}
            columns={columns}
            onCellUpdate={handleCellUpdateInSheet}
            onClose={handleRowDetailsClose}
          />
        </Suspense>
      )}

      {/* AI Compliment Generator - Lazy loaded */}
      {isAIGeneratorOpen && (
        <Suspense fallback={<DialogLoader />}>
          <AIComplimentGenerator
            open={isAIGeneratorOpen}
            onOpenChange={setIsAIGeneratorOpen}
            rows={selectedRowsForAI}
            columns={columns}
            onBulkComplete={handleBulkComplimentsComplete}
          />
        </Suspense>
      )}

      {/* Web Scraper - Lazy loaded */}
      {isWebScraperOpen && (
        <Suspense fallback={<DialogLoader />}>
          <WebScraper
            open={isWebScraperOpen}
            onOpenChange={setIsWebScraperOpen}
            rows={selectedRowsForScraper}
            columns={columns}
            onScrapeComplete={handleScrapeComplete}
          />
        </Suspense>
      )}

      {/* Export Dialog - Lazy loaded */}
      {isExportDialogOpen && (
        <Suspense fallback={<DialogLoader />}>
          <ExportDialog
            open={isExportDialogOpen}
            onOpenChange={setIsExportDialogOpen}
            rows={rows}
            columns={columns}
            tableName={tableName}
            onExport={handleExportFromDialog}
          />
        </Suspense>
      )}

      {/* Keyboard Shortcuts Dialog - Lazy loaded */}
      {isShortcutsDialogOpen && (
        <Suspense fallback={<DialogLoader />}>
          <KeyboardShortcutsDialog
            open={isShortcutsDialogOpen}
            onOpenChange={setIsShortcutsDialogOpen}
          />
        </Suspense>
      )}

      {/* Quick Add Dialog (for keyboard shortcut) */}
      <QuickAddDialog
        tableId={tableId}
        columns={columns.map((c) => ({ id: c.id, name: c.name, type: c.type }))}
        onLeadsAdded={handleRefresh}
        open={isQuickAddOpen}
        onOpenChange={setIsQuickAddOpen}
      />

      {isUpdating && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg text-sm">
          Saving changes...
        </div>
      )}
    </>
  );
}
