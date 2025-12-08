"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { CellData, CellValue, JsonValue } from "@/types/table";

interface UseCellUpdateOptions {
  onSuccess?: (cell: CellData) => void;
  onError?: (error: Error) => void;
  debounceMs?: number;
}

interface UseCellUpdateReturn {
  updateCell: (cellId: string, value: CellValue, metadata?: Record<string, JsonValue>) => Promise<void>;
  isUpdating: boolean;
  error: Error | null;
  optimisticUpdate: (cellId: string, value: CellValue) => void;
  revertUpdate: (cellId: string) => void;
}

export function useCellUpdate({
  onSuccess,
  onError,
  debounceMs = 500,
}: UseCellUpdateOptions = {}): UseCellUpdateReturn {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Store for optimistic updates
  const optimisticValues = useRef<Map<string, CellValue>>(new Map());
  const previousValues = useRef<Map<string, CellValue>>(new Map());

  // Debounce timers
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const optimisticUpdate = useCallback((cellId: string, value: CellValue) => {
    if (!previousValues.current.has(cellId)) {
      const prevValue = optimisticValues.current.get(cellId);
      previousValues.current.set(cellId, prevValue ?? null);
    }
    optimisticValues.current.set(cellId, value);
  }, []);

  const revertUpdate = useCallback((cellId: string) => {
    const previousValue = previousValues.current.get(cellId);
    if (previousValue !== undefined) {
      optimisticValues.current.set(cellId, previousValue);
      previousValues.current.delete(cellId);
    }
  }, []);

  const updateCell = useCallback(
    async (cellId: string, value: CellValue, metadata?: Record<string, JsonValue>) => {
      // Clear existing debounce timer for this cell
      const existingTimer = debounceTimers.current.get(cellId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set optimistic value
      optimisticUpdate(cellId, value);

      // Create new debounced update
      const timer = setTimeout(async () => {
        try {
          setIsUpdating(true);
          setError(null);

          const response = await fetch(`/api/tables/cells/${cellId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              value,
              metadata,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to update cell");
          }

          const data = await response.json();

          // Clear optimistic state on success
          optimisticValues.current.delete(cellId);
          previousValues.current.delete(cellId);

          onSuccess?.(data.cell);
        } catch (err) {
          const error = err instanceof Error ? err : new Error("Unknown error");
          setError(error);

          // Revert optimistic update on error
          revertUpdate(cellId);

          onError?.(error);
          throw error;
        } finally {
          setIsUpdating(false);
          debounceTimers.current.delete(cellId);
        }
      }, debounceMs);

      debounceTimers.current.set(cellId, timer);
    },
    [debounceMs, onSuccess, onError, optimisticUpdate, revertUpdate]
  );

  return {
    updateCell,
    isUpdating,
    error,
    optimisticUpdate,
    revertUpdate,
  };
}
