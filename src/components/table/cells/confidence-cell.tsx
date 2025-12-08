"use client";

import React from "react";
import { CellWrapper } from "./cell-wrapper";
import { CellProps } from "@/types/table";
import { cn } from "@/lib/utils";

export const ConfidenceCell = React.memo<CellProps>(
  ({ value, onUpdate, rowId, columnId, cellId, ...props }) => {
    // Value should be between 0 and 1
    const numValue = typeof value === 'number' ? value : 0;
    const percentage = Math.round(numValue * 100);

    const getColorClass = (percent: number) => {
      if (percent >= 80) return "bg-green-500";
      if (percent >= 60) return "bg-blue-500";
      if (percent >= 40) return "bg-yellow-500";
      return "bg-red-500";
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
        {() => (
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  getColorClass(percentage)
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground min-w-[3rem] text-right">
              {percentage}%
            </span>
          </div>
        )}
      </CellWrapper>
    );
  }
);

ConfidenceCell.displayName = "ConfidenceCell";
