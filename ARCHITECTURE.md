# Table View Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       Table Page (Server)                        │
│  src/app/(dashboard)/projects/[projectId]/tables/[tableId]/     │
│                         page.tsx                                 │
│                                                                  │
│  - Authenticates user                                           │
│  - Fetches initial table data from Prisma                      │
│  - Formats data for client                                      │
│  - Renders TableViewClient                                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   TableViewClient (Client)                       │
│           src/components/table/table-view-client.tsx            │
│                                                                  │
│  - Manages local state                                          │
│  - Handles cell updates with useCellUpdate hook                │
│  - Handles column operations                                    │
│  - Renders DataTable component                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DataTable (Client)                            │
│               src/components/table/data-table.tsx               │
│                                                                  │
│  - TanStack Table setup                                         │
│  - Virtualization (@tanstack/react-virtual)                    │
│  - Drag & drop (@dnd-kit)                                      │
│  - Sorting, filtering, pagination                              │
│  - Renders TableToolbar & table structure                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Component Breakdown                             │
└─────────────────────────────────────────────────────────────────┘

        TableToolbar                    Column Headers
       ┌──────────┐                    ┌──────────────┐
       │ Search   │                    │ColumnHeader  │
       │ Filters  │                    │  - Sort      │
       │ Columns  │                    │  - Resize    │
       │ Add Row  │                    │  - Menu      │
       └──────────┘                    └──────────────┘
              │                                │
              └────────────┬───────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Table Body │
                    │             │
                    │  Cells  →   │
                    └─────────────┘
                           │
                           ▼
                   Cell Renderers
              ┌────────────────────┐
              │ CellWrapper        │
              │  ├── TextCell      │
              │  ├── UrlCell       │
              │  ├── EmailCell     │
              │  ├── PhoneCell     │
              │  ├── StatusCell    │
              │  └── ConfidenceCell│
              └────────────────────┘
```

## Data Flow

### 1. Initial Load
```
User navigates to table URL
         ↓
Server Component (page.tsx)
  - Checks authentication
  - Queries Prisma for table + rows
  - Formats data
         ↓
TableViewClient receives props
  - initialRows: RowData[]
  - columns: ColumnConfig[]
         ↓
DataTable receives data
  - Sets up TanStack Table
  - Enables virtualization
         ↓
Table renders with cells
```

### 2. Cell Edit Flow
```
User double-clicks cell
         ↓
CellWrapper detects edit mode
         ↓
Specific cell renderer shows input
         ↓
User types & presses Enter
         ↓
useCellUpdate hook (debounced)
         ↓
PATCH /api/tables/cells/[cellId]
  - Validates auth
  - Updates database
  - Returns updated cell
         ↓
Optimistic update in UI
         ↓
Success toast notification
```

### 3. Column Operation Flow
```
User clicks column menu
         ↓
Dropdown shows options
  - Rename
  - Change Type
  - Hide
  - Delete
         ↓
User selects action
         ↓
API call to column endpoint
         ↓
router.refresh() to update server state
         ↓
UI re-renders with new data
```

## Component Hierarchy

```
TablePage (Server Component)
└── TableViewClient (Client Component)
    └── DataTable
        ├── TableToolbar
        │   ├── Search Input
        │   ├── Filter Button
        │   ├── Column Visibility Dropdown
        │   ├── Add Column Button
        │   └── Add Row Button
        ├── Table Header
        │   └── ColumnHeader (per column)
        │       ├── Sort Indicator
        │       ├── Column Menu Dropdown
        │       └── Resize Handle
        └── Table Body
            └── Rows (virtualized)
                └── Cells
                    └── Cell Renderers
                        └── CellWrapper
                            └── Specific Cell Type
```

## State Management

### Server State (Prisma)
- Table metadata
- Column definitions
- Row data
- Cell values

### Client State (React)
```typescript
// TableViewClient
const [rows, setRows] = useState(initialRows);

// DataTable
const [sorting, setSorting] = useState<SortingState>([]);
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
const [globalFilter, setGlobalFilter] = useState("");
const [columnOrder, setColumnOrder] = useState<string[]>([]);

// CellWrapper
const [isEditing, setIsEditing] = useState(false);
const [localValue, setLocalValue] = useState(value);

// useCellUpdate
const [isUpdating, setIsUpdating] = useState(false);
const [error, setError] = useState<Error | null>(null);
```

## API Architecture

```
┌─────────────────────────────────────────────┐
│              API Routes                      │
└─────────────────────────────────────────────┘

/api/tables/[tableId]
├── GET     - Fetch table with columns
├── PATCH   - Update table metadata
└── DELETE  - Delete table

/api/tables/[tableId]/rows
├── GET     - Fetch rows (paginated)
└── POST    - Create new row

/api/tables/cells/[cellId]
├── GET     - Fetch cell data
└── PATCH   - Update cell value

