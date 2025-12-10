import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Rocket,
  ArrowRight,
  CheckCircle,
  Globe,
  Brain,
  Table2,
  Upload,
  Zap,
  Shield,
  Users,
  TrendingUp,
  Star
} from "lucide-react";

export default async function HomePage() {
  const session = await auth();

  if (session) {
    redirect("/dashboard");
  }

  const features = [
    {
      icon: Upload,
      title: "CSV & Excel Import",
      description: "Importieren Sie Ihre Google Maps Scraping-Daten mit einem Klick. Automatische Spaltenerkennung inklusive."
    },
    {
      icon: Globe,
      title: "Automatisches Web-Scraping",
      description: "Extrahieren Sie automatisch Kontaktdaten, E-Mails und Telefonnummern von Firmenwebsites."
    },
    {
      icon: Brain,
      title: "KI-gestützte Extraktion",
      description: "Unsere KI erkennt Ansprechpartner, Positionen und relevante Kontaktinformationen aus Impressum-Seiten."
    },
    {
      icon: Table2,
      title: "Professionelle Tabellenansicht",
      description: "Flexible Spalten, Filter, Sortierung und Ansichten - alles was Sie für effizientes Lead-Management brauchen."
    },
    {
      icon: Zap,
      title: "Bulk-Verarbeitung",
      description: "Verarbeiten Sie hunderte Leads gleichzeitig. Paralleles Scraping für maximale Effizienz."
    },
    {
      icon: Shield,
      title: "DSGVO-konform",
      description: "Ihre Daten bleiben sicher. Verschlüsselte Speicherung und keine Weitergabe an Dritte."
    }
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "49",
      description: "Perfekt für Einzelunternehmer und Freelancer",
      features: [
        "500 Leads pro Monat",
        "1 Benutzer",
        "CSV & Excel Import",
        "Web-Scraping (100 URLs/Tag)",
        "E-Mail Support",
        "Basis-Exporte"
      ],
      cta: "Jetzt starten",
      popular: false
    },
    {
      name: "Professional",
      price: "99",
      description: "Für wachsende Vertriebsteams",
      features: [
        "5.000 Leads pro Monat",
        "5 Benutzer",
        "Alles aus Starter",
        "Web-Scraping (500 URLs/Tag)",
        "KI-Kompliment-Generator",
        "Prioritäts-Support",
        "Erweiterte Exporte",
        "API-Zugang"
      ],
      cta: "Kostenlos testen",
      popular: true
    },
    {
      name: "Enterprise",
      price: "249",
      description: "Für große Vertriebsorganisationen",
      features: [
        "Unbegrenzte Leads",
        "20 Benutzer",
        "Alles aus Professional",
        "Unbegrenztes Scraping",
        "Eigener API-Key Support",
        "Dedizierter Account Manager",
        "Custom Integrationen",
        "SLA-Garantie"
      ],
      cta: "Kontakt aufnehmen",
      popular: false
    }
  ];

  const stats = [
    { value: "50.000+", label: "Extrahierte Leads" },
    { value: "98%", label: "Erfolgsrate" },
    { value: "500+", label: "Zufriedene Kunden" },
    { value: "< 2 Sek", label: "Pro Website" }
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold">LeadPilot</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Preise
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Anmelden</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Kostenlos testen</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
          <div className="container relative mx-auto px-4 py-24 lg:py-32">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-6 inline-flex items-center rounded-full border bg-muted px-4 py-1.5 text-sm">
                <Star className="mr-2 h-4 w-4 text-yellow-500" />
                <span>Über 500 Unternehmen vertrauen uns</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Verwandeln Sie Websites in
                <span className="block text-primary mt-2">qualifizierte Leads</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
                LeadPilot extrahiert automatisch Kontaktdaten von Firmenwebsites.
                Importieren Sie Ihre Google Maps Daten und erhalten Sie sofort
                E-Mails, Telefonnummern und Ansprechpartner.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" className="w-full sm:w-auto text-base px-8" asChild>
                  <Link href="/register">
                    14 Tage kostenlos testen
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8" asChild>
                  <Link href="#features">Mehr erfahren</Link>
                </Button>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Keine Kreditkarte erforderlich • Sofort loslegen
              </p>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="border-y bg-muted/30">
          <div className="container mx-auto px-4 py-12">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl font-bold text-primary">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="scroll-mt-16">
          <div className="container mx-auto px-4 py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Alles was Sie für erfolgreiche Lead-Generierung brauchen
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                LeadPilot kombiniert leistungsstarkes Web-Scraping mit intelligenter KI-Extraktion
              </p>
            </div>
            <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group relative rounded-2xl border bg-card p-6 transition-all hover:shadow-lg hover:border-primary/50"
                >
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="border-y bg-muted/30">
          <div className="container mx-auto px-4 py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                So einfach funktioniert&apos;s
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                In nur 3 Schritten zu qualifizierten Kontaktdaten
              </p>
            </div>
            <div className="mx-auto mt-16 grid max-w-4xl gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  1
                </div>
                <h3 className="text-lg font-semibold">Daten importieren</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Laden Sie Ihre CSV oder Excel-Datei mit Firmen-URLs hoch
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  2
                </div>
                <h3 className="text-lg font-semibold">Automatisch extrahieren</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  LeadPilot scrapt die Websites und findet alle Kontaktdaten
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  3
                </div>
                <h3 className="text-lg font-semibold">Leads exportieren</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Exportieren Sie Ihre angereicherten Daten als CSV oder Excel
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="scroll-mt-16">
          <div className="container mx-auto px-4 py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Transparente Preise für jede Teamgröße
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Starten Sie kostenlos und skalieren Sie nach Bedarf
              </p>
            </div>
            <div className="mx-auto mt-16 grid max-w-5xl gap-8 lg:grid-cols-3">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-2xl border p-8 ${
                    plan.popular
                      ? "border-primary bg-primary/5 shadow-lg scale-105"
                      : "bg-card"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-sm font-medium text-primary-foreground">
                      Beliebteste Wahl
                    </div>
                  )}
                  <div className="text-center">
                    <h3 className="text-xl font-semibold">{plan.name}</h3>
                    <div className="mt-4 flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold">€{plan.price}</span>
                      <span className="text-muted-foreground">/Monat</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                  </div>
                  <ul className="mt-8 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-8 w-full"
                    variant={plan.popular ? "default" : "outline"}
                    asChild
                  >
                    <Link href="/register">{plan.cta}</Link>
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Alle Preise zzgl. MwSt. • Monatlich kündbar • 14 Tage Geld-zurück-Garantie
            </p>
          </div>
        </section>

        {/* Trust Section */}
        <section className="border-t bg-muted/30">
          <div className="container mx-auto px-4 py-24">
            <div className="mx-auto max-w-3xl text-center">
              <Users className="mx-auto h-12 w-12 text-primary" />
              <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
                Vertrauen von Vertriebsteams in ganz Deutschland
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Von Startups bis zu etablierten Unternehmen – LeadPilot hilft Vertriebsteams,
                effizienter zu arbeiten und mehr Abschlüsse zu erzielen.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" className="w-full sm:w-auto" asChild>
                  <Link href="/register">
                    Jetzt kostenlos starten
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t">
          <div className="container mx-auto px-4 py-24">
            <div className="mx-auto max-w-4xl rounded-2xl bg-primary p-8 text-center text-primary-foreground sm:p-12">
              <TrendingUp className="mx-auto h-12 w-12" />
              <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
                Bereit, Ihre Lead-Generierung zu revolutionieren?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
                Starten Sie noch heute mit LeadPilot und verwandeln Sie Ihre Website-Listen
                in wertvolle Kontaktdaten. Keine Kreditkarte erforderlich.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto text-base px-8" asChild>
                  <Link href="/register">
                    14 Tage kostenlos testen
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <Rocket className="h-6 w-6 text-primary" />
                <span className="text-lg font-bold">LeadPilot</span>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Automatisierte Lead-Generierung für moderne Vertriebsteams.
              </p>
            </div>
            <div>
              <h4 className="font-semibold">Produkt</h4>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Preise</a></li>
                <li><Link href="/login" className="hover:text-foreground">Anmelden</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold">Rechtliches</h4>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Impressum</a></li>
                <li><a href="#" className="hover:text-foreground">Datenschutz</a></li>
                <li><a href="#" className="hover:text-foreground">AGB</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold">Kontakt</h4>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li>support@leadpilot.de</li>
                <li>Mo-Fr 9:00-18:00 Uhr</li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} LeadPilot. Alle Rechte vorbehalten.
          </div>
        </div>
      </footer>
    </div>
  );
}
