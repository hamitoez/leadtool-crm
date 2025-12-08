"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Globe,
  UtensilsCrossed,
  Store,
  Settings,
  Check,
  Sparkles,
} from "lucide-react";
import { TABLE_TEMPLATES, TableTemplate } from "@/lib/import/templates";

interface TemplateSelectorProps {
  selectedTemplate: string | null;
  onSelectTemplate: (templateId: string) => void;
}

const ICONS: Record<string, typeof Globe> = {
  Globe,
  UtensilsCrossed,
  Store,
  Settings,
};

export function TemplateSelector({
  selectedTemplate,
  onSelectTemplate,
}: TemplateSelectorProps) {
  // Gruppiere Templates nach Kategorie
  const categories = Array.from(
    new Set(TABLE_TEMPLATES.map((t) => t.category))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vorlage auswählen</CardTitle>
        <CardDescription>
          Wähle eine Vorlage für deine Leads. Die Spalten werden automatisch
          aus der CSV-Datei gemappt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {category}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {TABLE_TEMPLATES.filter((t) => t.category === category).map(
                  (template) => {
                    const Icon = ICONS[template.icon] || Settings;
                    const isSelected = selectedTemplate === template.id;

                    return (
                      <div
                        key={template.id}
                        onClick={() => onSelectTemplate(template.id)}
                        className={cn(
                          "relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:border-primary/50",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:bg-muted/50"
                        )}
                      >
                        {isSelected && (
                          <div className="absolute right-3 top-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                              <Check className="h-4 w-4 text-primary-foreground" />
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-4">
                          <div
                            className={cn(
                              "flex h-12 w-12 items-center justify-center rounded-lg",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <Icon className="h-6 w-6" />
                          </div>

                          <div className="flex-1 space-y-1">
                            <h4 className="font-semibold">{template.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {template.description}
                            </p>

                            {template.columns.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-2">
                                {template.columns.slice(0, 5).map((col) => (
                                  <Badge
                                    key={col.name}
                                    variant="outline"
                                    className={cn(
                                      "text-xs",
                                      col.aiGenerated &&
                                        "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-300"
                                    )}
                                  >
                                    {col.aiGenerated && (
                                      <Sparkles className="mr-1 h-3 w-3" />
                                    )}
                                    {col.name}
                                  </Badge>
                                ))}
                                {template.columns.length > 5 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{template.columns.length - 5} mehr
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Zeigt Details einer ausgewählten Vorlage
 */
export function TemplateDetails({ template }: { template: TableTemplate }) {
  if (!template || template.columns.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Spalten in dieser Vorlage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {template.columns.map((col) => (
            <div
              key={col.name}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{col.name}</span>
                    {col.aiGenerated && (
                      <Badge
                        variant="secondary"
                        className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300"
                      >
                        <Sparkles className="mr-1 h-3 w-3" />
                        KI
                      </Badge>
                    )}
                    {!col.autoFill && !col.aiGenerated && (
                      <Badge variant="outline" className="text-xs">
                        Manuell
                      </Badge>
                    )}
                  </div>
                  {col.description && (
                    <p className="text-xs text-muted-foreground">
                      {col.description}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="text-xs">
                {col.type.replace("_", " ")}
              </Badge>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-muted p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-violet-500 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <strong>KI-Spalten</strong> werden automatisch generiert.{" "}
              <strong>Manuelle Spalten</strong> bleiben leer und können später
              befüllt werden.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
