"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface InviteDetails {
  email: string;
  role: string;
  message?: string;
  organization: {
    id: string;
    name: string;
    description?: string;
    logo?: string;
    memberCount: number;
  };
  expiresAt: string;
}

const roleLabels: Record<string, string> = {
  OWNER: "Eigentümer",
  ADMIN: "Administrator",
  MANAGER: "Manager",
  MEMBER: "Mitglied",
};

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const { data: session, status: sessionStatus } = useSession();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await fetch(`/api/organizations/invite?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Einladung nicht gefunden");
        } else {
          setInvite(data);
        }
      } catch {
        setError("Fehler beim Laden der Einladung");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchInvite();
    }
  }, [token]);

  const handleAccept = async () => {
    if (!session) {
      // Redirect to login with return URL
      router.push(`/login?callbackUrl=/invite/${token}`);
      return;
    }

    setAccepting(true);
    try {
      const res = await fetch("/api/organizations/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.ok) {
        setAccepted(true);
        toast.success(`Willkommen bei ${invite?.organization.name}!`);
        setTimeout(() => {
          router.push("/team");
        }, 2000);
      } else {
        setError(data.error || "Fehler beim Annehmen der Einladung");
      }
    } catch {
      setError("Fehler beim Annehmen der Einladung");
    } finally {
      setAccepting(false);
    }
  };

  if (loading || sessionStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Einladung ungültig</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button variant="outline" onClick={() => router.push("/")}>
              Zur Startseite
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>Willkommen im Team!</CardTitle>
            <CardDescription>
              Du bist jetzt Mitglied von {invite?.organization.name}.
              Du wirst gleich weitergeleitet...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Team-Einladung</CardTitle>
          <CardDescription>
            Du wurdest eingeladen, einem Team beizutreten
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Organization Info */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">{invite?.organization.name}</h3>
            {invite?.organization.description && (
              <p className="text-sm text-muted-foreground">
                {invite.organization.description}
              </p>
            )}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{invite?.organization.memberCount} Mitglieder</span>
            </div>
          </div>

          {/* Role Badge */}
          <div className="flex justify-center">
            <Badge variant="secondary" className="text-sm">
              Du wirst als <strong className="mx-1">{roleLabels[invite?.role || "MEMBER"]}</strong> beitreten
            </Badge>
          </div>

          {/* Personal Message */}
          {invite?.message && (
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm italic">"{invite.message}"</p>
            </div>
          )}

          {/* Login Warning */}
          {!session && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4 text-sm">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Anmeldung erforderlich
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  Du musst dich anmelden oder registrieren, um die Einladung anzunehmen.
                </p>
              </div>
            </div>
          )}

          {/* Email Mismatch Warning */}
          {session && invite && session.user?.email?.toLowerCase() !== invite.email.toLowerCase() && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 text-sm">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">
                  Andere E-Mail-Adresse
                </p>
                <p className="text-blue-700 dark:text-blue-300">
                  Die Einladung wurde an <strong>{invite.email}</strong> gesendet.
                  Du bist als <strong>{session.user?.email}</strong> angemeldet.
                  Du kannst die Einladung trotzdem annehmen.
                </p>
              </div>
            </div>
          )}

          {/* Expiry Notice */}
          <p className="text-xs text-center text-muted-foreground">
            Diese Einladung läuft am{" "}
            {new Date(invite?.expiresAt || "").toLocaleDateString("de-DE", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            ab.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button
            className="w-full"
            size="lg"
            onClick={handleAccept}
            disabled={accepting}
          >
            {accepting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {session ? "Einladung annehmen" : "Anmelden & Annehmen"}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => router.push("/")}
          >
            Abbrechen
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
