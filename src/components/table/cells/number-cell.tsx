"use client";

import React, { useRef, useEffect, useState } from "react";
import { CellWrapper } from "./cell-wrapper";
import { CellProps, CellValue } from "@/types/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Helper to convert CellValue to number string for display/input
const toNumberString = (val: CellValue): string => {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") {
    const num = parseFloat(val);
    return isNaN(num) ? "" : String(num);
  }
  return "";
};

// Helper to format number for display
const formatNumber = (val: CellValue, locale = "de-DE"): string => {
  if (val === null || val === undefined) return "";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num)) return "";
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(num);
};

export const NumberCell = React.memo<CellProps>(
  ({ value, onUpdate, rowId, columnId, cellId, isEditing, ...props }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [localValue, setLocalValue] = useState(toNumberString(value));

    useEffect(() => {
      setLocalValue(toNumberString(value));
    }, [value]);

    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [isEditing]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      // Allow typing negative numbers, decimals, and empty string
      if (inputValue === "" || inputValue === "-" || /^-?\d*\.?\d*$/.test(inputValue)) {
        setLocalValue(inputValue);
      }
    };

    const handleBlur = () => {
      if (localValue === "" || localValue === "-") {
        onUpdate(null);
      } else {
        const num = parseFloat(localValue);
        if (!isNaN(num)) {
          onUpdate(num);
        }
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleBlur();
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
        {({ value: cellValue, isEditing, onEdit }) => {
          const displayValue = formatNumber(cellValue);
          return isEditing ? (
            <Input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={localValue}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="h-8 w-full border-none bg-transparent p-0 text-right focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="0"
            />
          ) : (
            <div
              className={cn(
                "w-full truncate text-sm text-right tabular-nums",
                !displayValue && "text-muted-foreground"
              )}
              onClick={onEdit}
            >
              {displayValue || "0"}
            </div>
          );
        }}
      </CellWrapper>
    );
  }
);

NumberCell.displayName = "NumberCell";
