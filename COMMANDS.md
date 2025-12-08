# Quick Commands Reference

## 1. Install Dependencies (REQUIRED FIRST)

```bash
cd C:\Users\merve\Desktop\CRM
npm install @tanstack/react-table @tanstack/react-virtual @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## 2. Update Page Component

**Method 1: Copy/Paste (Recommended)**
1. Open `src\app\(dashboard)\projects\[projectId]\tables\[tableId]\table-page-new.tsx`
2. Copy ALL content (Ctrl+A, Ctrl+C)
3. Open `src\app\(dashboard)\projects\[projectId]\tables\[tableId]\page.tsx`
4. Paste and replace ALL content (Ctrl+A, Ctrl+V)
5. Save (Ctrl+S)

**Method 2: File Rename**
```bash
cd src\app\(dashboard)\projects\[projectId]\tables\[tableId]
rename page.tsx page.old.tsx
rename table-page-new.tsx page.tsx
```

## 3. Build Project

```bash
npm run build
```

If this succeeds, you're good to go!

## 4. Start Development Server

```bash
npm run dev
```

## 5. Test the Table

Navigate to:
```
http://localhost:3000/projects/{your-project-id}/tables/{your-table-id}
```

## Common Issues & Fixes

### Issue: "Module not found" errors
**Fix:**
```bash
npm install
```

### Issue: TypeScript errors
**Fix:**
```bash
npm run build
```
Check the errors and verify all files are created correctly.

### Issue: Page shows old placeholder
**Fix:** Make sure you updated `page.tsx` with the new content from `table-page-new.tsx`

### Issue: API errors
**Fix:** Check that:
1. Database is running
2. Prisma client is generated: `npx prisma generate`
3. Authentication is configured

## File Locations Quick Reference

| Component | Path |
|-----------|------|
| Main Table | `src\components\table\data-table.tsx` |
| Cell Types | `src\components\table\cells\` |
| Hooks | `src\hooks\use-table-data.ts` & `use-cell-update.ts` |
| API Routes | `src\app\api\tables\` |
| Page | `src\app\(dashboard)\projects\[projectId]\tables\[tableId]\page.tsx` |
| Types | `src\types\table.ts` |

## Quick Tests

### Test 1: Basic Load
1. Navigate to table URL
2. Check that table renders with columns and rows

### Test 2: Cell Edit
1. Double-click any cell
2. Type new value
3. Press Enter
4. Check that value saves

### Test 3: Column Sort
1. Click a column header
2. Check that rows sort

### Test 4: Search
1. Type in the search box
2. Check that rows filter

### Test 5: Add Row
1. Click "New Row" button
2. Check that a new row appears

## Package Versions

```json
{
  "@tanstack/react-table": "^8.x",
  "@tanstack/react-virtual": "^3.x",
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x",
  "@dnd-kit/utilities": "^3.x"
}
```

## Feature Checklist

After installation, verify these work:

- [ ] Table loads with data
- [ ] Double-click edits cells
- [ ] Enter saves, Escape cancels
- [ ] Column headers show sort indicators
- [ ] Search filters rows
- [ ] Column visibility toggle works
- [ ] New row button works
- [ ] URL cells are clickable
- [ ] Email cells open mailto
- [ ] Phone cells open tel
- [ ] Status cells show dropdown
- [ ] Confidence cells show progress bar

## Production Deployment

Before deploying:

```bash
# 1. Build
npm run build

# 2. Check for errors
# Should complete without errors

# 3. Test production build locally
npm start

# 4. Deploy using your deployment method
# (Vercel, Docker, etc.)
```

## Helpful Commands

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Generate Prisma client
npx prisma generate

# Run Prisma migrations
npx prisma migrate dev

# Lint code
npm run lint
```

## Support Documentation

- **INSTALLATION.md** - Full installation guide
- **QUICKSTART.md** - Quick reference
- **TABLE_IMPLEMENTATION_SUMMARY.md** - Complete feature list
- **FILES_CREATED.txt** - All created files

---

**Ready to go!** Run the install command and start testing.
