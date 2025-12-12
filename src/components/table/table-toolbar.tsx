"use client";

import React, { useState } from "react";
import { Table } from "@tanstack/react-table";
import { Search, Plus, Filter, Columns3, X, Download, Trash2, Sparkles, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { SavedViewsDropdown } from "./saved-views-dropdown";
import { TableView, TableViewConfig } from "@/types/table";

import { ContactDataFilter } from "@/lib/export";

interface ContactDataStats {
  total: number;
  withContact: number;
  withoutContact: number;
}

interface TableToolbarProps<TData> {
  table: Table<TData>;
  onAddRow?: () => void;
  addColumnButton?: React.ReactNode;
  quickAddButton?: React.ReactNode;
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  onExport?: (format: "csv" | "json", contactFilter?: ContactDataFilter) => void;
  onOpenExportDialog?: () => void;
  onBulkDelete?: () => void;
  selectedRowCount?: number;
  // Contact data stats for export UI
  contactDataStats?: ContactDataStats;
  // AI Compliment Generator
  onGenerateCompliments?: () => void;
  // Web Scraper
  onScrapeWebsites?: () => void;
  // Saved Views props
  tableId?: string;
  views?: TableView[];
  currentViewId?: string;
  onViewSelect?: (view: TableView) => void;
  onViewCreate?: (name: string, config: TableViewConfig, isDefault?: boolean) => Promise<void>;
  onViewUpdate?: (viewId: string, updates: Partial<TableView>) => Promise<void>;
  onViewDelete?: (viewId: string) => Promise<void>;
  onViewsRefresh?: () => void;
  getCurrentConfig?: () => TableViewConfig;
}

export function TableToolbar<TData>({
  table,
  onAddRow,
  addColumnButton,
  quickAddButton,
  globalFilter,
  onGlobalFilterChange,
  onExport,
  onOpenExportDialog,
  onBulkDelete,
  selectedRowCount = 0,
  // Contact data stats
  contactDataStats,
  // AI Compliment Generator
  onGenerateCompliments,
  // Web Scraper
  onScrapeWebsites,
  // Saved Views props
  tableId,
  views = [],
  currentViewId,
  onViewSelect,
  onViewCreate,
  onViewUpdate,
  onViewDelete,
  onViewsRefresh,
  getCurrentConfig,
}: TableToolbarProps<TData>) {
  const [showFilters, setShowFilters] = useState(false);

  const showSavedViews = tableId && onViewSelect && onViewCreate && onViewUpdate && onViewDelete && onViewsRefresh && getCurrentConfig;

  const isFiltered = table.getState().columnFilters.length > 0;

  // Calculate stats
  const totalRows = table.getFilteredRowModel().rows.length;
  const favoriteCount = table.getFilteredRowModel().rows.filter(
    (row) => (row.original as { isFavorite?: boolean }).isFavorite
  ).length;

  return (
    <div className="flex flex-col gap-4 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between gap-4">
        {/* Stats & Saved Views & Search */}
        <div className="flex-1 flex items-center gap-2">
          {/* Stats Badge */}
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground border-r pr-3 mr-1">
            <span className="font-medium text-foreground">{totalRows}</span>
            <span>Leads</span>
            {favoriteCount > 0 && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <span className="text-amber-600 dark:text-amber-400">{favoriteCount} ⭐</span>
              </>
            )}
            {contactDataStats && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <span
                  className={
                    contactDataStats.withContact / contactDataStats.total > 0.7
                      ? "text-green-600 dark:text-green-400"
                      : contactDataStats.withContact / contactDataStats.total > 0.3
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                  }
                  title={`${Math.round((contactDataStats.withContact / contactDataStats.total) * 100)}% mit Kontaktdaten`}
                >
                  {contactDataStats.withContact} mit Kontakt
                </span>
              </>
            )}
          </div>

          {/* Saved Views Dropdown */}
          {showSavedViews && (
            <SavedViewsDropdown
              tableId={tableId}
              views={views}
              currentViewId={currentViewId}
              onViewSelect={onViewSelect}
              onViewCreate={onViewCreate}
              onViewUpdate={onViewUpdate}
              onViewDelete={onViewDelete}
              onRefresh={onViewsRefresh}
              getCurrentConfig={getCurrentConfig}
            />
          )}

          {/* Search */}
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search all columns..."
              value={globalFilter ?? ""}
              onChange={(e) => onGlobalFilterChange?.(e.target.value)}
              className="pl-9 h-9"
            />
            {globalFilter && (
              <button
                onClick={() => onGlobalFilterChange?.("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Bulk Delete */}
          {selectedRowCount > 0 && onBulkDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onBulkDelete}
              className="h-9"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete ({selectedRowCount})
            </Button>
          )}

          {/* AI Compliment Generator */}
          {selectedRowCount > 0 && onGenerateCompliments && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onGenerateCompliments}
              className="h-9 bg-violet-100 hover:bg-violet-200 text-violet-700 dark:bg-violet-950 dark:hover:bg-violet-900 dark:text-violet-300"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              KI-Komplimente ({selectedRowCount})
            </Button>
          )}

          {/* Web Scraper */}
          {selectedRowCount > 0 && onScrapeWebsites && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onScrapeWebsites}
              className="h-9 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300"
            >
              <Globe className="h-4 w-4 mr-2" />
              Websites scrapen ({selectedRowCount})
            </Button>
          )}

          {/* Filter Toggle */}
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-9"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {isFiltered && (
              <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs">
                {table.getState().columnFilters.length}
              </Badge>
            )}
          </Button>

          {/* Column Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Columns3 className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="max-h-[300px] overflow-y-auto">
                {table
                  .getAllColumns()
                  .filter(
                    (column) =>
                      typeof column.accessorFn !== "undefined" &&
                      column.getCanHide()
                  )
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) =>
                          column.toggleVisibility(!!value)
                        }
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export */}
          {(onExport || onOpenExportDialog) && (
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={onOpenExportDialog || (() => onExport?.("csv", "all"))}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
              {contactDataStats && (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs">
                  {contactDataStats.total}
                </Badge>
              )}
            </Button>
          )}

          {/* Add Column */}
          {addColumnButton}

          {/* Quick Add */}
          {quickAddButton}

          {/* Add Row */}
          {onAddRow && (
            <Button
              variant="default"
              size="sm"
              onClick={onAddRow}
              className="h-9"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Row
            </Button>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {table.getState().columnFilters.map((filter) => (
            <Badge
              key={filter.id}
              variant="secondary"
              className="gap-1 pr-1"
            >
              <span className="font-medium">{filter.id}:</span>
              <span>{String(filter.value)}</span>
              <button
                onClick={() =>
                  table.getColumn(filter.id)?.setFilterValue(undefined)
                }
                className="ml-1 hover:bg-accent rounded-sm p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.resetColumnFilters()}
              className="h-6 px-2 text-xs"
            >
              Clear all
            </Button>
          )}
          {!isFiltered && (
            <span className="text-xs text-muted-foreground">
              No active filters
            </span>
          )}
        </div>
      )}

      {/* Table Info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          {table.getFilteredRowModel().rows.length} of{" "}
          {table.getCoreRowModel().rows.length} row(s)
          {globalFilter && " (filtered)"}
        </div>
        <div className="flex items-center gap-4">
          {table.getState().sorting.length > 0 && (
            <div>
              Sorted by:{" "}
              {table
                .getState()
                .sorting.map((s) => `${s.id} ${s.desc ? "↓" : "↑"}`)
                .join(", ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
