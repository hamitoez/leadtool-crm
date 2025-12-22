"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md w-full p-8 text-center">
            <div className="mb-6">
              <svg
                className="mx-auto h-16 w-16 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Etwas ist schief gelaufen
            </h1>
            <p className="text-muted-foreground mb-6">
              Ein unerwarteter Fehler ist aufgetreten. Unser Team wurde benachrichtigt
              und arbeitet an einer Lösung.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground mb-4">
                Fehler-ID: {error.digest}
              </p>
            )}
            <div className="space-y-3">
              <Button onClick={reset} className="w-full">
                Erneut versuchen
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = "/")}
                className="w-full"
              >
                Zur Startseite
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
