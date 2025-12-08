"use client";

import React, { useRef, useState } from "react";
import { Column } from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  GripVertical,
  Type,
  Trash2,
  EyeOff,
  Edit2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
  onHide?: () => void;
  onTypeChange?: () => void;
  sortable?: boolean;
  resizable?: boolean;
}

export function ColumnHeader<TData, TValue>({
  column,
  title,
  onRename,
  onDelete,
  onHide,
  onTypeChange,
  sortable = true,
  resizable = true,
}: ColumnHeaderProps<TData, TValue>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [isResizing, setIsResizing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleRename = () => {
    if (editValue.trim() && editValue !== title && onRename) {
      onRename(editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      setEditValue(title);
      setIsEditing(false);
    }
  };

  const handleSort = () => {
    if (!sortable) return;

    const currentSort = column.getIsSorted();
    if (currentSort === "asc") {
      column.toggleSorting(true);
    } else if (currentSort === "desc") {
      column.clearSorting();
    } else {
      column.toggleSorting(false);
    }
  };

  const getSortIcon = () => {
    const sorted = column.getIsSorted();
    if (sorted === "asc") return <ArrowUp className="h-3 w-3" />;
    if (sorted === "desc") return <ArrowDown className="h-3 w-3" />;
    return <ArrowUpDown className="h-3 w-3 opacity-50" />;
  };

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div className="flex items-center justify-between w-full h-full group relative">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isEditing ? (
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            className="h-7 text-xs font-medium"
          />
        ) : (
          <>
            {sortable && (
              <button
                onClick={handleSort}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium hover:text-foreground transition-colors",
                  column.getIsSorted() && "text-foreground"
                )}
              >
                <span className="truncate">{title}</span>
                {getSortIcon()}
              </button>
            )}
            {!sortable && (
              <span className="text-xs font-medium truncate">{title}</span>
            )}
          </>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-3 w-3" />
            <span className="sr-only">Column menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {onRename && (
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
          )}
          {onTypeChange && (
            <DropdownMenuItem onClick={onTypeChange}>
              <Type className="mr-2 h-4 w-4" />
              Change Type
            </DropdownMenuItem>
          )}
          {sortable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
                <ArrowUp className="mr-2 h-4 w-4" />
                Sort Ascending
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
                <ArrowDown className="mr-2 h-4 w-4" />
                Sort Descending
              </DropdownMenuItem>
              {column.getIsSorted() && (
                <DropdownMenuItem onClick={() => column.clearSorting()}>
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Clear Sort
                </DropdownMenuItem>
              )}
            </>
          )}
          <DropdownMenuSeparator />
          {onHide && (
            <DropdownMenuItem onClick={onHide}>
              <EyeOff className="mr-2 h-4 w-4" />
              Hide Column
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem onClick={onDelete} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Column
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {resizable && (
        <div
          className={cn(
            "absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 transition-colors",
            isResizing && "bg-primary"
          )}
          onMouseDown={() => setIsResizing(true)}
          onMouseUp={() => setIsResizing(false)}
        >
          <div className="h-full w-1 opacity-0 hover:opacity-100 transition-opacity">
            <GripVertical className="h-4 w-4 -ml-1.5 mt-2 text-muted-foreground" />
          </div>
        </div>
      )}
    </div>
  );
}
