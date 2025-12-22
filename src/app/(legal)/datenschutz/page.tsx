import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Datenschutz | Performanty",
  description: "Datenschutzerklaerung",
};

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurueck
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-8">Datenschutzerklaerung</h1>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Datenschutz auf einen Blick</h2>

            <h3 className="text-lg font-medium mt-6 mb-3">Allgemeine Hinweise</h3>
            <p className="text-muted-foreground">
              Die folgenden Hinweise geben einen einfachen Ueberblick darueber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persoenlich identifiziert werden koennen. Ausfuehrliche Informationen zum Thema Datenschutz entnehmen Sie unserer unter diesem Text aufgefuehrten Datenschutzerklaerung.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">Datenerfassung auf dieser Website</h3>
            <p className="text-muted-foreground">
              <strong>Wer ist verantwortlich fuer die Datenerfassung auf dieser Website?</strong><br />
              Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten koennen Sie dem Impressum dieser Website entnehmen.
            </p>
            <p className="text-muted-foreground mt-3">
              <strong>Wie erfassen wir Ihre Daten?</strong><br />
              Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Hierbei kann es sich z.B. um Daten handeln, die Sie in ein Kontaktformular eingeben. Andere Daten werden automatisch oder nach Ihrer Einwilligung beim Besuch der Website durch unsere IT-Systeme erfasst. Das sind vor allem technische Daten (z.B. Internetbrowser, Betriebssystem oder Uhrzeit des Seitenaufrufs). Die Erfassung dieser Daten erfolgt automatisch, sobald Sie diese Website betreten.
            </p>
            <p className="text-muted-foreground mt-3">
              <strong>Wofuer nutzen wir Ihre Daten?</strong><br />
              Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung der Website zu gewaehrleisten. Andere Daten koennen zur Analyse Ihres Nutzerverhaltens verwendet werden.
            </p>
            <p className="text-muted-foreground mt-3">
              <strong>Welche Rechte haben Sie bezueglich Ihrer Daten?</strong><br />
              Sie haben jederzeit das Recht, unentgeltlich Auskunft ueber Herkunft, Empfaenger und Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten. Sie haben ausserdem ein Recht, die Berichtigung oder Loeschung dieser Daten zu verlangen. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben, koennen Sie diese Einwilligung jederzeit fuer die Zukunft widerrufen. Ausserdem haben Sie das Recht, unter bestimmten Umstaenden die Einschraenkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen. Des Weiteren steht Ihnen ein Beschwerderecht bei der zustaendigen Aufsichtsbehoerde zu.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Verantwortliche Stelle</h2>
            <p className="text-muted-foreground">
              Die verantwortliche Stelle fuer die Datenverarbeitung auf dieser Website ist:
            </p>
            <p className="text-muted-foreground mt-3">
              Weboa Webdesign &amp; Marketing<br />
              Inhaber: Abdulhamit Oezdemir<br />
              Helene-Lange-Weg 13<br />
              75417 Muehlacker<br />
              Deutschland
            </p>
            <p className="text-muted-foreground mt-3">
              Telefon: +49 173 9053339<br />
              E-Mail: info@weboa.de
            </p>
            <p className="text-muted-foreground mt-3">
              Verantwortliche Stelle ist die natuerliche oder juristische Person, die allein oder gemeinsam mit anderen ueber die Zwecke und Mittel der Verarbeitung von personenbezogenen Daten (z.B. Namen, E-Mail-Adressen o.Ae.) entscheidet.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Hosting</h2>
            <p className="text-muted-foreground">
              Wir hosten die Inhalte unserer Website bei folgendem Anbieter:
            </p>
            <h3 className="text-lg font-medium mt-6 mb-3">Externes Hosting</h3>
            <p className="text-muted-foreground">
              Diese Website wird extern gehostet. Die personenbezogenen Daten, die auf dieser Website erfasst werden, werden auf den Servern des Hosters gespeichert. Hierbei kann es sich v.a. um IP-Adressen, Kontaktanfragen, Meta- und Kommunikationsdaten, Vertragsdaten, Kontaktdaten, Namen, Websitezugriffe und sonstige Daten, die ueber eine Website generiert werden, handeln.
            </p>
            <p className="text-muted-foreground mt-3">
              Das externe Hosting erfolgt zum Zwecke der Vertragserfuellung gegenueber unseren potenziellen und bestehenden Kunden (Art. 6 Abs. 1 lit. b DSGVO) und im Interesse einer sicheren, schnellen und effizienten Bereitstellung unseres Online-Angebots durch einen professionellen Anbieter (Art. 6 Abs. 1 lit. f DSGVO).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Allgemeine Hinweise und Pflichtinformationen</h2>

            <h3 className="text-lg font-medium mt-6 mb-3">Datenschutz</h3>
            <p className="text-muted-foreground">
              Die Betreiber dieser Seiten nehmen den Schutz Ihrer persoenlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend den gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklaerung.
            </p>
            <p className="text-muted-foreground mt-3">
              Wenn Sie diese Website benutzen, werden verschiedene personenbezogene Daten erhoben. Personenbezogene Daten sind Daten, mit denen Sie persoenlich identifiziert werden koennen. Die vorliegende Datenschutzerklaerung erlaeutert, welche Daten wir erheben und wofuer wir sie nutzen. Sie erlaeutert auch, wie und zu welchem Zweck das geschieht.
            </p>
            <p className="text-muted-foreground mt-3">
              Wir weisen darauf hin, dass die Datenuebertragung im Internet (z.B. bei der Kommunikation per E-Mail) Sicherheitsluecken aufweisen kann. Ein lueckenloser Schutz der Daten vor dem Zugriff durch Dritte ist nicht moeglich.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">Speicherdauer</h3>
            <p className="text-muted-foreground">
              Soweit innerhalb dieser Datenschutzerklaerung keine speziellere Speicherdauer genannt wurde, verbleiben Ihre personenbezogenen Daten bei uns, bis der Zweck fuer die Datenverarbeitung entfaellt. Wenn Sie ein berechtigtes Loeschersuchen geltend machen oder eine Einwilligung zur Datenverarbeitung widerrufen, werden Ihre Daten geloescht, sofern wir keine anderen rechtlich zulaessigen Gruende fuer die Speicherung Ihrer personenbezogenen Daten haben (z.B. steuer- oder handelsrechtliche Aufbewahrungsfristen); im letztgenannten Fall erfolgt die Loeschung nach Fortfall dieser Gruende.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">Widerruf Ihrer Einwilligung zur Datenverarbeitung</h3>
            <p className="text-muted-foreground">
              Viele Datenverarbeitungsvorgaenge sind nur mit Ihrer ausdruecklichen Einwilligung moeglich. Sie koennen eine bereits erteilte Einwilligung jederzeit widerrufen. Die Rechtmaessigkeit der bis zum Widerruf erfolgten Datenverarbeitung bleibt vom Widerruf unberuehrt.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">Recht auf Datenportabilitaet</h3>
            <p className="text-muted-foreground">
              Sie haben das Recht, Daten, die wir auf Grundlage Ihrer Einwilligung oder in Erfuellung eines Vertrags automatisiert verarbeiten, an sich oder an einen Dritten in einem gaengigen, maschinenlesbaren Format aushaendigen zu lassen. Sofern Sie die direkte Uebertragung der Daten an einen anderen Verantwortlichen verlangen, erfolgt dies nur, soweit es technisch machbar ist.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">Auskunft, Loeschung und Berichtigung</h3>
            <p className="text-muted-foreground">
              Sie haben im Rahmen der geltenden gesetzlichen Bestimmungen jederzeit das Recht auf unentgeltliche Auskunft ueber Ihre gespeicherten personenbezogenen Daten, deren Herkunft und Empfaenger und den Zweck der Datenverarbeitung und ggf. ein Recht auf Berichtigung oder Loeschung dieser Daten. Hierzu sowie zu weiteren Fragen zum Thema personenbezogene Daten koennen Sie sich jederzeit an uns wenden.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">Recht auf Einschraenkung der Verarbeitung</h3>
            <p className="text-muted-foreground">
              Sie haben das Recht, die Einschraenkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen. Hierzu koennen Sie sich jederzeit an uns wenden. Das Recht auf Einschraenkung der Verarbeitung besteht in folgenden Faellen:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Wenn Sie die Richtigkeit Ihrer bei uns gespeicherten personenbezogenen Daten bestreiten</li>
              <li>Wenn die Verarbeitung Ihrer Daten unrechtmaessig erfolgt ist</li>
              <li>Wenn wir Ihre Daten nicht mehr benoetigen, Sie diese jedoch zur Ausuebung, Verteidigung oder Geltendmachung von Rechtsanspruechen benoetigen</li>
              <li>Wenn Sie Widerspruch gegen die Verarbeitung eingelegt haben</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Datenerfassung auf dieser Website</h2>

            <h3 className="text-lg font-medium mt-6 mb-3">Cookies</h3>
            <p className="text-muted-foreground">
              Unsere Internetseiten verwenden so genannte &quot;Cookies&quot;. Cookies sind kleine Datenpakete und richten auf Ihrem Endgeraet keinen Schaden an. Sie werden entweder voruebergehend fuer die Dauer einer Sitzung (Session-Cookies) oder dauerhaft (permanente Cookies) auf Ihrem Endgeraet gespeichert. Session-Cookies werden nach Ende Ihres Besuchs automatisch geloescht. Permanente Cookies bleiben auf Ihrem Endgeraet gespeichert, bis Sie diese selbst loeschen oder eine automatische Loeschung durch Ihren Webbrowser erfolgt.
            </p>
            <p className="text-muted-foreground mt-3">
              Cookies, die zur Durchfuehrung des elektronischen Kommunikationsvorgangs, zur Bereitstellung bestimmter, von Ihnen erwuenschter Funktionen oder zur Optimierung der Website erforderlich sind, werden auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO gespeichert, sofern keine andere Rechtsgrundlage angegeben wird.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">Server-Log-Dateien</h3>
            <p className="text-muted-foreground">
              Der Provider der Seiten erhebt und speichert automatisch Informationen in so genannten Server-Log-Dateien, die Ihr Browser automatisch an uns uebermittelt. Dies sind:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Browsertyp und Browserversion</li>
              <li>Verwendetes Betriebssystem</li>
              <li>Referrer URL</li>
              <li>Hostname des zugreifenden Rechners</li>
              <li>Uhrzeit der Serveranfrage</li>
              <li>IP-Adresse</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Eine Zusammenfuehrung dieser Daten mit anderen Datenquellen wird nicht vorgenommen. Die Erfassung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Der Websitebetreiber hat ein berechtigtes Interesse an der technisch fehlerfreien Darstellung und der Optimierung seiner Website &ndash; hierzu muessen die Server-Log-Files erfasst werden.
            </p>

            <h3 className="text-lg font-medium mt-6 mb-3">Kontaktformular</h3>
            <p className="text-muted-foreground">
              Wenn Sie uns per Kontaktformular Anfragen zukommen lassen, werden Ihre Angaben aus dem Anfrageformular inklusive der von Ihnen dort angegebenen Kontaktdaten zwecks Bearbeitung der Anfrage und fuer den Fall von Anschlussfragen bei uns gespeichert. Diese Daten geben wir nicht ohne Ihre Einwilligung weiter.
            </p>
            <p className="text-muted-foreground mt-3">
              Die Verarbeitung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO, sofern Ihre Anfrage mit der Erfuellung eines Vertrags zusammenhaengt oder zur Durchfuehrung vorvertraglicher Massnahmen erforderlich ist. In allen uebrigen Faellen beruht die Verarbeitung auf unserem berechtigten Interesse an der effektiven Bearbeitung der an uns gerichteten Anfragen (Art. 6 Abs. 1 lit. f DSGVO) oder auf Ihrer Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) sofern diese abgefragt wurde.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Nutzung der Software (Performanty)</h2>
            <p className="text-muted-foreground">
              Bei der Nutzung unserer CRM-Software Performanty werden folgende Daten verarbeitet:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Kontaktdaten (Namen, E-Mail-Adressen, Telefonnummern, Adressen)</li>
              <li>Unternehmensdaten (Firmenname, Branche, Website)</li>
              <li>Kommunikationsverlauf und Aktivitaeten</li>
              <li>Deal- und Pipeline-Informationen</li>
              <li>Nutzungsdaten und Zugriffszeiten</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Diese Daten werden ausschliesslich zur Bereitstellung der CRM-Funktionalitaet verarbeitet. Die Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfuellung).
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
