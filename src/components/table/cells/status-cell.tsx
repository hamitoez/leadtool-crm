"use client";

import React, { useState } from "react";
import { CellWrapper } from "./cell-wrapper";
import { CellProps, StatusOption } from "@/types/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_STATUS_OPTIONS: StatusOption[] = [
  { label: "Not Started", value: "not_started", color: "gray" },
  { label: "In Progress", value: "in_progress", color: "blue" },
  { label: "Completed", value: "completed", color: "green" },
  { label: "Blocked", value: "blocked", color: "red" },
];

const STATUS_COLORS: Record<string, string> = {
  gray: "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900 dark:text-gray-300",
  blue: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-300",
  green: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-300",
  red: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-300",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300",
  purple: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900 dark:text-purple-300",
};

export const StatusCell = React.memo<CellProps>(
  ({ value, onUpdate, config, rowId, columnId, cellId, ...props }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Handle both string arrays and StatusOption arrays
    const rawOptions = Array.isArray(config?.options) ? config.options : DEFAULT_STATUS_OPTIONS;
    const options: StatusOption[] = rawOptions.map((opt, index) => {
      if (typeof opt === 'string') {
        return { label: opt, value: opt, color: Object.keys(STATUS_COLORS)[index % Object.keys(STATUS_COLORS).length] };
      }
      return opt as StatusOption;
    });

    const selectedOption = options.find((opt) => opt.value === value || opt.label === value);

    const handleSelect = (newValue: string) => {
      onUpdate(newValue);
      setIsOpen(false);
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
        {({ value: localValue }) => (
          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1 w-full text-left outline-none h-full"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(true);
                }}
              >
                {selectedOption ? (
                  <Badge
                    className={cn(
                      "px-1.5 py-0 text-[10px] font-medium",
                      STATUS_COLORS[selectedOption.color] || STATUS_COLORS.gray
                    )}
                  >
                    {selectedOption.label}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground/50"></span>
                )}
                <ChevronDown className="h-3 w-3 ml-auto opacity-30" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {options.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className="flex items-center justify-between"
                >
                  <Badge
                    className={cn(
                      "px-2 py-0.5 text-xs font-medium",
                      STATUS_COLORS[option.color] || STATUS_COLORS.gray
                    )}
                  >
                    {option.label}
                  </Badge>
                  {localValue === option.value && (
                    <Check className="h-4 w-4 ml-2" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CellWrapper>
    );
  }
);

StatusCell.displayName = "StatusCell";
