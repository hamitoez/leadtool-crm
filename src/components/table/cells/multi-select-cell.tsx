"use client";

import React, { useState } from "react";
import { CellWrapper } from "./cell-wrapper";
import { CellProps, JsonValue } from "@/types/table";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SelectOption {
  label: string;
  value: string;
  color?: string;
}

const DEFAULT_COLORS = [
  "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200",
  "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200",
  "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200",
  "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200",
  "bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200",
  "bg-pink-100 text-pink-800 dark:bg-pink-800 dark:text-pink-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200",
];

const getColorForOption = (index: number): string => {
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
};

// Helper to convert config options to SelectOption array
const getOptionsFromConfig = (config?: Record<string, JsonValue>): SelectOption[] => {
  if (!config?.options || !Array.isArray(config.options)) {
    return [];
  }
  return (config.options as unknown as SelectOption[]).map((opt, index) => ({
    ...opt,
    color: opt.color || getColorForOption(index),
  }));
};

// Helper to parse value to array
const parseValueToArray = (value: JsonValue): string[] => {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is string => typeof v === "string");
      }
    } catch {
      return value ? [value] : [];
    }
  }
  return [];
};

export const MultiSelectCell = React.memo<CellProps>(
  ({ value, onUpdate, config, rowId, columnId, cellId, ...props }) => {
    const [open, setOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    const options = getOptionsFromConfig(config as Record<string, JsonValue>);
    const selectedValues = parseValueToArray(value);

    const selectedOptions = selectedValues
      .map((val) => options.find((opt) => opt.value === val))
      .filter((opt): opt is SelectOption => opt !== undefined);

    const handleToggle = (optionValue: string) => {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];
      onUpdate(newValues);
    };

    const handleRemove = (optionValue: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newValues = selectedValues.filter((v) => v !== optionValue);
      onUpdate(newValues);
    };

    const handleCreateOption = () => {
      if (searchValue.trim()) {
        const newValues = [...selectedValues, searchValue.trim()];
        onUpdate(newValues);
        setSearchValue("");
      }
    };

    const filteredOptions = options.filter((opt) =>
      opt.label.toLowerCase().includes(searchValue.toLowerCase())
    );

    const showCreateOption =
      searchValue.trim() &&
      !options.some((opt) => opt.label.toLowerCase() === searchValue.toLowerCase());

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
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto min-h-8 w-full justify-start p-1 font-normal hover:bg-transparent"
              >
                <div className="flex flex-wrap gap-1 flex-1">
                  {selectedOptions.length > 0 ? (
                    selectedOptions.map((option) => (
                      <Badge
                        key={option.value}
                        className={cn("px-2 py-0.5 text-xs gap-1", option.color)}
                      >
                        {option.label}
                        <X
                          className="h-3 w-3 cursor-pointer hover:opacity-70"
                          onClick={(e) => handleRemove(option.value, e)}
                        />
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">Select...</span>
                  )}
                </div>
                <ChevronDown className="ml-auto h-4 w-4 opacity-50 flex-shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search or create..."
                  value={searchValue}
                  onValueChange={setSearchValue}
                />
                <CommandList>
                  <CommandEmpty>
                    {showCreateOption ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={handleCreateOption}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create "{searchValue}"
                      </Button>
                    ) : (
                      "No options found"
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredOptions.map((option) => {
                      const isSelected = selectedValues.includes(option.value);
                      return (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={() => handleToggle(option.value)}
                        >
                          <div
                            className={cn(
                              "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "opacity-50 [&_svg]:invisible"
                            )}
                          >
                            <Check className="h-3 w-3" />
                          </div>
                          <Badge className={cn("px-2 py-0.5 text-xs", option.color)}>
                            {option.label}
                          </Badge>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                  {showCreateOption && filteredOptions.length > 0 && (
                    <CommandGroup>
                      <CommandItem onSelect={handleCreateOption}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create "{searchValue}"
                      </CommandItem>
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </CellWrapper>
    );
  }
);

MultiSelectCell.displayName = "MultiSelectCell";
