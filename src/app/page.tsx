import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap, ArrowRight, CheckCircle, BarChart3, Users, Globe } from "lucide-react";

export default async function HomePage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  const features = [
    {
      icon: Globe,
      title: "Automatische Web-Extraktion",
      description: "Extrahieren Sie Kontaktdaten direkt von Firmenwebsites"
    },
    {
      icon: Users,
      title: "Lead-Management",
      description: "Verwalten Sie Ihre Leads in einer intuitiven Oberfläche"
    },
    {
      icon: BarChart3,
      title: "KI-gestützte Analyse",
      description: "Intelligente Datenverarbeitung und Anreicherung"
    },
    {
      icon: Zap,
      title: "Schneller Import",
      description: "CSV-Import von Google Maps und anderen Quellen"
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Performanty</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Anmelden</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Kostenlos starten</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            Lead-Generierung neu gedacht
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Verwandeln Sie Daten
            <br />
            <span className="text-primary">in qualifizierte Leads</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Performanty automatisiert Ihre Lead-Generierung. Importieren Sie Firmendaten,
            extrahieren Sie Kontaktinformationen und erreichen Sie Ihre Zielkunden schneller.
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
            <h2 className="text-center text-3xl font-bold">
              Alles was Sie brauchen
            </h2>
            <p className="text-center text-muted-foreground mt-4 max-w-2xl mx-auto">
              Eine Plattform für Ihre komplette Lead-Generierung
            </p>
            <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-start gap-4 rounded-lg border bg-card p-6"
                >
                  <div className="rounded-lg bg-primary/10 p-2">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t">
          <div className="container mx-auto px-4 py-24 text-center">
            <h2 className="text-3xl font-bold">Bereit durchzustarten?</h2>
            <p className="text-muted-foreground mt-4">
              Starten Sie noch heute mit Performanty
            </p>
            <Button size="lg" className="mt-8" asChild>
              <Link href="/register">
                Kostenlosen Account erstellen
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Performanty. Alle Rechte vorbehalten.
            </p>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/impressum" className="hover:text-foreground transition-colors">
                Impressum
              </Link>
              <Link href="/datenschutz" className="hover:text-foreground transition-colors">
                Datenschutz
              </Link>
              <Link href="/agb" className="hover:text-foreground transition-colors">
                AGB
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
