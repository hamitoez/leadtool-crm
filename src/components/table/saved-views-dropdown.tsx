"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookmarkIcon,
  Check,
  ChevronDown,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { TableView, TableViewConfig } from "@/types/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SavedViewsDropdownProps {
  tableId: string;
  views: TableView[];
  currentViewId?: string;
  onViewSelect: (view: TableView) => void;
  onViewCreate: (name: string, config: TableViewConfig, isDefault?: boolean) => Promise<void>;
  onViewUpdate: (viewId: string, updates: Partial<TableView>) => Promise<void>;
  onViewDelete: (viewId: string) => Promise<void>;
  onRefresh: () => void;
  getCurrentConfig: () => TableViewConfig;
}

export function SavedViewsDropdown({
  views,
  currentViewId,
  onViewSelect,
  onViewCreate,
  onViewUpdate,
  onViewDelete,
  onRefresh,
  getCurrentConfig,
}: SavedViewsDropdownProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [newViewName, setNewViewName] = useState("");

  const currentView = views.find((v) => v.id === currentViewId);
  const defaultView = views.find((v) => v.isDefault);

  const handleCreateView = useCallback(async () => {
    if (!newViewName.trim()) {
      toast.error("Please enter a view name");
      return;
    }

    try {
      const config = getCurrentConfig();
      await onViewCreate(newViewName.trim(), config, false);
      setNewViewName("");
      setIsCreating(false);
      toast.success("View created successfully");
      onRefresh();
    } catch {
      toast.error("Failed to create view");
    }
  }, [newViewName, getCurrentConfig, onViewCreate, onRefresh]);

  const handleRenameView = useCallback(
    async (viewId: string) => {
      if (!newViewName.trim()) {
        toast.error("Please enter a view name");
        return;
      }

      try {
        await onViewUpdate(viewId, { name: newViewName.trim() });
        setNewViewName("");
        setIsRenaming(null);
        toast.success("View renamed successfully");
        onRefresh();
      } catch {
        toast.error("Failed to rename view");
      }
    },
    [newViewName, onViewUpdate, onRefresh]
  );

  const handleSetDefault = useCallback(
    async (viewId: string) => {
      try {
        await onViewUpdate(viewId, { isDefault: true });
        toast.success("Default view updated");
        onRefresh();
      } catch {
        toast.error("Failed to set default view");
      }
    },
    [onViewUpdate, onRefresh]
  );

  const handleUpdateCurrentView = useCallback(async () => {
    if (!currentViewId) return;

    try {
      const config = getCurrentConfig();
      await onViewUpdate(currentViewId, config);
      toast.success("View updated successfully");
      onRefresh();
    } catch {
      toast.error("Failed to update view");
    }
  }, [currentViewId, getCurrentConfig, onViewUpdate, onRefresh]);

  const handleDeleteView = useCallback(
    async (viewId: string) => {
      if (!confirm("Are you sure you want to delete this view?")) return;

      try {
        await onViewDelete(viewId);
        toast.success("View deleted successfully");
        onRefresh();
      } catch {
        toast.error("Failed to delete view");
      }
    },
    [onViewDelete, onRefresh]
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1">
          <BookmarkIcon className="h-4 w-4" />
          <span className="hidden sm:inline">
            {currentView?.name || "All Records"}
          </span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Default "All Records" view */}
        <DropdownMenuItem
          onClick={() =>
            onViewSelect({
              id: "",
              tableId: "",
              name: "All Records",
              isDefault: false,
              filters: [],
              sorting: [],
              columnVisibility: {},
              columnOrder: [],
              globalFilter: "",
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          }
          className={cn(!currentViewId && "bg-accent")}
        >
          <Check
            className={cn("mr-2 h-4 w-4", !currentViewId ? "opacity-100" : "opacity-0")}
          />
          All Records
        </DropdownMenuItem>

        {/* Saved views */}
        {views.map((view) => (
          <div key={view.id} className="relative group">
            {isRenaming === view.id ? (
              <div className="flex items-center px-2 py-1.5 gap-2">
                <input
                  type="text"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder={view.name}
                  className="flex-1 h-7 px-2 text-sm border rounded"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameView(view.id);
                    if (e.key === "Escape") {
                      setIsRenaming(null);
                      setNewViewName("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => handleRenameView(view.id)}
                >
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <DropdownMenuItem
                onClick={() => onViewSelect(view)}
                className={cn(currentViewId === view.id && "bg-accent", "pr-16")}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    currentViewId === view.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="flex-1 truncate">{view.name}</span>
                {view.isDefault && (
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 ml-1" />
                )}
              </DropdownMenuItem>
            )}

            {/* View actions - show on hover */}
            {isRenaming !== view.id && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewViewName(view.name);
                    setIsRenaming(view.id);
                  }}
                  title="Rename"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                {!view.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetDefault(view.id);
                    }}
                    title="Set as default"
                  >
                    <Star className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteView(view.id);
                  }}
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ))}

        <DropdownMenuSeparator />

        {/* Create new view */}
        {isCreating ? (
          <div className="flex items-center px-2 py-1.5 gap-2">
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="View name..."
              className="flex-1 h-7 px-2 text-sm border rounded"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateView();
                if (e.key === "Escape") {
                  setIsCreating(false);
                  setNewViewName("");
                }
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={handleCreateView}
            >
              <Check className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <DropdownMenuItem onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Save current view
          </DropdownMenuItem>
        )}

        {/* Update current view */}
        {currentViewId && (
          <DropdownMenuItem onClick={handleUpdateCurrentView}>
            <BookmarkIcon className="mr-2 h-4 w-4" />
            Update "{currentView?.name}"
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
