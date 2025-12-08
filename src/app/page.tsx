import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table2, ArrowRight, CheckCircle } from "lucide-react";

export default async function HomePage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  const features = [
    "CSV-Import von Google-Maps-Scraping-Daten",
    "Automatische Kontaktdaten-Extraktion",
    "Notion-ähnliche Tabellenoberfläche",
    "KI-gestützte Datenverarbeitung",
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Table2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">LeadTool</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Notion-ähnliches CRM
            <br />
            <span className="text-primary">mit automatisierter Extraktion</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Importieren Sie Ihre Google-Maps-Daten und lassen Sie automatisch
            Kontaktdaten von Firmenwebsites extrahieren. KI-gestützt und
            effizient.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/register">
                Jetzt starten
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Anmelden</Link>
            </Button>
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="container mx-auto px-4 py-24">
            <h2 className="text-center text-3xl font-bold">Features</h2>
            <div className="mx-auto mt-12 grid max-w-3xl gap-6">
              {features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-4 rounded-lg border bg-card p-4"
                >
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} LeadTool. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
