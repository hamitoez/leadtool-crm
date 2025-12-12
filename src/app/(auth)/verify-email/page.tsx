"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table2, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const [isResending, setIsResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    if (!email) {
      toast.error("Keine E-Mail-Adresse gefunden.");
      return;
    }

    setIsResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Fehler beim Senden der E-Mail");
        return;
      }

      setResent(true);
      toast.success("Bestätigungs-E-Mail wurde erneut gesendet!");
    } catch {
      toast.error("Ein Fehler ist aufgetreten.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-4">
            <Mail className="h-10 w-10 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl">E-Mail bestätigen</CardTitle>
        <CardDescription>
          Wir haben dir eine Bestätigungs-E-Mail gesendet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        {email && (
          <p className="text-sm text-muted-foreground">
            Eine E-Mail wurde an{" "}
            <span className="font-medium text-foreground">{email}</span>{" "}
            gesendet.
          </p>
        )}

        <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
          <p>
            Bitte öffne deine E-Mails und klicke auf den Bestätigungslink, um
            dein Konto zu aktivieren.
          </p>
          <p className="mt-2">
            Der Link ist <strong>24 Stunden</strong> gültig.
          </p>
        </div>

        {resent ? (
          <div className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span>E-Mail wurde erneut gesendet!</span>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Keine E-Mail erhalten?
            </p>
            <Button
              variant="outline"
              onClick={handleResend}
              disabled={isResending || !email}
              className="w-full"
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sende...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  E-Mail erneut senden
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-center text-sm text-muted-foreground">
          <p>Überprüfe auch deinen Spam-Ordner.</p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Table2 className="h-4 w-4 text-muted-foreground" />
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            Zurück zur Anmeldung
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
