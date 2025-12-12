import { ColumnType, Prisma } from "@prisma/client";

// Use Prisma's JsonValue for compatibility
export type JsonValue = Prisma.JsonValue;

// Table data structures
export interface TableData {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  columns: ColumnConfig[];
  settings?: Record<string, JsonValue>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ColumnConfig {
  id: string;
  name: string;
  type: ColumnType;
  position: number;
  width: number;
  isVisible: boolean;
  isPinned: boolean;
  config: Record<string, JsonValue>;
  aiConfig?: Record<string, JsonValue>;
}

// Cell value can be various types (compatible with Prisma Json field)
export type CellValue = JsonValue;

export interface RowData {
  id: string;
  position: number;
  isFavorite: boolean;
  notes: string | null;
  cells: Record<string, CellData>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CellData {
  id: string;
  rowId: string;
  columnId: string;
  value: CellValue;
  metadata: Record<string, JsonValue>;
  createdAt: Date;
  updatedAt: Date;
}

// Table state and settings
export interface TableSettings {
  pageSize: number;
  defaultSort?: SortingState;
  enableVirtualization: boolean;
  enableColumnReordering: boolean;
  enableColumnResizing: boolean;
}

export interface SortingState {
  columnId: string;
  direction: "asc" | "desc";
}

export interface FilterState {
  columnId: string;
  value: string;
  operator: "contains" | "equals" | "startsWith" | "endsWith";
}

export interface PaginationState {
  pageIndex: number;
  pageSize: number;
}

// Cell component props
export interface CellProps {
  value: CellValue;
  rowId: string;
  columnId: string;
  cellId: string;
  columnType: ColumnType;
  config?: Record<string, JsonValue>;
  metadata?: Record<string, JsonValue>;
  isEditing?: boolean;
  onUpdate: (value: CellValue) => Promise<void> | void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

// Status options for STATUS column type
export interface StatusOption {
  label: string;
  value: string;
  color: string;
}

// API response types
export interface TableDataResponse {
  table: TableData;
  totalRows: number;
}

export interface RowsResponse {
  rows: RowData[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
}

export interface CellUpdateRequest {
  value: CellValue;
  metadata?: Record<string, JsonValue>;
}

export interface CellUpdateResponse {
  cell: CellData;
  success: boolean;
}

// Column type configurations
export interface ColumnTypeConfig {
  type: ColumnType;
  label: string;
  icon: string;
  defaultWidth: number;
  supportsSorting: boolean;
  supportsFiltering: boolean;
  defaultConfig?: Record<string, JsonValue>;
}

// DnD types for column reordering
export interface DragItem {
  id: string;
  index: number;
}

// Saved View types
export interface TableView {
  id: string;
  tableId: string;
  name: string;
  isDefault: boolean;
  filters: FilterState[];
  sorting: SortingState[];
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  globalFilter: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TableViewConfig {
  filters: FilterState[];
  sorting: SortingState[];
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  globalFilter: string;
}