Each route includes:
✓ Authentication check (session)
✓ Authorization check (project ownership)
✓ Input validation
✓ Error handling
✓ Next.js 15 async params
```

## Database Schema (Prisma)

```
Table
├── id: String
├── name: String
├── projectId: String
├── columns: Column[]
└── rows: Row[]

Column
├── id: String
├── name: String
├── type: ColumnType (enum)
├── position: Int
├── width: Int
├── config: Json
└── tableId: String

Row
├── id: String
├── position: Int
├── tableId: String
└── cells: Cell[]

Cell
├── id: String
├── rowId: String
├── columnId: String
├── value: Json
└── metadata: Json
```

## Performance Optimizations

### 1. Virtualization
```typescript
// Enabled for 50+ rows
const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: () => 36,
  overscan: 10,
  enabled: enableVirtualization,
});
```

### 2. Memoization
```typescript
// All cell components use React.memo
export const TextCell = React.memo<CellProps>(({ ... }) => {
  // Component logic
});
```

### 3. Debouncing
```typescript
// useCellUpdate hook
const updateCell = useCallback(async (cellId, value) => {
  // Debounce timer (500ms)
  const timer = setTimeout(async () => {
    // API call
  }, debounceMs);
}, []);
```

### 4. Optimistic Updates
```typescript
// Update UI immediately
setRows((prevRows) =>
  prevRows.map((row) => {
    if (cellMatch) {
      return { ...row, cells: { ...updatedCells } };
    }
    return row;
  })
);

// Then save to server
await updateCell(cellId, value);
```

## Type System

```typescript
// Core types
interface TableData {
  id: string;
  name: string;
  columns: ColumnConfig[];
  // ...
}

interface ColumnConfig {
  id: string;
  name: string;
  type: ColumnType;
  width: number;
  // ...
}

interface RowData {
  id: string;
  cells: Record<string, CellData>;
  // ...
}

interface CellData {
  id: string;
  value: any;
  metadata: Record<string, any>;
  // ...
}
```

## Extension Points

### Add New Cell Type

1. **Create Cell Component**
```typescript
// src/components/table/cells/my-cell.tsx
export const MyCell = React.memo<CellProps>(({ ... }) => {
  return (
    <CellWrapper {...props}>
      {({ value, isEditing }) => (
        // Custom rendering
      )}
    </CellWrapper>
  );
});
```

2. **Register in Index**
```typescript
// src/components/table/cells/index.tsx
case "MY_TYPE": return MyCell;
```

3. **Add to Prisma Enum**
```prisma
enum ColumnType {
  // ... existing types
  MY_TYPE
}
```

### Add Column Operation

1. **Update ColumnHeader**
```typescript
<DropdownMenuItem onClick={handleMyOperation}>
  <Icon />
  My Operation
</DropdownMenuItem>
```

2. **Create Handler**
```typescript
const handleMyOperation = useCallback(async (columnId) => {
  await fetch(`/api/tables/columns/${columnId}/my-operation`, {
    method: "POST",
  });
}, []);
```

3. **Create API Route**
```typescript
// src/app/api/tables/columns/[columnId]/my-operation/route.ts
export async function POST(request, context) {
  // Implementation
}
```

## Dependencies

```json
{
  "dependencies": {
    "@tanstack/react-table": "^8.x",    // Headless table
    "@tanstack/react-virtual": "^3.x",  // Virtualization
    "@dnd-kit/core": "^6.x",            // DnD core
    "@dnd-kit/sortable": "^8.x",        // Sortable
    "@dnd-kit/utilities": "^3.x",       // DnD utils
    "next": "16.x",                      // Framework
    "react": "19.x",                     // Library
    "prisma": "^5.x",                    // ORM
    "lucide-react": "latest",            // Icons
    "sonner": "latest"                   // Toasts
  }
}
```

## File Structure

```
src/
├── types/
│   └── table.ts                 # TypeScript definitions
├── components/
│   ├── ui/                      # Reusable UI components
│   └── table/
│       ├── data-table.tsx       # Main table
│       ├── table-view-client.tsx# Client wrapper
│       ├── column-header.tsx    # Column header
│       ├── table-toolbar.tsx    # Toolbar
│       └── cells/               # Cell renderers
├── hooks/
│   ├── use-table-data.ts        # Data fetching
│   └── use-cell-update.ts       # Cell updates
└── app/
    ├── api/tables/              # API routes
    └── (dashboard)/             # App routes
```

---

This architecture provides:
- ✅ **Separation of concerns** - Clear component boundaries
- ✅ **Type safety** - Full TypeScript coverage
- ✅ **Performance** - Virtualization & memoization
- ✅ **Extensibility** - Easy to add features
- ✅ **Maintainability** - Well-organized code
- ✅ **Security** - Auth at every level

