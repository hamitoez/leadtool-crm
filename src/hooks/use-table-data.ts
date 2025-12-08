"use client";

import { useState, useEffect, useCallback } from "react";
import { TableData, RowData, RowsResponse } from "@/types/table";

interface UseTableDataOptions {
  tableId: string;
  pageSize?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseTableDataReturn {
  table: TableData | null;
  rows: RowData[];
  totalRows: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function useTableData({
  tableId,
  pageSize = 50,
  autoRefresh = false,
  refreshInterval = 30000,
}: UseTableDataOptions): UseTableDataReturn {
  const [table, setTable] = useState<TableData | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchTable = useCallback(async () => {
    try {
      const response = await fetch(`/api/tables/${tableId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch table");
      }
      const data = await response.json();
      setTable(data.table);
      setTotalRows(data.totalRows);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    }
  }, [tableId]);

  const fetchRows = useCallback(
    async (page = 0, append = false) => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/tables/${tableId}/rows?page=${page}&pageSize=${pageSize}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch rows");
        }

        const data: RowsResponse = await response.json();

        if (append) {
          setRows((prev) => [...prev, ...data.rows]);
        } else {
          setRows(data.rows);
        }

        setTotalRows(data.totalCount);
        setHasMore(data.rows.length === pageSize);
        setCurrentPage(page);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    },
    [tableId, pageSize]
  );

  const refetch = useCallback(async () => {
    await Promise.all([fetchTable(), fetchRows(0, false)]);
  }, [fetchTable, fetchRows]);

  const loadMore = useCallback(async () => {
    if (hasMore && !isLoading) {
      await fetchRows(currentPage + 1, true);
    }
  }, [hasMore, isLoading, currentPage, fetchRows]);

  // Initial fetch
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(refetch, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refetch]);

  return {
    table,
    rows,
    totalRows,
    isLoading,
    error,
    refetch,
    loadMore,
    hasMore,
  };
}
