"use client";

import React, { useRef, useEffect } from "react";
import { CellWrapper } from "./cell-wrapper";
import { CellProps, CellValue } from "@/types/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Helper to convert CellValue to string for display/input
const toStringValue = (val: CellValue): string => {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) return val.join(", ");
  return JSON.stringify(val);
};

export const TextCell = React.memo<CellProps>(
  ({ value, onUpdate, rowId, columnId, cellId, isEditing, ...props }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [isEditing]);

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
              value={strValue}
              onChange={(e) => onUpdate(e.target.value)}
              className="h-6 w-full border-none bg-transparent p-0 text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder=""
            />
          ) : (
            <div
              className={cn(
                "w-full truncate text-xs leading-tight",
                !strValue && "text-muted-foreground/50"
              )}
              onClick={onEdit}
            >
              {strValue || ""}
            </div>
          );
        }}
      </CellWrapper>
    );
  }
);

TextCell.displayName = "TextCell";
