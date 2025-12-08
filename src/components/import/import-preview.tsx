import { ColumnMapping } from "@/types/import";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportPreviewProps {
  headers: string[];
  previewRows: string[][];
  totalRows: number;
  mappings: ColumnMapping[];
}

export function ImportPreview({
  headers,
  previewRows,
  totalRows,
  mappings,
}: ImportPreviewProps) {
  const includedMappings = mappings.filter((m) => m.include);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Preview</CardTitle>
        <CardDescription>
          Showing {Math.min(previewRows.length, 10)} of {totalRows} rows
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
            <div className="flex-1">
              <div className="text-sm font-medium">Total Rows</div>
              <div className="text-2xl font-bold">{totalRows}</div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Columns</div>
              <div className="text-2xl font-bold">{includedMappings.length}</div>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Preview Rows</div>
              <div className="text-2xl font-bold">
                {Math.min(previewRows.length, 10)}
              </div>
            </div>
          </div>

          <ScrollArea className="h-[400px] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 sticky left-0 bg-background">
                    #
                  </TableHead>
                  {includedMappings.map((mapping) => (
                    <TableHead key={mapping.csvColumn} className="min-w-[150px]">
                      <div className="space-y-1">
                        <div className="font-semibold">{mapping.columnName}</div>
                        <Badge variant="secondary" className="text-xs">
                          {mapping.columnType}
                        </Badge>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.slice(0, 10).map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    <TableCell className="sticky left-0 bg-background font-medium">
                      {rowIndex + 1}
                    </TableCell>
                    {includedMappings.map((mapping) => {
                      const columnIndex = headers.indexOf(mapping.csvColumn);
                      const value = row[columnIndex] || "";

                      return (
                        <TableCell key={mapping.csvColumn} className="max-w-[300px]">
                          <div className="truncate" title={value}>
                            {value || (
                              <span className="text-muted-foreground italic">
                                Empty
                              </span>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>

          {totalRows > 10 && (
            <div className="text-center text-sm text-muted-foreground">
              + {totalRows - 10} more rows will be imported
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
