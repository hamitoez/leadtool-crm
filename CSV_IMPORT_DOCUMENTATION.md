# CSV Import Feature Documentation

## Overview

The CSV Import feature allows users to upload CSV files and import them into the LeadTool CRM. The feature includes automatic column type detection, column mapping, data preview, and batch importing with progress tracking.

## Architecture

### Components Structure

```
src/
├── types/
│   └── import.ts                          # TypeScript types for import
├── components/
│   ├── ui/
│   │   ├── select.tsx                     # Select component
│   │   ├── progress.tsx                   # Progress bar component
│   │   └── scroll-area.tsx                # Scroll area component
│   └── import/
│       ├── column-mapper.tsx              # Column mapping component
│       └── import-preview.tsx             # Data preview component
├── app/
│   ├── api/
│   │   └── import/
│   │       ├── route.ts                   # CSV upload & parsing endpoint
│   │       └── confirm/
│   │           └── route.ts               # Import confirmation endpoint
│   └── (dashboard)/
│       └── import/
│           └── page.tsx                   # Main import page
```

## Features

### 1. CSV Upload & Parsing (`/api/import`)

**Endpoint:** `POST /api/import`

**Features:**
- File validation (type, size up to 10MB)
- Multi-encoding support (UTF-8, ISO-8859-1)
- Automatic CSV parsing using PapaParse
- Returns headers and preview rows (first 10)
- Error handling with detailed messages

**Request:**
```typescript
FormData {
  file: File // CSV file
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    headers: string[],
    rows: string[][],
    totalRows: number,
    previewRows: string[][]
  },
  encoding: "UTF-8" | "ISO-8859-1",
  message: string
}
```

### 2. Import Confirmation (`/api/import/confirm`)

**Endpoint:** `POST /api/import/confirm`

**Features:**
- Create new project or use existing
- Create table with mapped columns
- Batch insert rows and cells (100 rows per batch)
- Type conversion (numbers, dates, arrays)
- Transaction-based for data integrity

**Request:**
```typescript
{
  projectId?: string,
  projectName?: string,
  tableName: string,
  columnMappings: ColumnMapping[],
  rows: string[][]
}
```

**Response:**
```typescript
{
  success: true,
  tableId: string,
  projectId: string,
  rowsImported: number
}
```

### 3. Column Mapper Component

**Location:** `src/components/import/column-mapper.tsx`

**Features:**
- Automatic column type detection based on:
  - Column header names
  - Sample data patterns
  - Regex matching for emails, phones, URLs
- Manual column type selection
- Column renaming
- Include/exclude columns from import
- Sample data preview (first 3 values)

**Supported Column Types:**
- TEXT - Plain text
- URL - Website links
- EMAIL - Email addresses
- PHONE - Phone numbers
- NUMBER - Numeric values
- DATE - Date values
- SELECT - Single select dropdown
- MULTI_SELECT - Multiple selection
- PERSON - Person names
- COMPANY - Company names
- ADDRESS - Physical addresses
- STATUS - Status values
- AI_GENERATED - AI-generated content

**Auto-Detection Logic:**
```typescript
// Example: Email detection
if (
  headerLower.includes("email") ||
  sampleValues.some((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
) {
  return ColumnType.EMAIL;
}
```

### 4. Import Preview Component

**Location:** `src/components/import/import-preview.tsx`

**Features:**
- Shows first 10 rows of data
- Displays total row count
- Shows column count
- Interactive table with horizontal scrolling
- Highlights mapped column types with badges
- Empty cell indicators

### 5. Multi-Step Import Page

**Location:** `src/app/(dashboard)/import/page.tsx`

**Step 1: Upload**
- Drag & drop or click to select CSV file
- File validation and size display
- Auto-generate table name from filename

**Step 2: Column Mapping**
- Review auto-detected column types
- Customize column names and types
- Include/exclude columns
- View sample data for each column
- Preview table with mapped columns

**Step 3: Configure**
- Select existing project or create new one
- Enter table name
- Review import summary
- Validation before import

**Step 4: Importing**
- Loading spinner
- Progress bar (10% → 50% → 100%)
- Non-blocking UI

**Step 5: Complete**
- Success/failure message
- Import statistics (rows imported)
- "View Table" button (navigates to table)
- "Import Another File" button

## Data Processing

### Type Conversion

The import confirmation endpoint converts CSV string values to appropriate types:

```typescript
switch (columnType) {
  case ColumnType.NUMBER:
    const num = parseFloat(value);
    processedValue = isNaN(num) ? null : num;
    break;

  case ColumnType.DATE:
    const date = new Date(value);
    processedValue = isNaN(date.getTime()) ? null : date.toISOString();
    break;

  case ColumnType.SELECT:
  case ColumnType.MULTI_SELECT:
    processedValue = value.split(",").map((v) => v.trim());
    break;

  default:
    processedValue = value.trim();
    break;
}
```

### Batch Processing

Large imports are processed in batches of 100 rows to prevent memory issues and transaction timeouts:

