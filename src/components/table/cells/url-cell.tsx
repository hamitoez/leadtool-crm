"use client";

import React, { useRef, useEffect } from "react";
import { CellWrapper } from "./cell-wrapper";
import { CellProps, CellValue } from "@/types/table";
import { Input } from "@/components/ui/input";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

// Helper to convert CellValue to string for display/input
const toStringValue = (val: CellValue): string => {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return "";
};

export const UrlCell = React.memo<CellProps>(
  ({ value, onUpdate, rowId, columnId, cellId, isEditing, ...props }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [isEditing]);

    const isValidUrl = (url: string) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    return (
      <CellWrapper
        value={value}
        onUpdate={onUpdate}
        rowId={rowId}
        columnId={columnId}
        cellId={cellId}
        {...props}
      >
        {({ value: localValue, isEditing, onEdit }) => {
          const strValue = toStringValue(localValue);
          return isEditing ? (
            <Input
              ref={inputRef}
              type="url"
              value={strValue}
              onChange={(e) => onUpdate(e.target.value)}
              className="h-6 w-full border-none bg-transparent p-0 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder=""
            />
          ) : strValue ? (
            <a
              href={strValue}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-1 w-full truncate text-xs text-primary hover:underline",
                !isValidUrl(strValue) && "text-destructive"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="truncate">{strValue}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
            </a>
          ) : (
            <div className="text-xs text-muted-foreground/50" onClick={onEdit} />
          );
        }}
      </CellWrapper>
    );
  }
);

UrlCell.displayName = "UrlCell";
