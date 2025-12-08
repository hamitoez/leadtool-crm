"use client";

import React, { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { CellProps, CellValue } from "@/types/table";

interface CellWrapperProps extends Omit<CellProps, "onUpdate"> {
  children: (props: {
    value: CellValue;
    isEditing: boolean;
    onEdit: () => void;
  }) => React.ReactNode;
  onUpdate: (value: CellValue) => Promise<void> | void;
  className?: string;
  editable?: boolean;
}

export const CellWrapper = React.memo<CellWrapperProps>(
  ({
    children,
    value,
    onUpdate,
    className,
    editable = true,
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const cellRef = useRef<HTMLDivElement>(null);
    const previousValueRef = useRef(value);

    // Use the prop value directly - controlled component pattern
    // previousValueRef tracks the last committed value for comparison
    const displayValue = value;

    const handleDoubleClick = useCallback(() => {
      if (editable) {
        setIsEditing(true);
      }
    }, [editable]);

    const handleBlur = useCallback(() => {
      setIsEditing(false);
      // Only update if value changed
      if (value !== previousValueRef.current) {
        previousValueRef.current = value;
        const result = onUpdate(value);
        if (result && typeof result.catch === 'function') {
          result.catch((error: Error) => {
            console.error("Failed to update cell:", error);
          });
        }
      }
    }, [value, onUpdate]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleBlur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setIsEditing(false);
        }
      },
      [handleBlur]
    );

    const handleEdit = useCallback(() => {
      if (editable) {
        setIsEditing(true);
      }
    }, [editable]);

    return (
      <div
        ref={cellRef}
        className={cn(
          "relative group h-full w-full px-2 py-1 flex items-center",
          "transition-colors duration-100",
          isHovered && !isEditing && "bg-blue-50/50 dark:bg-blue-950/20",
          isEditing && "bg-blue-100 dark:bg-blue-900/30 ring-1 ring-primary ring-inset",
          editable && "cursor-text",
          className
        )}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="gridcell"
        aria-readonly={!editable}
      >
        {children({ value: displayValue, isEditing, onEdit: handleEdit })}
      </div>
    );
  }
);

CellWrapper.displayName = "CellWrapper";