```typescript
const BATCH_SIZE = 100;

for (let i = 0; i < totalRows; i += BATCH_SIZE) {
  const batch = config.rows.slice(i, i + BATCH_SIZE);
  // Process batch...
}
```

## Error Handling

### File Validation Errors
- Invalid file type → "Invalid file type. Only CSV files are allowed."
- File too large → "File size exceeds 10MB limit"
- Empty file → "CSV file contains no valid data rows"
- No headers → "CSV file contains empty column headers"

### Parsing Errors
- Encoding issues → Automatic fallback to ISO-8859-1
- Parse failures → "Failed to parse CSV file. Please check the file encoding."

### Import Errors
- No columns selected → "At least one column must be included"
- Missing project → "Either projectId or projectName must be provided"
- Missing table name → "Please enter a table name"
- Database errors → Transaction rollback with error message

## Security

### Authentication
- All API routes check for authenticated session
- User ID validated before database operations

### Authorization
- Project ownership verified before import
- Users can only import to their own projects

### Input Validation
- Zod schemas for request validation
- File type and size restrictions
- SQL injection prevention via Prisma ORM

## Performance Optimizations

1. **Batch Inserts:** 100 rows per batch to balance memory and performance
2. **Transaction Usage:** Single transaction for table + columns + rows
3. **Preview Limiting:** Only first 10 rows sent to frontend
4. **Encoding Detection:** Automatic fallback prevents re-upload

## Usage Example

### 1. Prepare CSV File

```csv
name,email,phone,website,company
John Doe,john@example.com,555-1234,https://example.com,Acme Inc
Jane Smith,jane@example.com,555-5678,https://example.org,Tech Corp
```

### 2. Upload File
- Navigate to `/import`
- Drag & drop or select CSV file
- Click "Parse & Continue"

### 3. Map Columns
- Review auto-detected types:
  - name → PERSON
  - email → EMAIL
  - phone → PHONE
  - website → URL
  - company → COMPANY
- Customize if needed
- Click "Continue"

### 4. Configure
- Select project: "My Leads"
- Enter table name: "January Leads"
- Review summary
- Click "Start Import"

### 5. View Results
- See success message with row count
- Click "View Table" to see imported data

## Dependencies

### NPM Packages
```json
{
  "papaparse": "^5.5.3",
  "@types/papaparse": "^5.5.1",
  "@radix-ui/react-select": "^2.2.6",
  "@radix-ui/react-progress": "^1.1.8",
  "@radix-ui/react-scroll-area": "^1.2.10",
  "react-dropzone": "^14.3.8",
  "sonner": "^2.0.7",
  "zod": "^4.1.13"
}
```

### Already Installed
- Next.js 14+ with App Router
- TypeScript
- Tailwind CSS
- Prisma with PostgreSQL
- shadcn/ui components
- NextAuth.js

## Database Schema

The import feature uses these Prisma models:

```prisma
model Project {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?
  tables      Table[]
}

model Table {
  id          String   @id @default(cuid())
  projectId   String
  name        String
  description String?
  columns     Column[]
  rows        Row[]
}

model Column {
  id        String     @id @default(cuid())
  tableId   String
  name      String
  type      ColumnType
  position  Int
  width     Int        @default(200)
  cells     Cell[]
}

model Row {
  id       String @id @default(cuid())
  tableId  String
  position Int
  cells    Cell[]
}

model Cell {
  id       String @id @default(cuid())
  rowId    String
  columnId String
  value    Json   @default("null")
  metadata Json   @default("{}")
}
```

## Future Enhancements

### Potential Improvements
1. **Streaming Upload:** Handle files larger than 10MB
2. **Background Processing:** Queue large imports with job status
3. **Data Validation:** Custom validation rules per column
4. **Duplicate Detection:** Identify and merge duplicate rows
5. **Column Templates:** Save and reuse column mappings
6. **Import History:** Track previous imports with rollback
7. **Excel Support:** Add .xlsx file parsing
8. **Preview Export:** Download modified data before import
9. **Scheduled Imports:** Recurring imports from URL/FTP

## Troubleshooting

### Common Issues

**Issue:** CSV parsing fails with encoding error
- **Solution:** File is saved with special characters. Try re-saving as UTF-8 or let the system auto-detect ISO-8859-1.

**Issue:** Import gets stuck at 50%
- **Solution:** Check database connection. Transaction may have timed out on large datasets.

**Issue:** Column types detected incorrectly
- **Solution:** Manually select correct type in Column Mapping step. Auto-detection is based on sample data.

**Issue:** "Failed to load projects" error
- **Solution:** Check authentication. Session may have expired. Refresh and try again.

## API Testing

### Test CSV Upload
```bash
curl -X POST http://localhost:3000/api/import \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -F "file=@sample.csv"
```

### Test Import Confirmation
```bash
curl -X POST http://localhost:3000/api/import/confirm \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "projectName": "Test Project",
    "tableName": "Test Table",
    "columnMappings": [...],
    "rows": [...]
  }'
```

## Conclusion

The CSV Import feature provides a complete, production-ready solution for importing CSV data into LeadTool CRM. It includes intelligent type detection, user-friendly mapping interface, robust error handling, and efficient batch processing.
