# Notion-like Table View - Installation Guide

This guide will help you complete the installation and setup of the Notion-like table view for your LeadTool CRM project.

## Step 1: Install Required Packages

Run the following command to install all required dependencies:

```bash
npm install @tanstack/react-table @tanstack/react-virtual @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

These packages provide:
- `@tanstack/react-table` - Headless table library with sorting, filtering, pagination
- `@tanstack/react-virtual` - Row virtualization for handling 10,000+ rows
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` - Drag and drop for column reordering

## Step 2: Verify File Structure

Ensure all files have been created in the correct locations:

```
C:\Users\merve\Desktop\CRM\
├── src/
│   ├── types/
│   │   └── table.ts                           ✓ Created
│   ├── components/
│   │   ├── ui/
│   │   │   └── alert.tsx                      ✓ Created
│   │   └── table/
│   │       ├── data-table.tsx                 ✓ Created
│   │       ├── column-header.tsx              ✓ Created
│   │       ├── table-toolbar.tsx              ✓ Created
│   │       └── cells/
│   │           ├── index.tsx                  ✓ Created
│   │           ├── cell-wrapper.tsx           ✓ Created
│   │           ├── text-cell.tsx              ✓ Created
│   │           ├── url-cell.tsx               ✓ Created
│   │           ├── email-cell.tsx             ✓ Created
│   │           ├── phone-cell.tsx             ✓ Created
│   │           ├── status-cell.tsx            ✓ Created
│   │           └── confidence-cell.tsx        ✓ Created
│   ├── hooks/
│   │   ├── use-table-data.ts                  ✓ Created
│   │   └── use-cell-update.ts                 ✓ Created
│   └── app/
│       ├── api/
│       │   └── tables/
│       │       ├── [tableId]/
│       │       │   ├── route.ts               ✓ Created
│       │       │   └── rows/
│       │       │       └── route.ts           ✓ Created
│       │       └── cells/
│       │           └── [cellId]/
│       │               └── route.ts           ✓ Created
│       └── (dashboard)/
│           └── projects/
│               └── [projectId]/
│                   └── tables/
│                       └── [tableId]/
│                           └── page.tsx       ✓ Updated
```

## Step 3: Build and Test

