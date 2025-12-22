import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Impressum | Performanty",
  description: "Impressum und rechtliche Angaben",
};

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurueck
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-8">Impressum</h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">Angaben gemaess Paragraph 5 TMG</h2>
            <p>
              Weboa Webdesign &amp; Marketing<br />
              Inhaber: Abdulhamit Oezdemir<br />
              Helene-Lange-Weg 13<br />
              75417 Muehlacker<br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Kontakt</h2>
            <p>
              Telefon: +49 173 9053339<br />
              E-Mail: info@weboa.de<br />
              Website: <a href="https://www.weboa.de" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://www.weboa.de</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Verantwortlich fuer den Inhalt nach Paragraph 55 Abs. 2 RStV</h2>
            <p>
              Abdulhamit Oezdemir<br />
              Helene-Lange-Weg 13<br />
              75417 Muehlacker
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Haftungsausschluss (Disclaimer)</h2>

            <h3 className="text-lg font-medium mt-6 mb-3">Haftung fuer Inhalte</h3>
            <p className="text-muted-foreground">
              Als Diensteanbieter sind wir gemaess Paragraph 7 Abs.1 TMG fuer eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach Paragraphen 8 bis 10 TMG sind wir jedoch nicht verpflichtet, uebermittelte oder gespeicherte fremde Informationen zu ueberwachen oder nach Umstaenden zu forschen, die auf eine rechtswidrige Taetigkeit hinweisen.
            </p>
            <p className="text-muted-foreground mt-3">
              Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberuehrt. Eine diesbezuegliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung moeglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">Haftung fuer Links</h3>
            <p className="text-muted-foreground">
              Unser Angebot enthaelt Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb koennen wir fuer diese fremden Inhalte auch keine Gewaehr uebernehmen. Fuer die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
            </p>
            <p className="text-muted-foreground mt-3">
              Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf moegliche Rechtsverstoesse ueberprueft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">Urheberrecht</h3>
            <p className="text-muted-foreground">
              Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfaeltigung, Bearbeitung, Verbreitung und jede Art der Verwertung ausserhalb der Grenzen des Urheberrechtes beduerfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            </p>
            <p className="text-muted-foreground mt-3">
              Downloads und Kopien dieser Seite sind nur fuer den privaten, nicht kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
            </p>
          </section>

          <section className="pt-8 border-t">
            <p className="text-sm text-muted-foreground">
              Stand: Dezember 2025
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
