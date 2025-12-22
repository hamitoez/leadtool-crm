import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "AGB | Performanty",
  description: "Allgemeine Geschaeftsbedingungen",
};

export default function AGBPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurueck
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-8">Allgemeine Geschaeftsbedingungen</h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Geltungsbereich</h2>
            <p className="text-muted-foreground">
              Diese Allgemeinen Geschaeftsbedingungen (AGB) gelten fuer alle Vertraege zwischen:
            </p>
            <p className="text-muted-foreground mt-3">
              Weboa Webdesign &amp; Marketing<br />
              Inhaber: Abdulhamit Oezdemir<br />
              Helene-Lange-Weg 13<br />
              75417 Muehlacker<br />
              Deutschland
            </p>
            <p className="text-muted-foreground mt-3">
              (nachfolgend &quot;Anbieter&quot; genannt)
            </p>
            <p className="text-muted-foreground mt-3">
              und seinen Kunden (nachfolgend &quot;Kunde&quot; genannt) bezueglich der Nutzung der Software Performanty und damit verbundener Dienstleistungen.
            </p>
            <p className="text-muted-foreground mt-3">
              Abweichende, entgegenstehende oder ergaenzende AGB des Kunden werden nur dann Vertragsbestandteil, wenn und soweit ihrer Geltung ausdruecklich schriftlich zugestimmt wurde.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Vertragsgegenstand</h2>
            <p className="text-muted-foreground">
              2.1. Der Anbieter stellt dem Kunden die webbasierte CRM-Software &quot;Performanty&quot; als Software-as-a-Service (SaaS) Loesung zur Verfuegung.
            </p>
            <p className="text-muted-foreground mt-3">
              2.2. Die Software umfasst insbesondere folgende Funktionen:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Kontakt- und Lead-Management</li>
              <li>Pipeline- und Deal-Verwaltung</li>
              <li>Aufgaben- und Aktivitaetenverwaltung</li>
              <li>Web-Scraping zur Lead-Generierung</li>
              <li>Datenimport und -export</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              2.3. Der genaue Funktionsumfang richtet sich nach dem jeweiligen Tarif und der aktuellen Produktbeschreibung.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Vertragsschluss und Registrierung</h2>
            <p className="text-muted-foreground">
              3.1. Die Darstellung der Software auf der Website stellt kein rechtlich bindendes Angebot, sondern eine Aufforderung zur Abgabe einer Bestellung dar.
            </p>
            <p className="text-muted-foreground mt-3">
              3.2. Mit der Registrierung gibt der Kunde ein verbindliches Angebot zum Abschluss eines Nutzungsvertrages ab. Der Vertrag kommt durch die Bestaetigung der Registrierung per E-Mail oder durch Freischaltung des Kundenkontos zustande.
            </p>
            <p className="text-muted-foreground mt-3">
              3.3. Der Kunde versichert, dass die bei der Registrierung angegebenen Daten wahrheitsgemaess und vollstaendig sind.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Nutzungsrechte</h2>
            <p className="text-muted-foreground">
              4.1. Der Anbieter raeumt dem Kunden fuer die Dauer des Vertrages das nicht-ausschliessliche, nicht uebertragbare Recht ein, die Software im Rahmen dieser AGB zu nutzen.
            </p>
            <p className="text-muted-foreground mt-3">
              4.2. Der Kunde darf die Software nur fuer eigene geschaeftliche Zwecke nutzen. Eine Unterlizenzierung oder Weitergabe an Dritte ist nicht gestattet.
            </p>
            <p className="text-muted-foreground mt-3">
              4.3. Der Kunde ist nicht berechtigt, die Software zu dekompilieren, zu disassemblieren, zurueckzuentwickeln oder abzuaendern.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Pflichten des Kunden</h2>
            <p className="text-muted-foreground">
              5.1. Der Kunde ist verpflichtet, seine Zugangsdaten geheim zu halten und vor dem Zugriff durch unbefugte Dritte zu schuetzen.
            </p>
            <p className="text-muted-foreground mt-3">
              5.2. Der Kunde traegt die Verantwortung fuer alle Aktivitaeten, die unter seinen Zugangsdaten erfolgen.
            </p>
            <p className="text-muted-foreground mt-3">
              5.3. Der Kunde verpflichtet sich, die Software nicht missbräuchlich zu nutzen, insbesondere:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>keine rechtswidrigen Inhalte zu speichern oder zu verbreiten</li>
              <li>keine Massenmails (Spam) zu versenden</li>
              <li>die Rechte Dritter nicht zu verletzen</li>
              <li>die Infrastruktur des Anbieters nicht zu ueberlasten</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              5.4. Der Kunde ist selbst dafuer verantwortlich, die geltenden Datenschutzvorschriften (insbesondere DSGVO) bei der Verarbeitung von Daten in der Software einzuhalten.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Verfuegbarkeit und Support</h2>
            <p className="text-muted-foreground">
              6.1. Der Anbieter bemuehlt sich um eine moeglichst hohe Verfuegbarkeit der Software. Eine Verfuegbarkeit von 100% ist technisch nicht realisierbar und wird daher nicht geschuldet.
            </p>
            <p className="text-muted-foreground mt-3">
              6.2. Wartungsarbeiten werden nach Moeglichkeit ausserhalb der ueblichen Geschaeftszeiten durchgefuehrt und rechtzeitig angekuendigt.
            </p>
            <p className="text-muted-foreground mt-3">
              6.3. Support wird per E-Mail waehrend der ueblichen Geschaeftszeiten angeboten.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Preise und Zahlung</h2>
            <p className="text-muted-foreground">
              7.1. Es gelten die zum Zeitpunkt des Vertragsschlusses auf der Website angegebenen Preise.
            </p>
            <p className="text-muted-foreground mt-3">
              7.2. Alle Preise verstehen sich netto zuzueglich der gesetzlichen Mehrwertsteuer.
            </p>
            <p className="text-muted-foreground mt-3">
              7.3. Die Rechnungsstellung erfolgt monatlich oder jaehrlich im Voraus, je nach gewaehltem Zahlungsintervall.
            </p>
            <p className="text-muted-foreground mt-3">
              7.4. Bei Zahlungsverzug ist der Anbieter berechtigt, den Zugang zur Software zu sperren, bis die ausstehenden Betraege beglichen sind.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Vertragslaufzeit und Kuendigung</h2>
            <p className="text-muted-foreground">
              8.1. Der Vertrag wird auf unbestimmte Zeit geschlossen, sofern kein fester Zeitraum vereinbart wurde.
            </p>
            <p className="text-muted-foreground mt-3">
              8.2. Der Vertrag kann von beiden Seiten mit einer Frist von einem Monat zum Ende des jeweiligen Abrechnungszeitraums gekuendigt werden.
            </p>
            <p className="text-muted-foreground mt-3">
              8.3. Das Recht zur ausserordentlichen Kuendigung aus wichtigem Grund bleibt unberuehrt.
            </p>
            <p className="text-muted-foreground mt-3">
              8.4. Nach Vertragsende werden die Daten des Kunden innerhalb von 30 Tagen geloescht, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Der Kunde hat die Moeglichkeit, seine Daten vorher zu exportieren.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Haftung</h2>
            <p className="text-muted-foreground">
              9.1. Der Anbieter haftet unbeschraenkt fuer Schaeden aus der Verletzung des Lebens, des Koerpers oder der Gesundheit sowie bei Vorsatz und grober Fahrlaessigkeit.
            </p>
            <p className="text-muted-foreground mt-3">
              9.2. Bei leichter Fahrlaessigkeit haftet der Anbieter nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten). Die Haftung ist in diesem Fall auf den vertragstypischen, vorhersehbaren Schaden begrenzt.
            </p>
            <p className="text-muted-foreground mt-3">
              9.3. Der Anbieter haftet nicht fuer Schaeden, die durch Datenverlust entstehen, sofern der Kunde keine regelmaessigen Datensicherungen durchgefuehrt hat.
            </p>
            <p className="text-muted-foreground mt-3">
              9.4. Die Haftung nach dem Produkthaftungsgesetz bleibt unberuehrt.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Datenschutz</h2>
            <p className="text-muted-foreground">
              10.1. Der Anbieter verarbeitet personenbezogene Daten des Kunden gemaess der geltenden Datenschutzgesetze. Einzelheiten sind in der Datenschutzerklaerung geregelt.
            </p>
            <p className="text-muted-foreground mt-3">
              10.2. Soweit der Kunde personenbezogene Daten Dritter in der Software verarbeitet, ist er selbst Verantwortlicher im Sinne der DSGVO. Auf Wunsch wird ein Auftragsverarbeitungsvertrag geschlossen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">11. Aenderungen der AGB</h2>
            <p className="text-muted-foreground">
              11.1. Der Anbieter ist berechtigt, diese AGB mit angemessener Ankuendigungsfrist zu aendern, sofern die Aenderung unter Beruecksichtigung der Interessen des Anbieters fuer den Kunden zumutbar ist.
            </p>
            <p className="text-muted-foreground mt-3">
              11.2. Aenderungen werden dem Kunden per E-Mail mitgeteilt. Widerspricht der Kunde nicht innerhalb von vier Wochen nach Zugang der Mitteilung, gelten die geaenderten AGB als genehmigt.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">12. Schlussbestimmungen</h2>
            <p className="text-muted-foreground">
              12.1. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
            </p>
            <p className="text-muted-foreground mt-3">
              12.2. Ist der Kunde Kaufmann, juristische Person des oeffentlichen Rechts oder oeffentlich-rechtliches Sondervermoegen, ist ausschliesslicher Gerichtsstand fuer alle Streitigkeiten aus diesem Vertrag der Geschaeftssitz des Anbieters.
            </p>
            <p className="text-muted-foreground mt-3">
              12.3. Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit der uebrigen Bestimmungen unberuehrt.
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
