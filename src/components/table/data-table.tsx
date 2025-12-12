"use client";

import React, { useCallback, useMemo, useRef, useEffect, useState, useId } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  RowSelectionState,
  ColumnSizingState,
} from "@tanstack/react-table";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableToolbar } from "./table-toolbar";
import { ContactDataFilter } from "@/lib/export";
import { ColumnHeader } from "./column-header";
import { getCellRenderer } from "./cells";
import { ColumnConfig, RowData as TableRowData, CellValue, TableView, TableViewConfig } from "@/types/table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Trash2, Star } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { RowNotesPopover } from "./row-notes-popover";

// Constants for Excel-like appearance
const DEFAULT_COLUMN_WIDTH = 150;
const MIN_COLUMN_WIDTH = 50;
const ROW_HEIGHT = 32;

interface DataTableProps {
  data: TableRowData[];
  columns: ColumnConfig[];
  tableId: string;
  onCellUpdate?: (cellId: string, value: CellValue) => Promise<void>;
  onColumnReorder?: (columnIds: string[]) => void;
  onColumnRename?: (columnId: string, newName: string) => void;
  onColumnDelete?: (columnId: string) => void;
  onColumnHide?: (columnId: string) => void;
  onAddRow?: () => void;
  onRowDelete?: (rowId: string) => void;
  onBulkRowDelete?: (rowIds: string[]) => void;
  onRowClick?: (row: TableRowData) => void;
  onExport?: (format: "csv" | "json", contactFilter?: ContactDataFilter) => void;
  onOpenExportDialog?: () => void;
  addColumnButton?: React.ReactNode;
  quickAddButton?: React.ReactNode;
  contactDataStats?: {
    total: number;
    withContact: number;
    withoutContact: number;
  };
  enableVirtualization?: boolean;
  enableColumnReordering?: boolean;
  enableRowSelection?: boolean;
  pageSize?: number;
  onGenerateCompliments?: (selectedRows: TableRowData[]) => void;
  onScrapeWebsites?: (selectedRows: TableRowData[]) => void;
  // Favorites & Notes
  onToggleFavorite?: (rowId: string, isFavorite: boolean) => Promise<void>;
  onUpdateNotes?: (rowId: string, notes: string | null) => Promise<void>;
  // Views
  views?: TableView[];
  currentViewId?: string;
  onViewSelect?: (view: TableView) => void;
  onViewCreate?: (name: string, config: TableViewConfig, isDefault?: boolean) => Promise<void>;
  onViewUpdate?: (viewId: string, updates: Partial<TableView>) => Promise<void>;
  onViewDelete?: (viewId: string) => Promise<void>;
  onViewsRefresh?: () => void;
}

// Column Resizer Component
function ColumnResizer({
  header,
}: {
  header: { getResizeHandler: () => (event: unknown) => void; column: { getIsResizing: () => boolean } };
}) {
  return (
    <div
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      className={cn(
        "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none",
        "hover:bg-primary/50 active:bg-primary",
        header.column.getIsResizing() && "bg-primary"
      )}
      style={{ userSelect: "none" }}
    />
  );
}

// DraggableHeader component for column reordering with resize
function DraggableHeader({
  id,
  children,
  width,
  header,
}: {
  id: string;
  children: React.ReactNode;
  width: number;
  header?: { getResizeHandler: () => (event: unknown) => void; column: { getIsResizing: () => boolean } };
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: `${width}px`,
    minWidth: `${width}px`,
    maxWidth: `${width}px`,
    position: 'relative',
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="h-8 px-2 text-left align-middle font-medium text-xs border-r border-b border-border bg-muted/80 whitespace-nowrap overflow-hidden select-none"
    >
      <div {...attributes} {...listeners} className="truncate pr-2">
        {children}
      </div>
      {header && <ColumnResizer header={header} />}
    </th>
  );
}

