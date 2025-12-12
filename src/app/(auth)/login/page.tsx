"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table2, Loader2, CheckCircle2, AlertCircle, Mail, Shield, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { GoogleIcon, GitHubIcon } from "@/components/ui/icons";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [isResending, setIsResending] = useState(false);

  // 2FA State
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorUserId, setTwoFactorUserId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [storedCredentials, setStoredCredentials] = useState<LoginInput | null>(null);

  const verified = searchParams.get("verified");
  const error = searchParams.get("error");

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (verified === "true") {
      toast.success("E-Mail-Adresse erfolgreich bestätigt! Du kannst dich jetzt anmelden.");
    } else if (verified === "already") {
      toast.info("Deine E-Mail-Adresse ist bereits bestätigt.");
    }

    if (error === "verification_failed") {
      const message = searchParams.get("message");
      toast.error(message || "E-Mail-Verifizierung fehlgeschlagen.");
    }
  }, [verified, error, searchParams]);

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    setShowResendVerification(false);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        // Check if 2FA is required
        if (result.error.startsWith("2FA_REQUIRED:")) {
          const userId = result.error.split(":")[1];
          setTwoFactorUserId(userId);
          setRequires2FA(true);
          setStoredCredentials(data);
          return;
        }

        if (result.error === "EMAIL_NOT_VERIFIED") {
          setResendEmail(data.email);
          setShowResendVerification(true);
          toast.error("Bitte bestätige zuerst deine E-Mail-Adresse.");
          return;
        }

        if (result.error.includes("Too many login attempts")) {
          toast.error(result.error);
          return;
        }

        toast.error("Ungültige E-Mail-Adresse oder Passwort");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTwoFactorSubmit() {
    if (!storedCredentials || !totpCode) return;

    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: storedCredentials.email,
        password: storedCredentials.password,
        totpCode: totpCode.replace(/-/g, ""),
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "Invalid 2FA code") {
          toast.error("Ungültiger Code. Bitte versuche es erneut.");
          return;
        }
        toast.error(result.error);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Ein Fehler ist aufgetreten.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!resendEmail) return;

    setIsResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Fehler beim Senden der E-Mail");
        return;
      }

      if (data.alreadyVerified) {
        toast.success("Deine E-Mail ist bereits bestätigt. Du kannst dich anmelden.");
        setShowResendVerification(false);
      } else {
        toast.success("Bestätigungs-E-Mail wurde gesendet!");
      }
    } catch {
      toast.error("Ein Fehler ist aufgetreten.");
    } finally {
      setIsResending(false);
    }
  }

  function resetTwoFactor() {
    setRequires2FA(false);
    setTwoFactorUserId(null);
    setTotpCode("");
    setStoredCredentials(null);
  }

  // 2FA Code Entry Screen
  if (requires2FA) {
    return (
      <Card>
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Shield className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Zwei-Faktor-Authentifizierung</CardTitle>
          <CardDescription>
            Gib den Code aus deiner Authenticator-App ein
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9A-Za-z-]/g, "").slice(0, 10))}
              maxLength={10}
              className="text-center text-2xl tracking-widest"
              autoFocus
            />
            <p className="text-xs text-center text-muted-foreground">
              6-stelliger Code oder Backup-Code (z.B. XXXX-XXXX)
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleTwoFactorSubmit}
            disabled={totpCode.length < 6 || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verifizieren
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button variant="ghost" onClick={resetTwoFactor} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Anmeldung
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center">
          <Table2 className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="text-2xl">Willkommen zurück</CardTitle>
        <CardDescription>
          Melde dich mit deinen Zugangsdaten an
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {verified === "true" && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-300">
              E-Mail-Adresse erfolgreich bestätigt! Du kannst dich jetzt anmelden.
            </AlertDescription>
          </Alert>
        )}

        {showResendVerification && (
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              <div className="space-y-2">
                <p>Deine E-Mail-Adresse wurde noch nicht bestätigt.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResendVerification}
                  disabled={isResending}
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
                      Bestätigungs-E-Mail erneut senden
                    </>
                  )}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Passwort</FormLabel>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-muted-foreground hover:text-primary hover:underline"
                    >
                      Passwort vergessen?
                    </Link>
                  </div>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Anmelden
            </Button>
          </form>
        </Form>

        {/* OAuth Buttons - Aktivieren wenn GOOGLE_CLIENT_ID und GITHUB_CLIENT_ID gesetzt sind */}
        {/*
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Oder fortfahren mit
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            type="button"
            disabled={isLoading}
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          >
            <GoogleIcon className="mr-2 h-4 w-4" />
            Google
          </Button>
          <Button
            variant="outline"
            type="button"
            disabled={isLoading}
            onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
          >
            <GitHubIcon className="mr-2 h-4 w-4" />
            GitHub
          </Button>
        </div>
        */}
      </CardContent>
      <CardFooter className="flex flex-col space-y-2">
        <p className="text-center text-sm text-muted-foreground">
          Noch kein Konto?{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:underline"
          >
            Registrieren
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