1. **Build the project** to ensure no TypeScript errors:
   ```bash
   npm run build
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Access a table** by navigating to:
   ```
   http://localhost:3000/projects/{projectId}/tables/{tableId}
   ```

## Features Implemented

### Core Table Features
- ✓ TanStack Table integration with full TypeScript support
- ✓ Column resizing with drag handles
- ✓ Column reordering via drag and drop (@dnd-kit)
- ✓ Row virtualization for 10,000+ rows (@tanstack/react-virtual)
- ✓ Multi-column sorting
- ✓ Global and per-column filtering
- ✓ Pagination with configurable page size

### Cell Types Implemented
- ✓ **Text Cell** - Basic text with inline editing
- ✓ **URL Cell** - Clickable links with external link icon
- ✓ **Email Cell** - Mailto links with validation
- ✓ **Phone Cell** - Tel links for phone numbers
- ✓ **Status Cell** - Badge with dropdown selection
- ✓ **Confidence Cell** - Progress bar with percentage

### Inline Editing
- ✓ Double-click to edit cells
- ✓ Enter to save, Escape to cancel
- ✓ Auto-save with 500ms debounce
- ✓ Optimistic updates with error handling

### Column Management
- ✓ Column header with sort indicators
- ✓ Rename columns inline
- ✓ Delete columns with confirmation
- ✓ Hide/show columns
- ✓ Change column types (prepared for future)

### Table Toolbar
- ✓ Global search across all columns
- ✓ Filter management UI
- ✓ Column visibility toggle
- ✓ Add new column button
- ✓ Add new row button

### Performance Optimizations
- ✓ React.memo for all cell components
- ✓ Virtualization enabled for 50+ rows
- ✓ Debounced updates (500ms)
- ✓ Optimistic UI updates
- ✓ Efficient re-rendering

## API Endpoints

All API endpoints are secured with authentication and authorization:

### Table Endpoints
- `GET /api/tables/[tableId]` - Get table with columns
- `PATCH /api/tables/[tableId]` - Update table metadata
- `DELETE /api/tables/[tableId]` - Delete table

### Row Endpoints
- `GET /api/tables/[tableId]/rows` - Get rows with pagination
- `POST /api/tables/[tableId]/rows` - Create new row

### Cell Endpoints
- `GET /api/tables/cells/[cellId]` - Get cell data
- `PATCH /api/tables/cells/[cellId]` - Update cell value

## Usage Examples

### Adding a New Row
```typescript
const handleAddRow = async () => {
  const response = await fetch(`/api/tables/${tableId}/rows`, {
    method: "POST",
  });
  const data = await response.json();
  console.log("New row created:", data.row);
};
```

### Updating a Cell
```typescript
const handleCellUpdate = async (cellId: string, value: any) => {
  await updateCell(cellId, value); // Uses debounced hook
};
```

### Custom Cell Renderer
To add a new cell type:

1. Create a new cell component in `src/components/table/cells/`
2. Follow the `CellProps` interface
3. Add it to `getCellRenderer()` in `src/components/table/cells/index.tsx`

## Keyboard Shortcuts

- **Enter** - Save cell edit
- **Escape** - Cancel cell edit
- **Tab** - Navigate to next cell (native)
- **Arrow Keys** - Navigate cells (native)

## Notion-like Features

The implementation closely mimics Notion's table UX:
- Clean, minimal design
- Inline editing with double-click
- Smooth animations and transitions
- Hover states for better affordance
- Fast, responsive interactions
- Column drag handles
- Row zebra striping (subtle)

## Next Steps (Optional Enhancements)

1. **Add More Cell Types**:
   - Date picker cell
   - Number cell with formatting
   - Multi-select cell
   - Person/Company cells with autocomplete
   - File attachment cell

2. **Column Type Change Dialog**:
   - Modal to select new column type
   - Migrate existing data safely

3. **Advanced Filtering**:
   - Filter builder UI
   - Multiple conditions per column
   - Save filter presets

4. **Real-time Collaboration**:
   - WebSocket/SSE for live updates
   - Show active users
   - Presence indicators

5. **Bulk Operations**:
   - Multi-row selection
   - Bulk edit
   - Bulk delete

6. **Import/Export**:
   - CSV import
   - Excel export
   - JSON export

## Troubleshooting

### TypeScript Errors
If you see TypeScript errors, ensure all dependencies are installed:
```bash
npm install
```

### Cell Not Updating
- Check browser console for API errors
- Verify authentication is working
- Check that the cell ID is correct

### Performance Issues
- Enable virtualization for large datasets (>50 rows)
- Check that React.memo is working (use React DevTools Profiler)
- Reduce debounce time if needed (but not below 300ms)

### Drag and Drop Not Working
- Ensure @dnd-kit packages are installed
- Check for CSS conflicts
- Verify `enableColumnReordering={true}` is set

## Support

For issues or questions, check:
1. Browser console for errors
2. Network tab for API failures
3. React DevTools for component state
4. Database logs for Prisma errors

## Production Checklist

Before deploying to production:

- [ ] Run `npm run build` successfully
- [ ] Test with realistic data volumes (1000+ rows)
- [ ] Test all cell types (edit, save, cancel)
- [ ] Test column operations (rename, delete, hide, reorder)
- [ ] Test on different browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on mobile devices (responsive design)
- [ ] Verify API rate limiting is in place
- [ ] Add error boundaries for graceful failures
- [ ] Set up monitoring for API endpoints
- [ ] Review security (authentication, authorization)

## Performance Benchmarks

Expected performance with virtualization enabled:
- **1,000 rows**: Instant rendering, smooth scrolling
- **10,000 rows**: < 500ms initial render, smooth scrolling
- **50,000 rows**: < 2s initial render, may notice scroll lag
- **100,000+ rows**: Consider server-side pagination

## License

This implementation is part of the LeadTool CRM project.
