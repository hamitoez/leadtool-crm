"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnType } from "@prisma/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Type,
  Link,
  Mail,
  Phone,
  Hash,
  Calendar,
  List,
  Tags,
  User,
  Building2,
  MapPin,
  Gauge,
  CircleDot,
  Sparkles,
  Loader2,
} from "lucide-react";

interface AddColumnDialogProps {
  tableId: string;
  children: React.ReactNode;
  onColumnAdded?: () => void;
}

const COLUMN_TYPES: {
  value: ColumnType;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    value: "TEXT",
    label: "Text",
    icon: <Type className="h-4 w-4" />,
    description: "Plain text content",
  },
  {
    value: "URL",
    label: "URL",
    icon: <Link className="h-4 w-4" />,
    description: "Web links",
  },
  {
    value: "EMAIL",
    label: "Email",
    icon: <Mail className="h-4 w-4" />,
    description: "Email addresses",
  },
  {
    value: "PHONE",
    label: "Phone",
    icon: <Phone className="h-4 w-4" />,
    description: "Phone numbers",
  },
  {
    value: "NUMBER",
    label: "Number",
    icon: <Hash className="h-4 w-4" />,
    description: "Numeric values",
  },
  {
    value: "DATE",
    label: "Date",
    icon: <Calendar className="h-4 w-4" />,
    description: "Dates and times",
  },
  {
    value: "SELECT",
    label: "Select",
    icon: <List className="h-4 w-4" />,
    description: "Single choice from options",
  },
  {
    value: "MULTI_SELECT",
    label: "Multi-Select",
    icon: <Tags className="h-4 w-4" />,
    description: "Multiple choices",
  },
  {
    value: "PERSON",
    label: "Person",
    icon: <User className="h-4 w-4" />,
    description: "Contact person name",
  },
  {
    value: "COMPANY",
    label: "Company",
    icon: <Building2 className="h-4 w-4" />,
    description: "Company name",
  },
  {
    value: "ADDRESS",
    label: "Address",
    icon: <MapPin className="h-4 w-4" />,
    description: "Physical address",
  },
  {
    value: "STATUS",
    label: "Status",
    icon: <CircleDot className="h-4 w-4" />,
    description: "Status indicator",
  },
  {
    value: "CONFIDENCE",
    label: "Confidence",
    icon: <Gauge className="h-4 w-4" />,
    description: "Confidence score (0-100%)",
  },
  {
    value: "AI_GENERATED",
    label: "AI Generated",
    icon: <Sparkles className="h-4 w-4" />,
    description: "AI-extracted content",
  },
];

export function AddColumnDialog({
  tableId,
  children,
  onColumnAdded,
}: AddColumnDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ColumnType>("TEXT");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a column name");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/tables/${tableId}/columns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          type,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create column");
      }

      toast.success("Column created successfully");
      setOpen(false);
      setName("");
      setType("TEXT");
      onColumnAdded?.();
      router.refresh();
    } catch (error) {
      console.error("Error creating column:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create column"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const selectedType = COLUMN_TYPES.find((t) => t.value === type);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Column</DialogTitle>
            <DialogDescription>
              Add a new column to your table. Choose a name and type for your column.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Column Name</Label>
              <Input
                id="name"
                placeholder="e.g., Email, Phone, Status..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Column Type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(value as ColumnType)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue>
                    {selectedType && (
                      <div className="flex items-center gap-2">
                        {selectedType.icon}
                        <span>{selectedType.label}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {COLUMN_TYPES.map((columnType) => (
                    <SelectItem key={columnType.value} value={columnType.value}>
                      <div className="flex items-center gap-2">
                        {columnType.icon}
                        <div className="flex flex-col">
                          <span>{columnType.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {columnType.description}
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedType && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-sm">
                  {selectedType.icon}
                  <span className="font-medium">{selectedType.label}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedType.description}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Column"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
