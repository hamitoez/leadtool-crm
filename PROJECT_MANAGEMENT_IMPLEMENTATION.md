# Project Management CRUD Implementation

This document describes the complete Project Management system implemented for the LeadTool CRM application.

## Overview

A full-featured Project and Table management system with CRUD operations, built with Next.js 14 App Router, TypeScript, Prisma, and shadcn/ui components.

## Implemented Features

### 1. API Routes

#### Projects API (`/api/projects`)

**File:** `src/app/api/projects/route.ts`
- `GET` - List all projects for authenticated user
  - Includes table count
  - Ordered by updatedAt (newest first)
- `POST` - Create new project
  - Validates with Zod schema
  - Requires authentication
  - Returns created project with table count

**File:** `src/app/api/projects/[projectId]/route.ts`
- `GET` - Get single project with all tables
  - Includes row and column counts for each table
  - Verifies user ownership
- `PATCH` - Update project name and description
  - Validates with Zod schema
  - Verifies user ownership
- `DELETE` - Delete project
  - Cascade deletes all tables, columns, rows, and cells
  - Verifies user ownership

#### Tables API

**File:** `src/app/api/projects/[projectId]/tables/route.ts`
- `GET` - List all tables in a project
  - Includes row and column counts
  - Verifies project ownership
- `POST` - Create new table
  - Creates default "Name" column (TEXT type)
  - Validates with Zod schema
  - Verifies project ownership

**File:** `src/app/api/projects/[projectId]/tables/[tableId]/route.ts`
- `GET` - Get table with columns and counts
  - Verifies project ownership
- `PATCH` - Update table name and description
  - Validates with Zod schema
  - Verifies project ownership
- `DELETE` - Delete table
  - Cascade deletes columns, rows, and cells
  - Verifies project ownership

### 2. Validation Schemas

**File:** `src/lib/validations/project.ts`

Zod schemas for all project and table operations:
- `createProjectSchema` - Name (required, max 100 chars), Description (optional, max 500 chars)
- `updateProjectSchema` - Name and Description (both optional)
- `createTableSchema` - Same as createProjectSchema
- `updateTableSchema` - Same as updateProjectSchema

TypeScript types exported:
- `CreateProjectInput`
- `UpdateProjectInput`
- `CreateTableInput`
- `UpdateTableInput`

### 3. UI Components

#### Shared Components

**File:** `src/components/shared/delete-dialog.tsx`
- Generic confirmation dialog for destructive actions
- Optional name confirmation (user must type name to confirm)
- Loading state support
- Customizable title and description

**File:** `src/components/ui/textarea.tsx`
- Standard textarea component following shadcn/ui pattern
- Consistent styling with other form inputs

#### Project Components

**File:** `src/components/projects/create-project-dialog.tsx`
- Modal dialog with form for creating projects
- react-hook-form + Zod validation
- Success toast on creation
- Auto-navigation to new project
- Loading states

**File:** `src/components/projects/edit-project-dialog.tsx`
- Pre-filled form with current project values
- Same validation as create dialog
- Success toast on update
- Triggers page refresh

**File:** `src/components/projects/project-card.tsx`
- Displays project name, description, table count
- Shows last updated time (relative format)
- Dropdown menu with Edit and Delete actions
- Click-through navigation to project detail
- Integrates EditProjectDialog and DeleteDialog
- Hover effects for better UX

**File:** `src/components/projects/edit-project-button.tsx`
- Simple button component that opens edit dialog
- Used on project detail page

#### Table Components

**File:** `src/components/projects/create-table-dialog.tsx`
- Modal dialog for creating tables
- Same pattern as create-project-dialog
- Auto-navigation to new table
- Informs user about default "Name" column

**File:** `src/components/projects/edit-table-dialog.tsx`
- Pre-filled form for updating tables
- Same pattern as edit-project-dialog

**File:** `src/components/projects/table-card.tsx`
- Displays table name, description
- Shows row count and column count as badges
- Shows last updated time
- Dropdown menu with Edit and Delete actions
- Click-through navigation to table view
- Integrates EditTableDialog and DeleteDialog

**File:** `src/components/projects/index.ts`
- Barrel export for all project components
- Simplifies imports

### 4. Pages

#### Projects List Page

**File:** `src/app/(dashboard)/projects/page.tsx`

Features:
- Displays all user's projects in a grid
- CreateProjectDialog integration
- Loading states with Skeleton components
- Empty state with call-to-action
- Uses Suspense for better loading UX
- Server-side data fetching
- Authentication check with redirect

#### Project Detail Page

**File:** `src/app/(dashboard)/projects/[projectId]/page.tsx`

Features:
- Breadcrumb navigation (Projects > Project Name)
- Project header with name, description, creation date, table count
- Edit project button
- Tables section with grid layout
- CreateTableDialog integration
- Empty state for tables
- Server-side data fetching
- Authentication and ownership verification
- 404 handling for non-existent projects

#### Table View Page (Placeholder)

**File:** `src/app/(dashboard)/projects/[projectId]/tables/[tableId]/page.tsx`

Features:
- Breadcrumb navigation (Projects > Project > Table)
- Placeholder for future table view implementation
- Shows column and row counts
- Authentication and ownership verification
- 404 handling

### 5. Utilities

**File:** `src/lib/utils.ts`

