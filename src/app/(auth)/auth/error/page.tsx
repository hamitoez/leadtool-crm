"use client";

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
import { AlertCircle, ArrowLeft } from "lucide-react";

const errorMessages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: "Konfigurationsfehler",
    description: "Es gibt ein Problem mit der Server-Konfiguration. Bitte kontaktiere den Support.",
  },
  AccessDenied: {
    title: "Zugriff verweigert",
    description: "Du hast den Zugriff auf dein Konto verweigert.",
  },
  Verification: {
    title: "Verifizierungsfehler",
    description: "Der Verifizierungslink ist abgelaufen oder wurde bereits verwendet.",
  },
  OAuthSignin: {
    title: "OAuth-Fehler",
    description: "Beim Anmelden mit dem externen Dienst ist ein Fehler aufgetreten.",
  },
  OAuthCallback: {
    title: "OAuth-Callback-Fehler",
    description: "Bei der Verarbeitung der Anmeldung ist ein Fehler aufgetreten.",
  },
  OAuthCreateAccount: {
    title: "Konto konnte nicht erstellt werden",
    description: "Es konnte kein Konto mit den OAuth-Daten erstellt werden.",
  },
  EmailCreateAccount: {
    title: "Konto konnte nicht erstellt werden",
    description: "Es konnte kein Konto mit dieser E-Mail-Adresse erstellt werden.",
  },
  Callback: {
    title: "Callback-Fehler",
    description: "Bei der Verarbeitung der Anfrage ist ein Fehler aufgetreten.",
  },
  OAuthAccountNotLinked: {
    title: "Konto nicht verknüpft",
    description: "Diese E-Mail-Adresse ist bereits mit einem anderen Anmeldeverfahren verknüpft. Bitte melde dich mit der ursprünglichen Methode an.",
  },
  EmailSignin: {
    title: "E-Mail-Anmeldung fehlgeschlagen",
    description: "Die E-Mail konnte nicht gesendet werden.",
  },
  CredentialsSignin: {
    title: "Anmeldung fehlgeschlagen",
    description: "Die eingegebenen Anmeldedaten sind ungültig.",
  },
  SessionRequired: {
    title: "Anmeldung erforderlich",
    description: "Du musst angemeldet sein, um auf diese Seite zuzugreifen.",
  },
  Default: {
    title: "Authentifizierungsfehler",
    description: "Bei der Authentifizierung ist ein Fehler aufgetreten.",
  },
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Default";

  const errorInfo = errorMessages[error] || errorMessages.Default;

  return (
    <Card className="max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-red-100 p-4 dark:bg-red-900">
            <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
        </div>
        <CardTitle className="text-2xl">{errorInfo.title}</CardTitle>
        <CardDescription>{errorInfo.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        {error === "OAuthAccountNotLinked" && (
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>
              <strong>Tipp:</strong> Wenn du dich zuvor mit E-Mail und Passwort registriert hast,
              versuche dich mit diesen Daten anzumelden. Du kannst danach in den Einstellungen
              deinen Google- oder GitHub-Account verknüpfen.
            </p>
          </div>
        )}

        {error === "Configuration" && (
          <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>
              Bitte stelle sicher, dass die OAuth-Provider richtig konfiguriert sind.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <Button asChild className="w-full">
          <Link href="/login">Zurück zur Anmeldung</Link>
        </Button>
        <Link
          href="/"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Zur Startseite
        </Link>
      </CardFooter>
    </Card>
  );
}
