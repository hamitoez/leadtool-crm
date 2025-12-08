"use client";

import React, { useState, useRef, useEffect } from "react";
import { CellWrapper } from "./cell-wrapper";
import { CellProps, CellValue } from "@/types/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { de } from "date-fns/locale";

// Helper to convert CellValue to Date for the calendar
const toDate = (val: CellValue): Date | undefined => {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "string") {
    const parsed = parseISO(val);
    return isValid(parsed) ? parsed : undefined;
  }
  if (val instanceof Date) return val;
  return undefined;
};

// Helper to format date for display
const formatDate = (val: CellValue): string => {
  const date = toDate(val);
  if (!date) return "";
  return format(date, "dd.MM.yyyy", { locale: de });
};

export const DateCell = React.memo<CellProps>(
  ({ value, onUpdate, rowId, columnId, cellId, ...props }) => {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleSelect = (date: Date | undefined) => {
      if (date) {
        onUpdate(date.toISOString());
      } else {
        onUpdate(null);
      }
      setOpen(false);
    };

    const handleClear = () => {
      onUpdate(null);
      setOpen(false);
    };

    return (
      <CellWrapper
        value={value}
        onUpdate={onUpdate}
        rowId={rowId}
        columnId={columnId}
        cellId={cellId}
        editable={false}
        {...props}
      >
        {({ value: localValue }) => {
          const displayValue = formatDate(localValue);
          const dateValue = toDate(localValue);

          return (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  ref={buttonRef}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 w-full justify-start p-0 font-normal hover:bg-transparent",
                    !displayValue && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {displayValue || "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateValue}
                  onSelect={handleSelect}
                  initialFocus
                  locale={de}
                />
                {dateValue && (
                  <div className="border-t p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={handleClear}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          );
        }}
      </CellWrapper>
    );
  }
);

DateCell.displayName = "DateCell";