export function DataTable({
  data,
  columns: columnConfigs,
  tableId,
  onCellUpdate,
  onColumnReorder,
  onColumnRename,
  onColumnDelete,
  onColumnHide,
  onAddRow,
  onRowDelete,
  onBulkRowDelete,
  onRowClick,
  onExport,
  onOpenExportDialog,
  addColumnButton,
  quickAddButton,
  contactDataStats,
  enableVirtualization = false, // Disabled by default for simpler rendering
  enableColumnReordering = true,
  enableRowSelection = true,
  pageSize = 30,
  onGenerateCompliments,
  onScrapeWebsites,
  onToggleFavorite,
  onUpdateNotes,
  views = [],
  currentViewId,
  onViewSelect,
  onViewCreate,
  onViewUpdate,
  onViewDelete,
  onViewsRefresh,
}: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnOrder, setColumnOrder] = React.useState<string[]>(
    columnConfigs.map((col) => col.id)
  );
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({});

  const [isMounted, setIsMounted] = useState(false);
  const dndContextId = useId();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize column sizing from config
  useEffect(() => {
    const initialSizing: ColumnSizingState = {};
    columnConfigs.forEach((col) => {
      initialSizing[col.id] = col.width || DEFAULT_COLUMN_WIDTH;
    });
    setColumnSizing(initialSizing);
  }, [columnConfigs]);

  // Update column order when columns change - Status columns first
  useEffect(() => {
    const sortedColumns = [...columnConfigs].sort((a, b) => {
      const aIsStatus = a.name.toLowerCase().includes("status");
      const bIsStatus = b.name.toLowerCase().includes("status");
      if (aIsStatus && !bIsStatus) return -1;
      if (!aIsStatus && bIsStatus) return 1;
      return (a.position || 0) - (b.position || 0);
    });
    setColumnOrder(sortedColumns.map((col) => col.id));
  }, [columnConfigs]);

  // Create column definitions
  const columns = useMemo<ColumnDef<TableRowData>[]>(() => {
    const allColumns: ColumnDef<TableRowData>[] = [];

    // Selection column
    if (enableRowSelection) {
      const selectionColumn: ColumnDef<TableRowData> = {
        id: "_select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
              className="h-4 w-4"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center h-full">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              className="h-4 w-4"
            />
          </div>
        ),
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableResizing: false,
        enableSorting: false,
        enableHiding: false,
      };
      allColumns.push(selectionColumn);
    }

    // Favorites column
    if (onToggleFavorite) {
      const favoritesColumn: ColumnDef<TableRowData> = {
        id: "_favorite",
        header: () => (
          <div className="flex items-center justify-center">
            <Star className="h-4 w-4 text-muted-foreground" />
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-center h-full">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-amber-100 dark:hover:bg-amber-900/30"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(row.original.id, !row.original.isFavorite);
              }}
            >
              <Star
                className={cn(
                  "h-4 w-4 transition-colors",
                  row.original.isFavorite
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground hover:text-amber-400"
                )}
              />
            </Button>
          </div>
        ),
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableResizing: false,
        enableSorting: false,
        enableHiding: false,
      };
      allColumns.push(favoritesColumn);
    }

    // Notes column
    if (onUpdateNotes) {
      const notesColumn: ColumnDef<TableRowData> = {
        id: "_notes",
        header: () => (
          <div className="flex items-center justify-center text-xs text-muted-foreground">
            Notes
          </div>
        ),
        cell: ({ row }) => (
          <div
            className="flex items-center justify-center h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <RowNotesPopover
              rowId={row.original.id}
              notes={row.original.notes}
              onNotesChange={onUpdateNotes}
            />
          </div>
        ),
        size: 50,
        minSize: 50,
        maxSize: 50,
        enableResizing: false,
        enableSorting: false,
        enableHiding: false,
      };
      allColumns.push(notesColumn);
    }

    // Data columns
    const dataColumns: ColumnDef<TableRowData>[] = columnConfigs.map((colConfig) => ({
      id: colConfig.id,
      accessorFn: (row) => row.cells[colConfig.id]?.value,
      header: ({ column }) => (
        <ColumnHeader
          column={column}
          title={colConfig.name}
          onRename={(newName) => onColumnRename?.(colConfig.id, newName)}
          onDelete={() => onColumnDelete?.(colConfig.id)}
          onHide={() => onColumnHide?.(colConfig.id)}
          sortable={true}
          resizable={true}
        />
      ),
      cell: ({ row }) => {
        const cell = row.original.cells[colConfig.id];
        if (!cell) return null;

        const CellRenderer = getCellRenderer(colConfig.type);

        return (
          <div className="h-full w-full overflow-hidden">
            <CellRenderer
              value={cell.value}
              rowId={row.original.id}
              columnId={colConfig.id}
              cellId={cell.id}
              columnType={colConfig.type}
              config={colConfig.config}
              metadata={cell.metadata}
              onUpdate={async (newValue) => {
                if (onCellUpdate) {
                  await onCellUpdate(cell.id, newValue);
                }
              }}
            />
          </div>
        );
      },
      size: colConfig.width || DEFAULT_COLUMN_WIDTH,
      minSize: MIN_COLUMN_WIDTH,
      enableResizing: true,
      enableSorting: true,
      enableHiding: true,
    }));

    allColumns.push(...dataColumns);

    // Actions column
    if (onRowDelete) {
      const actionsColumn: ColumnDef<TableRowData> = {
        id: "_actions",
        header: () => null,
        cell: ({ row }) => (
          <div className="flex items-center justify-center h-full">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onRowDelete(row.original.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableResizing: false,
        enableSorting: false,
        enableHiding: false,
      };
      allColumns.push(actionsColumn);
    }

    return allColumns;
  }, [columnConfigs, onCellUpdate, onColumnRename, onColumnDelete, onColumnHide, onRowDelete, enableRowSelection]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      columnOrder,
      rowSelection,
      columnSizing,
    },
    enableRowSelection: enableRowSelection,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: "includesString",
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  const { rows } = table.getRowModel();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = columnOrder.indexOf(active.id as string);
        const newIndex = columnOrder.indexOf(over.id as string);
        const newOrder = arrayMove(columnOrder, oldIndex, newIndex);
        setColumnOrder(newOrder);
        onColumnReorder?.(newOrder);
      }
    },
    [columnOrder, onColumnReorder]
  );

  const selectedRowIds = useMemo(() => {
    return Object.keys(rowSelection).filter((key) => rowSelection[key]);
  }, [rowSelection]);

  const handleBulkDelete = useCallback(() => {
    if (selectedRowIds.length === 0) return;
    const rowIds = selectedRowIds.map((index) => {
      const rowIndex = parseInt(index, 10);
      return data[rowIndex]?.id;
    }).filter(Boolean) as string[];
    if (onBulkRowDelete && rowIds.length > 0) {
      onBulkRowDelete(rowIds);
      setRowSelection({});
    }
  }, [selectedRowIds, data, onBulkRowDelete]);

  const handleGenerateCompliments = useCallback(() => {
    if (selectedRowIds.length === 0 || !onGenerateCompliments) return;
    const selectedRows = selectedRowIds
      .map((index) => data[parseInt(index, 10)])
      .filter(Boolean) as TableRowData[];
    if (selectedRows.length > 0) onGenerateCompliments(selectedRows);
  }, [selectedRowIds, data, onGenerateCompliments]);

  const handleScrapeWebsites = useCallback(() => {
    if (selectedRowIds.length === 0 || !onScrapeWebsites) return;
    const selectedRows = selectedRowIds
      .map((index) => data[parseInt(index, 10)])
      .filter(Boolean) as TableRowData[];
    if (selectedRows.length > 0) onScrapeWebsites(selectedRows);
  }, [selectedRowIds, data, onScrapeWebsites]);

  const getCurrentConfig = useCallback((): TableViewConfig => {
    return {
      filters: columnFilters.map(f => ({
        columnId: f.id,
        value: String(f.value || ""),
        operator: "contains" as const,
      })),
      sorting: sorting.map(s => ({
        columnId: s.id,
        direction: s.desc ? "desc" as const : "asc" as const,
      })),
      columnVisibility: columnVisibility,
      columnOrder: columnOrder,
      globalFilter: globalFilter,
    };
  }, [columnFilters, sorting, columnVisibility, columnOrder, globalFilter]);

  // Calculate total table width
  const tableWidth = useMemo(() => {
    return table.getHeaderGroups()[0]?.headers.reduce((acc, header) => {
      return acc + header.getSize();
    }, 0) || 0;
  }, [table, columnSizing]);

  return (
    <div className="flex flex-col h-full overflow-hidden border rounded-lg bg-background">
      {/* Toolbar */}
      <TableToolbar
        table={table}
        onAddRow={onAddRow}
        addColumnButton={addColumnButton}
        quickAddButton={quickAddButton}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        onExport={onExport}
        onOpenExportDialog={onOpenExportDialog}
        onBulkDelete={onBulkRowDelete ? handleBulkDelete : undefined}
        selectedRowCount={selectedRowIds.length}
        contactDataStats={contactDataStats}
        onGenerateCompliments={onGenerateCompliments ? handleGenerateCompliments : undefined}
        onScrapeWebsites={onScrapeWebsites ? handleScrapeWebsites : undefined}
        tableId={tableId}
        views={views}
        currentViewId={currentViewId}
        onViewSelect={onViewSelect}
        onViewCreate={onViewCreate}
        onViewUpdate={onViewUpdate}
        onViewDelete={onViewDelete}
        onViewsRefresh={onViewsRefresh}
        getCurrentConfig={getCurrentConfig}
      />

      {/* Table Container */}
      <DndContext
        id={dndContextId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={tableContainerRef}
          className="flex-1 overflow-auto"
        >
          <table
            className="border-collapse"
            style={{ width: tableWidth, minWidth: "100%" }}
          >
            {/* Header */}
            <thead className="sticky top-0 z-10">
              {enableColumnReordering && isMounted ? (
                <SortableContext
                  items={columnOrder}
                  strategy={horizontalListSortingStrategy}
                >
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <DraggableHeader
                          key={header.id}
                          id={header.column.id}
                          width={header.getSize()}
                          header={header.column.getCanResize() ? header : undefined}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </DraggableHeader>
                      ))}
                    </tr>
                  ))}
                </SortableContext>
              ) : (
                table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        style={{
                          width: header.getSize(),
                          minWidth: header.getSize(),
                          maxWidth: header.getSize(),
                          position: 'relative',
                        }}
                        className="h-8 px-2 text-left align-middle font-medium text-xs border-r border-b border-border bg-muted/80 whitespace-nowrap overflow-hidden"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {header.column.getCanResize() && (
                          <ColumnResizer header={header} />
                        )}
                      </th>
                    ))}
                  </tr>
                ))
              )}
            </thead>

            {/* Body */}
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={cn(
                    "hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors",
                    index % 2 === 0 ? "bg-background" : "bg-muted/30",
                    row.getIsSelected() && "bg-blue-100 dark:bg-blue-900/40"
                  )}
                  style={{ height: ROW_HEIGHT }}
                  onDoubleClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{
                        width: cell.column.getSize(),
                        minWidth: cell.column.getSize(),
                        maxWidth: cell.column.getSize(),
                        height: ROW_HEIGHT,
                      }}
                      className="px-1 border-r border-b border-border/50 overflow-hidden"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Empty State */}
          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-muted-foreground text-sm">No data available</p>
              {onAddRow && (
                <button
                  onClick={onAddRow}
                  className="mt-4 text-sm text-primary hover:underline"
                >
                  Add your first row
                </button>
              )}
            </div>
          )}
        </div>
      </DndContext>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
        <div className="text-xs text-muted-foreground">
          {rows.length} row(s) | Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-7 px-2 text-xs"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-7 px-2 text-xs"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