Added `formatDistanceToNow()` function:
- Converts Date to human-readable relative time
- Examples: "just now", "5 minutes ago", "2 days ago"
- Used in ProjectCard and TableCard components

## Security Features

All API routes implement:
1. **Authentication Check** - Verifies user is logged in
2. **Ownership Verification** - Ensures user owns the resource
3. **Input Validation** - Zod schemas validate all inputs
4. **Error Handling** - Proper error responses with status codes
5. **Cascade Deletes** - Database enforces referential integrity

## User Experience Features

1. **Optimistic UI** - Page refreshes after mutations
2. **Toast Notifications** - Success and error feedback
3. **Loading States** - Disabled buttons and skeleton screens
4. **Confirmation Dialogs** - Prevents accidental deletions
5. **Name Confirmation** - Required for destructive actions
6. **Responsive Design** - Grid layouts adapt to screen size
7. **Hover Effects** - Better visual feedback
8. **Breadcrumb Navigation** - Clear navigation hierarchy
9. **Empty States** - Helpful CTAs when no data exists
10. **Relative Timestamps** - User-friendly time displays

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── projects/
│   │       ├── route.ts (GET, POST)
│   │       └── [projectId]/
│   │           ├── route.ts (GET, PATCH, DELETE)
│   │           └── tables/
│   │               ├── route.ts (GET, POST)
│   │               └── [tableId]/
│   │                   └── route.ts (GET, PATCH, DELETE)
│   └── (dashboard)/
│       └── projects/
│           ├── page.tsx (Projects list)
│           └── [projectId]/
│               ├── page.tsx (Project detail)
│               └── tables/
│                   └── [tableId]/
│                       └── page.tsx (Table view)
├── components/
│   ├── projects/
│   │   ├── create-project-dialog.tsx
│   │   ├── edit-project-dialog.tsx
│   │   ├── edit-project-button.tsx
│   │   ├── project-card.tsx
│   │   ├── create-table-dialog.tsx
│   │   ├── edit-table-dialog.tsx
│   │   ├── table-card.tsx
│   │   └── index.ts
│   ├── shared/
│   │   └── delete-dialog.tsx
│   └── ui/
│       └── textarea.tsx (added)
└── lib/
    ├── validations/
    │   └── project.ts
    └── utils.ts (updated with formatDistanceToNow)
```

## Usage Examples

### Creating a Project

```typescript
// User clicks "New Project" button
// Opens CreateProjectDialog
// Fills form and submits
// POST /api/projects
// Navigates to /projects/{id}
```

### Editing a Project

```typescript
// User clicks edit in dropdown on ProjectCard
// Opens EditProjectDialog with pre-filled data
// Updates and submits
// PATCH /api/projects/{id}
// Page refreshes to show changes
```

### Deleting a Project

```typescript
// User clicks delete in dropdown
// Opens DeleteDialog
// User types project name to confirm
// DELETE /api/projects/{id}
// Card removed from view
```

### Creating a Table

```typescript
// From project detail page
// User clicks "New Table" button
// Opens CreateTableDialog
// Fills form and submits
// POST /api/projects/{projectId}/tables
// Navigates to /projects/{projectId}/tables/{tableId}
```

## Database Schema

The implementation leverages existing Prisma schema:

```prisma
model Project {
  id          String  @id @default(cuid())
  userId      String
  name        String
  description String?
  settings    Json    @default("{}")

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  tables Table[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Table {
  id          String  @id @default(cuid())
  projectId   String
  name        String
  description String?
  settings    Json    @default("{}")

  project Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  columns Column[]
  rows    Row[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Testing the Implementation

1. **Create a Project**
   - Navigate to /projects
   - Click "New Project"
   - Fill in name and optional description
   - Submit and verify navigation to project detail

2. **Edit a Project**
   - From projects list, hover over card
   - Click three-dot menu > Edit
   - Update values and save
   - Verify changes are reflected

3. **Delete a Project**
   - Click three-dot menu > Delete
   - Type project name to confirm
   - Verify project is removed

4. **Create a Table**
   - From project detail page
   - Click "New Table"
   - Fill in name and submit
   - Verify table appears in list

5. **Edit/Delete Table**
   - Same flow as projects
   - Verify cascade delete removes table data

## Next Steps

To extend this implementation:

1. **Table View** - Implement actual data grid for tables
2. **Column Management** - Add/edit/delete columns
3. **Row Management** - Add/edit/delete rows
4. **Cell Editing** - Inline editing of cell values
5. **Import/Export** - CSV import/export functionality
6. **Search/Filter** - Search projects and tables
7. **Sorting** - Sort projects/tables by different criteria
8. **Pagination** - For large datasets
9. **Bulk Operations** - Select and delete multiple items
10. **Sharing** - Share projects with other users

## Dependencies

All dependencies are already installed:
- `react-hook-form` - Form handling
- `@hookform/resolvers` - Zod integration
- `zod` - Schema validation
- `sonner` - Toast notifications
- `@radix-ui/react-dialog` - Dialog component
- `lucide-react` - Icons

## Notes

- All components are client components (`"use client"`) where needed
- Server components used for pages to leverage SSR
- TypeScript strict mode compatible
- Follows Next.js 14+ App Router conventions
- Uses Next.js 14+ async params API
- All API routes handle Next.js 14+ params properly
- Consistent error handling across all routes
- Accessible UI with proper ARIA labels
- Responsive design with Tailwind CSS
