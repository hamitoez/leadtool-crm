# LeadTool E-Mail Marketing Suite - Implementierungsplan

> Erstellt: 22.12.2024
> Letzte Aktualisierung: 22.12.2025
> Status: Phase 5 KI-Features abgeschlossen
> Basiert auf: Instantly.ai Feature-Analyse

---

## ✅ ABGESCHLOSSEN: Phase 5 KI-Features (22.12.2025)

**Alle KI-Features implementiert:**
- ✅ **AI E-Mail Writer** - Prompt → fertige Kaltakquise-E-Mail
- ✅ **AI Spintax Generator** - E-Mail → Spintax-Varianten
- ✅ **AI Spam Checker** - Analyse auf Spam-Risiken mit Score
- ✅ **AI Antwort-Vorschläge** - Smart Reply Suggestions in Unibox
- ✅ **AI Betreffzeilen** - Mehrere Varianten generieren
- ✅ **AI E-Mail Verbessern** - Clarity, Persuasion, CTA optimieren

**Neue Dateien:**
```
src/lib/ai/email-ai.ts                          # AI E-Mail Funktionen
src/app/api/ai/email/route.ts                   # Email Generation API
src/app/api/ai/email/spintax/route.ts           # Spintax Generation API
src/app/api/ai/email/spam-check/route.ts        # Spam Check API
src/app/api/ai/email/reply-suggestions/route.ts # Reply Suggestions API
src/app/api/ai/email/improve/route.ts           # Email Improve API
src/app/api/ai/email/subjects/route.ts          # Subject Line Generator API
```

**UI-Integration:**
- KI-Generator Button im Sequence-Editor
- Spintax-Generator Button im Sequence-Editor
- Spam-Check Button mit Dialog im Sequence-Editor
- KI-Vorschläge Button in Unibox Conversation View

---

## 🚀 NÄCHSTER SCHRITT

**Phase 6: Warmup System** (Optional, später)

Alle Hauptfeatures sind fertig! Das Warmup-System ist optional und kann später implementiert werden.

---

## ✅ ABGESCHLOSSEN: Phase 4 Unibox (22.12.2025)

**Unified Inbox komplett implementiert:**
- ✅ **Unibox UI** - Three-Panel Layout (Sidebar, Liste, Detail)
- ✅ **Conversation Threading** - Alle E-Mails pro Lead chronologisch
- ✅ **Status-Labels** - INTERESTED, NOT_INTERESTED, MEETING_REQUEST, QUESTION, OOO, UNSUBSCRIBE
- ✅ **Quick-Reply** - Direkt aus Unibox antworten
- ✅ **Filter** - Nach Status, Intent, gelesen/ungelesen, markiert
- ✅ **Suche** - In Konversationen suchen
- ✅ **AI-Kategorisierung** - Intent wird automatisch erkannt

**Neue Dateien:**
```
src/app/(dashboard)/unibox/page.tsx              # Unibox Seite
src/app/(dashboard)/unibox/unibox-client.tsx     # Haupt-UI Component
src/components/unibox/conversation-view.tsx      # Konversation mit Threading
src/app/api/unibox/route.ts                      # Unibox API (Liste + Stats)
src/app/api/unibox/[recipientId]/route.ts        # Konversation Details/Update
src/app/api/unibox/[recipientId]/reply/route.ts  # Quick-Reply senden
```

**Schema-Erweiterung:**
```prisma
model CampaignRecipient {
  // Unibox Fields
  isRead          Boolean     @default(false)
  isStarred       Boolean     @default(false)
  isArchived      Boolean     @default(false)
  uniboxStatus    String?     // LEAD, MEETING_SCHEDULED, NEGOTIATION, WON, LOST
  assignedTo      String?
  lastActivityAt  DateTime?
  notes           String?     @db.Text

  replies     CampaignReply[]
}

model CampaignReply {
  id          String   @id @default(cuid())
  recipientId String
  messageId   String?  @unique
  subject     String?
  bodyText    String?  @db.Text
  bodyHtml    String?  @db.Text
  fromEmail   String
  fromName    String?
  toEmail     String
  accountId   String?
  intent      String?
  confidence  Float?
  summary     String?
  isRead      Boolean  @default(false)
  source      String   @default("webhook")
  receivedAt  DateTime @default(now())
}
```

**Features:**
- Three-Panel Layout: Sidebar (Filter), Liste (Konversationen), Detail (Thread)
- Intent-Filter: Interessiert, Kein Interesse, Termin-Anfrage, Frage
- Status-Filter: Alle, Ungelesen, Markiert, Archiviert
- Suche in E-Mail-Adressen und Namen
- Thread-Ansicht mit sent/reply Unterscheidung
- Tracking-Stats (Opens, Clicks) bei gesendeten Mails
- Quick-Reply mit korrekten In-Reply-To/References Headers
- Echtzeit-Updates nach Aktionen

---

## ✅ ABGESCHLOSSEN: Phase 3.5 Echtzeit Reply-Detection (22.12.2025)

**🚀 REVOLUTIONARY UPGRADE: Webhook-basierte Echtzeit Reply-Detection**

Statt 10 Minuten Wartezeit (IMAP Polling) jetzt **<1 Sekunde** Latenz!

**Neues System:**
- ✅ **Webhook-basierte Reply-Detection** via Mailgun/SendGrid/Postmark
- ✅ **Reply-To Header** mit Tracking-ID (Format: `r-{trackingId}@reply.domain.de`)
- ✅ **KI-gestützte Intent-Analyse** (INTERESTED, NOT_INTERESTED, MEETING_REQUEST, OOO, QUESTION, UNSUBSCRIBE)
- ✅ **Settings UI** für Inbound Email Provider Konfiguration
- ✅ **MX Records Verifizierung** automatisch prüfen
- ✅ **IMAP als Fallback** für direkte Antworten

**Neue Dateien:**
```
src/lib/email/reply-analyzer.ts                     # KI-Intent-Analyse
src/app/api/webhooks/inbound-email/route.ts         # Webhook Endpoint
src/app/api/organizations/inbound-email/route.ts   # Settings API
src/app/api/organizations/inbound-email/verify/route.ts  # Verifizierung
src/components/settings/inbound-email-settings.tsx  # Settings UI
```

**Schema-Erweiterung:**
```prisma
model InboundEmailSettings {
  id               String   @id
  organizationId   String   @unique
  provider         InboundEmailProvider  # MAILGUN, SENDGRID, POSTMARK, NONE
  inboundDomain    String?  # z.B. reply.performanty.de
  apiKey           String?
  webhookSecret    String?
  isActive         Boolean
  isVerified       Boolean
  // Stats
  totalReceived    Int
  totalProcessed   Int
  ...
}

model CampaignRecipient {
  ...
  // KI-Analyse der Antwort
  replyIntent      String?   # INTERESTED, NOT_INTERESTED, etc.
  replyConfidence  Float?    # 0.0 - 1.0
  replySummary     String?   # Kurze Zusammenfassung
  replyBody        String?   # Original Text
}
```

**Flow:**
1. E-Mail wird gesendet mit Reply-To: `r-abc123@reply.domain.de`
2. Empfänger antwortet → E-Mail geht an Mailgun/SendGrid
3. Provider sendet Webhook → `/api/webhooks/inbound-email`
4. System extrahiert Tracking-ID, findet Original-E-Mail
5. KI analysiert Intent (INTERESTED, NOT_INTERESTED, etc.)
6. Stats werden aktualisiert, Sequence wird gestoppt
7. **Latenz: <1 Sekunde statt 10 Minuten!**

**Setup in Settings → Integrationen → Inbound E-Mail**

---

## ✅ ABGESCHLOSSEN: Phase 3 Reply-Detection via IMAP (22.12.2025)

**Reply & Bounce Detection als Fallback implementiert:**
- ✅ IMAP Sync Service (`imapflow` basiert)
- ✅ Reply-Detection via In-Reply-To / References Header
- ✅ Bounce-Detection (Mailer-Daemon, DSN, SMTP Error Codes)
- ✅ Auto-Reply Erkennung (Out of Office)
- ✅ Hard/Soft Bounce Unterscheidung
- ✅ Automatische Stats-Updates (Campaign, Recipient, Variant)
- ✅ Cron Job alle 10 Minuten (FALLBACK wenn Webhook nicht konfiguriert)

**Dateien:**
```
src/lib/email/imap-sync.ts              # IMAP Sync Service (Fallback)
src/lib/email/reply-detector.ts         # Reply/Bounce Detection Logik
src/app/api/cron/imap-sync/route.ts     # IMAP Sync Cron Endpoint
scripts/cron-imap-sync.sh               # Cron Script
```

**Aktive Cron Jobs:**
```
0 * * * *   cron-auto-move.sh           # Stündlich: Auto-Move Deals
*/5 * * * * cron-campaign-scheduler.sh  # Alle 5 Min: E-Mail-Versand
*/10 * * * * cron-imap-sync.sh          # Alle 10 Min: Reply/Bounce Detection (Fallback)
```

---

## ✅ ABGESCHLOSSEN: Phase 2.5 Kampagnen-Versand (22.12.2025)

**Kampagnen-Versand komplett implementiert:**
- ✅ Versand-Scheduler Cron Job (`/api/cron/campaign-scheduler`)
- ✅ Tracking-Pixel Endpoint für Open-Tracking (`/api/track/open/[trackingId]`)
- ✅ Link-Wrapper für Click-Tracking (`/api/track/click/[trackingId]`)
- ✅ E-Mail-Sender mit SMTP via Nodemailer
- ✅ Spintax + Variablen Personalisierung
- ✅ A/B Testing Support (Varianten-Auswahl nach Gewicht)
- ✅ Daily Limit Management (Account + Campaign Level)
- ✅ Account Rotation (Round-Robin mit Limit-Check)

**Neue Dateien:**
```
src/lib/email/campaign-sender.ts        # E-Mail-Versand mit SMTP
src/lib/email/tracking.ts               # Tracking-Pixel & Link-Wrapper
src/app/api/track/open/[trackingId]/route.ts    # Open-Tracking Endpoint
src/app/api/track/click/[trackingId]/route.ts   # Click-Tracking Endpoint
src/app/api/cron/campaign-scheduler/route.ts    # Scheduler Cron Job
```

**Cron Job Setup:**
```bash
# Alle 5 Minuten ausführen
*/5 * * * * curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/campaign-scheduler
```

---

## ✅ ABGESCHLOSSEN: Phase 2 UI (22.12.2025)

**Kampagnen-UI komplett implementiert:**
- ✅ Kampagnen-Übersichtsseite (`/campaigns`)
- ✅ Kampagnen-Detail mit Tabs
- ✅ Sequence-Editor (E-Mail-Schritte mit Spintax)
- ✅ Empfänger-Verwaltung (manuell + Import)
- ✅ Statistiken-Ansicht
- ✅ Einstellungen-Tab
- ✅ Navigation in Sidebar

**Neue Komponenten:**
```
src/app/(dashboard)/campaigns/page.tsx
src/app/(dashboard)/campaigns/[campaignId]/page.tsx
src/components/campaigns/create-campaign-dialog.tsx
src/components/campaigns/sequence-editor.tsx
src/components/campaigns/recipient-manager.tsx
src/components/campaigns/campaign-stats.tsx
src/components/campaigns/campaign-settings.tsx
```

---

## ✅ ABGESCHLOSSEN: Phase 1

**Phase 1: E-Mail Infrastruktur & Multi-Account** - FERTIG (22.12.2024)

Was implementiert wurde:
1. ✅ Prisma Schema erweitert (Limits, Health, DNS, Warmup-Felder)
2. ✅ API: Verbindungstest (`POST /api/email/accounts/[id]/test`)
3. ✅ API: DNS Validierung (`POST /api/email/accounts/[id]/verify-dns`)
4. ✅ UI: Health Score Anzeige mit Farbindikator
5. ✅ UI: Daily Limit Progress-Bar
6. ✅ UI: DNS-Status Badges (SPF/DKIM/DMARC)
7. ✅ UI: SMTP/IMAP Test-Buttons
8. ✅ UI: Limits-Tab im Account-Formular mit Slider

Springe zu: [Phase 1 Details](#phase-1-e-mail-infrastruktur--multi-account)

---

## Übersicht

Wir bauen eine vollständige E-Mail Marketing Suite in LeadTool, inspiriert von Instantly.ai.

### Was wir bauen:
- E-Mail Kampagnen mit Sequences
- A/B Testing & Spintax
- Open/Click/Reply Tracking
- Unified Inbox (Unibox)
- E-Mail Warmup System
- KI-Features (Content Writer, Spam Checker)

### Was wir NICHT bauen:
- CRM & Pipeline (haben wir bereits)
- B2B Lead-Datenbank (wir nutzen Imports)

---

## Phase 1: E-Mail Infrastruktur & Multi-Account ✅ ABGESCHLOSSEN

### Ziel
Mehrere E-Mail-Konten pro User verwalten mit Health-Monitoring.

### Features
- [x] SMTP/IMAP Konto-Verwaltung
- [x] E-Mail-Konto Healthcheck (SPF/DKIM/DMARC Validierung)
- [ ] Inbox Rotation beim Versand (kommt mit Phase 2)
- [x] Tägliche Sending Limits pro Konto
- [x] Bounce-Handling & Auto-Pause bei Problemen (Felder vorhanden)
- [ ] OAuth für Google/Microsoft (optional, später)

### Implementierte Dateien

```
prisma/schema.prisma                          # EmailAccount Model erweitert
src/app/api/email/accounts/route.ts           # GET, POST Accounts
src/app/api/email/accounts/[accountId]/route.ts    # GET, PATCH, DELETE Account
src/app/api/email/accounts/[accountId]/test/route.ts    # SMTP/IMAP Test
src/app/api/email/accounts/[accountId]/verify-dns/route.ts  # SPF/DKIM/DMARC Check
src/app/(dashboard)/email/page.tsx            # Email-Seite mit Health-Anzeige
src/components/email/email-account-form.tsx   # Formular mit Limits-Tab
```

### Neue EmailAccount Felder (Prisma)

```prisma
// Marketing & Limits
dailyLimit        Int      @default(50)
sentToday         Int      @default(0)
sentTotal         Int      @default(0)
lastResetAt       DateTime @default(now())

// Health Score
healthScore       Int      @default(100)
lastHealthCheckAt DateTime?

// DNS Validierung
spfValid          Boolean?
dkimValid         Boolean?
dmarcValid        Boolean?
dnsCheckedAt      DateTime?
dnsError          String?

// Verbindungs-Verifizierung
smtpVerified      Boolean  @default(false)
imapVerified      Boolean  @default(false)
lastVerifiedAt    DateTime?
verificationError String?

// Warmup (vorbereitet für Phase 6)
warmupEnabled     Boolean  @default(false)
warmupDay         Int      @default(0)
warmupDailyTarget Int      @default(0)
warmupStartedAt   DateTime?

// Blocking
bounceCount       Int      @default(0)
lastBounceAt      DateTime?
isBlocked         Boolean  @default(false)
blockedReason     String?
```

### Datenbank-Schema

```prisma
model EmailAccount {
  id                String   @id @default(cuid())
  userId            String
  organizationId    String

  // Basis-Info
  name              String              // "Sales Account 1"
  email             String              // "sales@firma.de"

  // SMTP Einstellungen (Versand)
  smtpHost          String              // "smtp.gmail.com"
  smtpPort          Int      @default(587)
  smtpUser          String
  smtpPassword      String              // verschlüsselt speichern!
  smtpSecure        Boolean  @default(true) // TLS

  // IMAP Einstellungen (Empfang)
  imapHost          String              // "imap.gmail.com"
  imapPort          Int      @default(993)
  imapUser          String
  imapPassword      String              // verschlüsselt speichern!
  imapSecure        Boolean  @default(true)

  // Limits & Tracking
  dailyLimit        Int      @default(50)    // Max E-Mails pro Tag
  sentToday         Int      @default(0)     // Heute gesendet
  sentTotal         Int      @default(0)     // Gesamt gesendet
  lastSentAt        DateTime?
  lastSyncAt        DateTime?               // Letzter IMAP Sync

  // Health & Warmup
  isActive          Boolean  @default(true)
  healthScore       Int      @default(100)   // 0-100
  warmupEnabled     Boolean  @default(false)
  warmupDay         Int      @default(0)     // Tag im Warmup-Zyklus
  warmupDailyTarget Int      @default(0)     // Aktuelle Warmup-Mails/Tag

  // DNS Validierung
  spfValid          Boolean?
  dkimValid         Boolean?
  dmarcValid        Boolean?
  dnsCheckedAt      DateTime?

  // Signatur
  signature         String?                  // HTML Signatur

  // Relations
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  sentEmails        SentEmail[]
  warmupEmailsSent  WarmupEmail[] @relation("WarmupSender")
  warmupEmailsReceived WarmupEmail[] @relation("WarmupReceiver")

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([organizationId, email])
  @@index([userId])
  @@index([organizationId])
}
```

### API Endpoints

```
POST   /api/email/accounts           - Konto erstellen
GET    /api/email/accounts           - Alle Konten abrufen
GET    /api/email/accounts/:id       - Einzelnes Konto
PUT    /api/email/accounts/:id       - Konto aktualisieren
DELETE /api/email/accounts/:id       - Konto löschen
POST   /api/email/accounts/:id/test  - Verbindung testen
POST   /api/email/accounts/:id/verify-dns - DNS prüfen (SPF/DKIM/DMARC)
POST   /api/email/accounts/:id/sync  - IMAP Sync auslösen
```

### UI Komponenten

- `src/components/email/email-account-form.tsx` - Konto hinzufügen/bearbeiten
- `src/components/email/email-account-list.tsx` - Konten-Übersicht
- `src/components/email/email-account-health.tsx` - Health-Status Anzeige
- `src/app/(dashboard)/email/accounts/page.tsx` - Konten-Verwaltungsseite

---

## Phase 2: Kampagnen-Engine

### Ziel
E-Mail Kampagnen mit automatischen Sequences erstellen und verwalten.

### Features
- [ ] Kampagnen-Builder (Name, Zielgruppe, Zeitplan)
- [ ] E-Mail Sequence Editor (Schritt 1, 2, 3...)
- [ ] Warte-Logik (X Tage nach letzter Mail)
- [ ] Spintax Parser `{Hi|Hello|Hey}`
- [ ] Variablen `{{firstName}}`, `{{company}}`
- [ ] Scheduling (Versandzeit, Wochentage, Zeitzone)
- [ ] A/B Testing (mehrere Betreffzeilen/Bodies)
- [ ] Auto-Pause bei Reply/Bounce
- [ ] Empfänger aus LeadTool-Tabellen importieren

### Datenbank-Schema

```prisma
enum CampaignStatus {
  DRAFT
  SCHEDULED
  ACTIVE
  PAUSED
  COMPLETED
  CANCELLED
}

enum RecipientStatus {
  PENDING       // Noch nicht gestartet
  ACTIVE        // In Sequence
  COMPLETED     // Alle Steps durch
  REPLIED       // Hat geantwortet
  BOUNCED       // E-Mail unzustellbar
  UNSUBSCRIBED  // Abgemeldet
  PAUSED        // Manuell pausiert
}

model Campaign {
  id                String         @id @default(cuid())
  organizationId    String
  userId            String

  // Basis-Info
  name              String
  description       String?
  status            CampaignStatus @default(DRAFT)

  // Zeitplan
  scheduleStartAt   DateTime?      // Wann startet die Kampagne?
  scheduleEndAt     DateTime?      // Wann endet sie?
  sendingDays       String[]       // ["MON", "TUE", "WED", "THU", "FRI"]
  sendingHoursStart Int            @default(9)  // Ab 9 Uhr
  sendingHoursEnd   Int            @default(17) // Bis 17 Uhr
  timezone          String         @default("Europe/Berlin")

  // E-Mail Konten (für Rotation)
  accountIds        String[]       // Welche Konten nutzen?

  // Einstellungen
  dailyLimit        Int            @default(100) // Max Mails pro Tag
  stopOnReply       Boolean        @default(true)
  stopOnBounce      Boolean        @default(true)
  trackOpens        Boolean        @default(true)
  trackClicks       Boolean        @default(true)

  // Statistiken (cached)
  recipientCount    Int            @default(0)
  sentCount         Int            @default(0)
  openCount         Int            @default(0)
  clickCount        Int            @default(0)
  replyCount        Int            @default(0)
  bounceCount       Int            @default(0)

  // Relations
  organization      Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user              User           @relation(fields: [userId], references: [id])
  sequences         CampaignSequence[]
  recipients        CampaignRecipient[]
  sentEmails        SentEmail[]

  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@index([organizationId])
  @@index([userId])
  @@index([status])
}

model CampaignSequence {
  id          String   @id @default(cuid())
  campaignId  String

  // Reihenfolge
  stepNumber  Int                  // 1, 2, 3...

  // Inhalt
  subject     String               // Betreff (kann Spintax enthalten)
  body        String   @db.Text    // HTML Body (Spintax + Variablen)

  // Timing
  delayDays   Int      @default(1) // Warte X Tage
  delayHours  Int      @default(0) // + X Stunden

  // A/B Varianten (optional)
  variants    CampaignSequenceVariant[]

  // Relation
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  sentEmails  SentEmail[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([campaignId, stepNumber])
  @@index([campaignId])
}

model CampaignSequenceVariant {
  id          String   @id @default(cuid())
  sequenceId  String

  name        String               // "Variante A", "Variante B"
  subject     String
  body        String   @db.Text
  weight      Int      @default(50) // Prozent (alle zusammen = 100)

  // Statistiken
  sentCount   Int      @default(0)
  openCount   Int      @default(0)
  clickCount  Int      @default(0)
  replyCount  Int      @default(0)

  sequence    CampaignSequence @relation(fields: [sequenceId], references: [id], onDelete: Cascade)

  @@index([sequenceId])
}

model CampaignRecipient {
  id          String          @id @default(cuid())
  campaignId  String

  // Kontaktdaten
  email       String
  firstName   String?
  lastName    String?
  company     String?

  // Custom Variables (für Personalisierung)
  variables   Json            @default("{}")

  // Status
  status      RecipientStatus @default(PENDING)
  currentStep Int             @default(0)

  // Timing
  nextSendAt  DateTime?       // Wann kommt die nächste Mail?
  startedAt   DateTime?       // Wann wurde gestartet?
  completedAt DateTime?
  repliedAt   DateTime?
  bouncedAt   DateTime?

  // Optional: Link zu LeadTool Row
  rowId       String?

  campaign    Campaign        @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  sentEmails  SentEmail[]

  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@unique([campaignId, email])
  @@index([campaignId])
  @@index([status])
  @@index([nextSendAt])
}
```

### Spintax Parser

```typescript
// src/lib/email/spintax.ts

/**
 * Parst Spintax und gibt eine zufällige Variante zurück
 *
 * Beispiel:
 * Input:  "{Hallo|Hi|Guten Tag} {{firstName}}, {wie geht es Ihnen|wie geht's}?"
 * Output: "Hi Max, wie geht's?"
 */
export function parseSpintax(text: string): string {
  const regex = /\{([^{}]+)\}/g;

  return text.replace(regex, (match, group) => {
    // Prüfe ob es Spintax ist (enthält |)
    if (group.includes('|')) {
      const options = group.split('|');
      return options[Math.floor(Math.random() * options.length)];
    }
    // Sonst unverändert lassen (könnte Variable sein)
    return match;
  });
}

/**
 * Ersetzt Variablen mit Werten
 *
 * Beispiel:
 * Input:  "Hallo {{firstName}}, Sie arbeiten bei {{company}}."
 * Variables: { firstName: "Max", company: "ACME GmbH" }
 * Output: "Hallo Max, Sie arbeiten bei ACME GmbH."
 */
export function replaceVariables(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match;
  });
}

/**
 * Vollständige E-Mail-Personalisierung
 */
export function personalizeEmail(
  text: string,
  variables: Record<string, string>
): string {
  // Erst Spintax auflösen
  let result = parseSpintax(text);
  // Dann Variablen ersetzen
  result = replaceVariables(result, variables);
  return result;
}
```

### API Endpoints

```
# Kampagnen
POST   /api/campaigns                     - Kampagne erstellen
GET    /api/campaigns                     - Alle Kampagnen
GET    /api/campaigns/:id                 - Kampagne Details
PUT    /api/campaigns/:id                 - Kampagne aktualisieren
DELETE /api/campaigns/:id                 - Kampagne löschen
POST   /api/campaigns/:id/start           - Kampagne starten
POST   /api/campaigns/:id/pause           - Kampagne pausieren
POST   /api/campaigns/:id/resume          - Kampagne fortsetzen
GET    /api/campaigns/:id/stats           - Statistiken

# Sequences
POST   /api/campaigns/:id/sequences       - Sequence hinzufügen
PUT    /api/campaigns/:id/sequences/:seq  - Sequence bearbeiten
DELETE /api/campaigns/:id/sequences/:seq  - Sequence löschen
POST   /api/campaigns/:id/sequences/reorder - Reihenfolge ändern

# Empfänger
POST   /api/campaigns/:id/recipients      - Empfänger hinzufügen
POST   /api/campaigns/:id/recipients/import - Aus Table importieren
GET    /api/campaigns/:id/recipients      - Empfänger auflisten
DELETE /api/campaigns/:id/recipients/:rid - Empfänger entfernen

# A/B Testing
POST   /api/campaigns/:id/sequences/:seq/variants - Variante hinzufügen
```

### UI Komponenten

- `src/app/(dashboard)/campaigns/page.tsx` - Kampagnen-Übersicht
- `src/app/(dashboard)/campaigns/new/page.tsx` - Neue Kampagne
- `src/app/(dashboard)/campaigns/[id]/page.tsx` - Kampagne bearbeiten
- `src/app/(dashboard)/campaigns/[id]/sequences/page.tsx` - Sequence Editor
- `src/app/(dashboard)/campaigns/[id]/recipients/page.tsx` - Empfänger
- `src/app/(dashboard)/campaigns/[id]/stats/page.tsx` - Statistiken
- `src/components/campaigns/campaign-builder.tsx`
- `src/components/campaigns/sequence-editor.tsx`
- `src/components/campaigns/email-preview.tsx`
- `src/components/campaigns/recipient-import.tsx`
- `src/components/campaigns/spintax-helper.tsx`

---

## Phase 3: Tracking & Analytics

### Ziel
Open/Click/Reply Tracking implementieren und Analytics Dashboard bauen.

### Features
- [ ] Tracking Pixel für Opens (1x1 transparentes Bild)
- [ ] Link-Wrapper für Click Tracking
- [ ] Reply Detection via IMAP
- [ ] Bounce Detection (SMTP Errors + Bounce Mails)
- [ ] Campaign Dashboard mit Charts
- [ ] Export der Statistiken

### Datenbank-Schema

```prisma
model SentEmail {
  id            String   @id @default(cuid())

  // Referenzen
  campaignId    String
  recipientId   String
  accountId     String
  sequenceId    String
  variantId     String?          // Falls A/B Test

  // E-Mail Details
  subject       String
  body          String   @db.Text
  toEmail       String
  fromEmail     String

  // Tracking
  trackingId    String   @unique  // UUID für Tracking Pixel

  // Timestamps
  sentAt        DateTime @default(now())
  openedAt      DateTime?        // Erste Öffnung
  openCount     Int      @default(0) // Anzahl Öffnungen
  clickedAt     DateTime?        // Erster Klick
  clickCount    Int      @default(0)
  repliedAt     DateTime?
  bouncedAt     DateTime?
  bounceReason  String?

  // Status
  status        String   @default("sent") // sent, opened, clicked, replied, bounced

  // Relations
  campaign      Campaign          @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  recipient     CampaignRecipient @relation(fields: [recipientId], references: [id], onDelete: Cascade)
  account       EmailAccount      @relation(fields: [accountId], references: [id])
  sequence      CampaignSequence  @relation(fields: [sequenceId], references: [id])
  clicks        EmailClick[]

  @@index([campaignId])
  @@index([recipientId])
  @@index([trackingId])
  @@index([sentAt])
}

model EmailClick {
  id          String   @id @default(cuid())
  sentEmailId String

  url         String           // Original URL
  clickedAt   DateTime @default(now())
  userAgent   String?
  ipAddress   String?

  sentEmail   SentEmail @relation(fields: [sentEmailId], references: [id], onDelete: Cascade)

  @@index([sentEmailId])
}
```

### Tracking Pixel Endpoint

```typescript
// src/app/api/track/open/[trackingId]/route.ts

import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

// 1x1 transparentes PNG
const TRACKING_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

export async function GET(
  request: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  const { trackingId } = params;

  // Async Update (nicht auf Ergebnis warten)
  prisma.sentEmail.update({
    where: { trackingId },
    data: {
      openedAt: new Date(),
      openCount: { increment: 1 },
      status: 'opened',
    },
  }).catch(() => {}); // Fehler ignorieren

  return new Response(TRACKING_PIXEL, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
```

### Link Wrapper Endpoint

```typescript
// src/app/api/track/click/[trackingId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { trackingId: string } }
) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.redirect('/');
  }

  const { trackingId } = params;

  // Click tracken
  try {
    const sentEmail = await prisma.sentEmail.findUnique({
      where: { trackingId },
    });

    if (sentEmail) {
      await prisma.$transaction([
        prisma.sentEmail.update({
          where: { trackingId },
          data: {
            clickedAt: sentEmail.clickedAt || new Date(),
            clickCount: { increment: 1 },
            status: sentEmail.repliedAt ? 'replied' : 'clicked',
          },
        }),
        prisma.emailClick.create({
          data: {
            sentEmailId: sentEmail.id,
            url,
            userAgent: request.headers.get('user-agent') || undefined,
            ipAddress: request.headers.get('x-forwarded-for') || undefined,
          },
        }),
      ]);
    }
  } catch (error) {
    console.error('Click tracking error:', error);
  }

  return NextResponse.redirect(url);
}
```

### Link Wrapper Funktion

```typescript
// src/lib/email/tracking.ts

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL;

/**
 * Wrapt alle Links in einer E-Mail für Click Tracking
 */
export function wrapLinksForTracking(html: string, trackingId: string): string {
  const linkRegex = /<a\s+([^>]*href=["'])([^"']+)(["'][^>]*)>/gi;

  return html.replace(linkRegex, (match, before, url, after) => {
    // Keine internen Tracking-Links wrappen
    if (url.includes('/api/track/')) {
      return match;
    }

    const trackedUrl = `${BASE_URL}/api/track/click/${trackingId}?url=${encodeURIComponent(url)}`;
    return `<a ${before}${trackedUrl}${after}>`;
  });
}

/**
 * Fügt Tracking Pixel am Ende der E-Mail ein
 */
export function addTrackingPixel(html: string, trackingId: string): string {
  const pixel = `<img src="${BASE_URL}/api/track/open/${trackingId}" width="1" height="1" style="display:none" />`;

  // Vor </body> einfügen falls vorhanden
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixel}</body>`);
  }

  // Sonst am Ende anhängen
  return html + pixel;
}
```

---

## Phase 4: Unibox (Unified Inbox) ✅ ABGESCHLOSSEN

### Ziel
Alle E-Mail-Antworten aus allen Konten in einer zentralen Inbox verwalten.

### Features
- [x] Multi-Account Inbox Sync (via Webhook + IMAP Fallback)
- [x] Conversation Threading (alle Mails pro Lead)
- [x] Status-Labels (Interested, Meeting Booked, Not Interested, etc.)
- [x] Quick-Reply direkt aus Unibox
- [x] Filter nach Status, Kampagne, Account
- [x] Suche in E-Mails
- [x] AI-Kategorisierung (Intent-Analyse)

### Datenbank-Schema

```prisma
enum ConversationStatus {
  NEW
  OPEN
  INTERESTED
  MEETING_BOOKED
  NOT_INTERESTED
  CLOSED
  SPAM
}

model EmailConversation {
  id              String             @id @default(cuid())
  organizationId  String

  // Kontakt
  contactEmail    String
  contactName     String?

  // Status
  status          ConversationStatus @default(NEW)
  isRead          Boolean            @default(false)
  isStarred       Boolean            @default(false)

  // Referenzen
  campaignId      String?
  recipientId     String?
  rowId           String?            // Link zu LeadTool Lead

  // Letzte Aktivität
  lastMessageAt   DateTime
  messageCount    Int                @default(0)

  // Relations
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  messages        EmailMessage[]

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@unique([organizationId, contactEmail])
  @@index([organizationId])
  @@index([status])
  @@index([lastMessageAt])
}

model EmailMessage {
  id              String   @id @default(cuid())
  conversationId  String
  accountId       String

  // E-Mail Details
  messageId       String   @unique  // Message-ID Header
  inReplyTo       String?           // In-Reply-To Header
  references      String?           // References Header

  // Inhalt
  fromEmail       String
  fromName        String?
  toEmail         String
  subject         String
  bodyText        String?  @db.Text
  bodyHtml        String?  @db.Text

  // Richtung
  isInbound       Boolean           // true = empfangen, false = gesendet

  // Timestamps
  sentAt          DateTime
  receivedAt      DateTime?

  // Relations
  conversation    EmailConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  attachments     EmailAttachment[]

  @@index([conversationId])
  @@index([messageId])
  @@index([sentAt])
}

model EmailAttachment {
  id          String   @id @default(cuid())
  messageId   String

  filename    String
  contentType String
  size        Int
  storagePath String   // Pfad im Dateisystem oder S3

  message     EmailMessage @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([messageId])
}
```

### IMAP Sync Service

```typescript
// src/lib/email/imap-sync.ts

import Imap from 'imap';
import { simpleParser } from 'mailparser';
import prisma from '@/lib/prisma';

export async function syncEmailAccount(accountId: string) {
  const account = await prisma.emailAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) throw new Error('Account not found');

  const imap = new Imap({
    user: account.imapUser,
    password: account.imapPassword, // entschlüsseln!
    host: account.imapHost,
    port: account.imapPort,
    tls: account.imapSecure,
  });

  return new Promise((resolve, reject) => {
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) return reject(err);

        // Neue E-Mails seit letztem Sync holen
        const since = account.lastSyncAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        imap.search(['SINCE', since], (err, results) => {
          if (err) return reject(err);
          if (!results.length) {
            imap.end();
            return resolve({ synced: 0 });
          }

          const fetch = imap.fetch(results, { bodies: '' });
          let synced = 0;

          fetch.on('message', (msg) => {
            msg.on('body', async (stream) => {
              const parsed = await simpleParser(stream);
              await processEmail(account.organizationId, accountId, parsed);
              synced++;
            });
          });

          fetch.once('end', () => {
            imap.end();
            resolve({ synced });
          });
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

async function processEmail(organizationId: string, accountId: string, email: any) {
  const fromEmail = email.from?.value?.[0]?.address;
  if (!fromEmail) return;

  // Conversation finden oder erstellen
  let conversation = await prisma.emailConversation.findUnique({
    where: {
      organizationId_contactEmail: {
        organizationId,
        contactEmail: fromEmail,
      },
    },
  });

  if (!conversation) {
    conversation = await prisma.emailConversation.create({
      data: {
        organizationId,
        contactEmail: fromEmail,
        contactName: email.from?.value?.[0]?.name,
        lastMessageAt: email.date || new Date(),
      },
    });
  }

  // E-Mail speichern
  await prisma.emailMessage.create({
    data: {
      conversationId: conversation.id,
      accountId,
      messageId: email.messageId,
      inReplyTo: email.inReplyTo,
      references: email.references?.join(' '),
      fromEmail,
      fromName: email.from?.value?.[0]?.name,
      toEmail: email.to?.value?.[0]?.address || '',
      subject: email.subject || '',
      bodyText: email.text,
      bodyHtml: email.html,
      isInbound: true,
      sentAt: email.date || new Date(),
      receivedAt: new Date(),
    },
  });

  // Conversation aktualisieren
  await prisma.emailConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: email.date || new Date(),
      messageCount: { increment: 1 },
      isRead: false,
    },
  });
}
```

### API Endpoints

```
# Unibox
GET    /api/unibox                        - Conversations auflisten
GET    /api/unibox/:id                    - Conversation mit Messages
PUT    /api/unibox/:id                    - Status ändern
POST   /api/unibox/:id/reply              - Antwort senden
POST   /api/unibox/sync                   - Alle Accounts syncen

# Filter
GET    /api/unibox?status=INTERESTED      - Nach Status filtern
GET    /api/unibox?campaign=xxx           - Nach Kampagne filtern
GET    /api/unibox?search=keyword         - Suchen
```

### UI Komponenten

- `src/app/(dashboard)/unibox/page.tsx` - Hauptansicht
- `src/components/unibox/conversation-list.tsx` - Liste links
- `src/components/unibox/conversation-view.tsx` - Detail rechts
- `src/components/unibox/reply-composer.tsx` - Antwort schreiben
- `src/components/unibox/status-selector.tsx` - Status ändern
- `src/components/unibox/filters.tsx` - Filter-Leiste

---

## Phase 6: E-Mail Warmup System (Optional)

### Ziel
Automatisches Aufwärmen neuer E-Mail-Konten für bessere Zustellbarkeit.

### Wie Warmup funktioniert

```
┌─────────────────────────────────────────────────────────────────┐
│                    E-MAIL WARMUP NETZWERK                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Alle Warmup-aktivierten Konten bilden ein Netzwerk.           │
│   Sie senden sich gegenseitig E-Mails und interagieren:         │
│                                                                  │
│   Account A ──────────────> Account B                            │
│      │                          │                                │
│      │    1. Sendet E-Mail      │                                │
│      │                          │                                │
│      │    2. B öffnet E-Mail    │                                │
│      │                          │                                │
│      │    3. B antwortet        │                                │
│      │                          │                                │
│      │    4. Falls in Spam:     │                                │
│      │       → In Inbox         │                                │
│      │         verschieben      │                                │
│      │                          │                                │
│   Account C <──────────────> Account D                           │
│                                                                  │
│   Das signalisiert E-Mail-Providern:                            │
│   "Diese Absender sind vertrauenswürdig!"                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Slow Ramp Strategie

```
Tag 1:  2 Warmup-Mails
Tag 2:  4 Warmup-Mails
Tag 3:  6 Warmup-Mails
Tag 4:  8 Warmup-Mails
...
Tag 14: 30 Warmup-Mails (Maximum)

Nach 2-3 Wochen ist das Konto "aufgewärmt" und kann
für echte Kampagnen mit höherem Volumen genutzt werden.
```

### Features

- [ ] Warmup-Pool (alle aktivierten Konten)
- [ ] Slow Ramp (gradueller Anstieg)
- [ ] Automatische Interaktionen (Öffnen, Antworten)
- [ ] Spam-Ordner Rettung (aus Spam in Inbox verschieben)
- [ ] Deliverability Score berechnen
- [ ] Warmup Dashboard

### Datenbank-Schema

```prisma
model WarmupEmail {
  id              String   @id @default(cuid())

  // Sender & Empfänger
  fromAccountId   String
  toAccountId     String

  // Inhalt (wird zufällig generiert)
  subject         String
  body            String

  // Status
  sentAt          DateTime @default(now())
  deliveredAt     DateTime?
  openedAt        DateTime?
  repliedAt       DateTime?

  // Spam-Handling
  landedInSpam    Boolean  @default(false)
  movedToInbox    Boolean  @default(false)
  movedAt         DateTime?

  // Relations
  fromAccount     EmailAccount @relation("WarmupSender", fields: [fromAccountId], references: [id], onDelete: Cascade)
  toAccount       EmailAccount @relation("WarmupReceiver", fields: [toAccountId], references: [id], onDelete: Cascade)

  @@index([fromAccountId])
  @@index([toAccountId])
  @@index([sentAt])
}

model WarmupStats {
  id              String   @id @default(cuid())
  accountId       String   @unique

  // Tägliche Stats
  date            DateTime @db.Date

  sentCount       Int      @default(0)
  receivedCount   Int      @default(0)
  openedCount     Int      @default(0)
  repliedCount    Int      @default(0)
  spamCount       Int      @default(0)
  rescuedCount    Int      @default(0)

  // Berechneter Score
  inboxRate       Float    @default(0)  // % der Mails in Inbox

  account         EmailAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([accountId, date])
  @@index([accountId])
  @@index([date])
}
```

### Warmup Cron Job

```typescript
// src/lib/email/warmup-scheduler.ts

import prisma from '@/lib/prisma';
import { sendWarmupEmail, checkSpamFolder, moveToInbox } from './warmup-actions';

/**
 * Läuft alle 30 Minuten via Cron
 */
export async function runWarmupCycle() {
  // 1. Alle Warmup-aktivierten Konten holen
  const accounts = await prisma.emailAccount.findMany({
    where: {
      warmupEnabled: true,
      isActive: true,
    },
  });

  if (accounts.length < 2) {
    console.log('Warmup: Mindestens 2 Konten nötig');
    return;
  }

  for (const account of accounts) {
    // 2. Tägliches Warmup-Ziel berechnen (Slow Ramp)
    const dailyTarget = Math.min(2 + (account.warmupDay * 2), 30);

    // 3. Wie viele heute schon gesendet?
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sentToday = await prisma.warmupEmail.count({
      where: {
        fromAccountId: account.id,
        sentAt: { gte: today },
      },
    });

    // 4. Noch zu sendende Mails
    const remaining = dailyTarget - sentToday;

    if (remaining > 0) {
      // Zufälligen Empfänger aus dem Pool wählen
      const recipients = accounts.filter(a => a.id !== account.id);
      const recipient = recipients[Math.floor(Math.random() * recipients.length)];

      await sendWarmupEmail(account, recipient);
    }

    // 5. Spam-Ordner prüfen und retten
    await checkAndRescueFromSpam(account.id);

    // 6. Empfangene Warmup-Mails öffnen/beantworten
    await interactWithReceivedWarmupEmails(account.id);
  }
}

async function checkAndRescueFromSpam(accountId: string) {
  // IMAP: Spam-Ordner prüfen
  // Falls Warmup-Mails drin sind → in Inbox verschieben
}

async function interactWithReceivedWarmupEmails(accountId: string) {
  // Ungeöffnete Warmup-Mails finden
  // Zufällig öffnen und teilweise beantworten
}
```

### API Endpoints

```
# Warmup Management
POST   /api/warmup/enable/:accountId      - Warmup aktivieren
POST   /api/warmup/disable/:accountId     - Warmup deaktivieren
GET    /api/warmup/stats                  - Warmup Statistiken
GET    /api/warmup/stats/:accountId       - Stats für ein Konto

# Cron (intern)
POST   /api/cron/warmup                   - Warmup-Zyklus ausführen
```

---

## Phase 5: KI-Features ✅ ABGESCHLOSSEN

### Ziel
KI-gestützte Funktionen für bessere E-Mails und automatische Kategorisierung.

### Features

- [x] AI E-Mail Writer (Prompt → E-Mail)
- [x] AI Spintax Generator (E-Mail → Spintax-Varianten)
- [x] AI Spam Word Checker (E-Mail analysieren)
- [x] AI Reply Kategorisierung (Antwort → Interested/Not Interested)
- [x] AI Antwort-Vorschläge
- [x] AI Betreffzeilen-Generator
- [x] AI E-Mail-Verbesserer

### AI E-Mail Writer

```typescript
// src/lib/email/ai-writer.ts

import { generateText } from '@/lib/ai';

interface EmailWriterInput {
  purpose: string;        // "Kaltakquise für SaaS Produkt"
  targetAudience: string; // "CEOs von mittelständischen Unternehmen"
  tone: 'formal' | 'casual' | 'friendly';
  keyPoints: string[];    // ["USP 1", "USP 2"]
  callToAction: string;   // "Termin vereinbaren"
}

export async function generateEmail(input: EmailWriterInput): Promise<{
  subject: string;
  body: string;
}> {
  const prompt = `
Du bist ein Experte für Kaltakquise-E-Mails. Schreibe eine überzeugende E-Mail.

Zweck: ${input.purpose}
Zielgruppe: ${input.targetAudience}
Tonalität: ${input.tone}
Kernpunkte: ${input.keyPoints.join(', ')}
Call-to-Action: ${input.callToAction}

Anforderungen:
- Kurz und prägnant (max. 150 Wörter)
- Personalisierbar mit {{firstName}} und {{company}}
- Keine Spam-Wörter
- Klarer CTA

Antworte im JSON-Format:
{
  "subject": "Betreffzeile",
  "body": "E-Mail Text mit HTML-Formatierung"
}
`;

  const response = await generateText(prompt);
  return JSON.parse(response);
}
```

### AI Spintax Generator

```typescript
// src/lib/email/ai-spintax.ts

export async function generateSpintax(email: string): Promise<string> {
  const prompt = `
Füge Spintax-Variationen in diese E-Mail ein, um sie einzigartiger zu machen.

Original:
${email}

Regeln:
- Verwende {Option1|Option2|Option3} Syntax
- Variiere Grußformeln, Übergänge, Abschlüsse
- Behalte die Kernbotschaft bei
- Maximal 3-4 Spintax-Blöcke

Antworte nur mit der modifizierten E-Mail.
`;

  return generateText(prompt);
}
```

### AI Spam Checker

```typescript
// src/lib/email/ai-spam-checker.ts

interface SpamCheckResult {
  score: number;          // 0-100 (0 = kein Spam, 100 = definitiv Spam)
  issues: SpamIssue[];
  suggestions: string[];
}

interface SpamIssue {
  type: 'word' | 'formatting' | 'structure';
  description: string;
  severity: 'low' | 'medium' | 'high';
  location?: string;
}

export async function checkForSpam(
  subject: string,
  body: string
): Promise<SpamCheckResult> {
  const prompt = `
Analysiere diese E-Mail auf Spam-Risiken.

Betreff: ${subject}

Inhalt:
${body}

Prüfe auf:
- Spam-Trigger-Wörter (GRATIS, KOSTENLOS, DRINGEND, etc.)
- Übermäßige Großschreibung
- Zu viele Links
- Fehlende Personalisierung
- Aggressive Verkaufssprache
- Formatierungsprobleme

Antworte im JSON-Format:
{
  "score": 0-100,
  "issues": [
    {
      "type": "word|formatting|structure",
      "description": "Beschreibung",
      "severity": "low|medium|high",
      "location": "optional"
    }
  ],
  "suggestions": ["Verbesserungsvorschlag 1", "..."]
}
`;

  const response = await generateText(prompt);
  return JSON.parse(response);
}
```

### AI Reply Kategorisierung

```typescript
// src/lib/email/ai-categorizer.ts

type ReplyCategory =
  | 'INTERESTED'
  | 'MEETING_REQUEST'
  | 'MORE_INFO'
  | 'NOT_INTERESTED'
  | 'OUT_OF_OFFICE'
  | 'WRONG_PERSON'
  | 'UNSUBSCRIBE'
  | 'OTHER';

export async function categorizeReply(email: string): Promise<{
  category: ReplyCategory;
  confidence: number;
  summary: string;
}> {
  const prompt = `
Kategorisiere diese E-Mail-Antwort auf eine Kaltakquise.

E-Mail:
${email}

Kategorien:
- INTERESTED: Zeigt Interesse, möchte mehr erfahren
- MEETING_REQUEST: Möchte Termin vereinbaren
- MORE_INFO: Braucht mehr Informationen
- NOT_INTERESTED: Kein Interesse
- OUT_OF_OFFICE: Abwesenheitsnotiz
- WRONG_PERSON: Nicht der richtige Ansprechpartner
- UNSUBSCRIBE: Möchte keine weiteren E-Mails
- OTHER: Sonstiges

Antworte im JSON-Format:
{
  "category": "KATEGORIE",
  "confidence": 0.0-1.0,
  "summary": "Kurze Zusammenfassung der Antwort"
}
`;

  const response = await generateText(prompt);
  return JSON.parse(response);
}
```

---

## Zeitplan & Priorisierung

### Festgelegte Reihenfolge

```
Phase 1: E-Mail Infrastruktur     ████████████████████  ✅ FERTIG
Phase 2: Kampagnen-Engine         ████████████████████  ✅ FERTIG
Phase 3: Tracking & Analytics     ████████████████████  ✅ FERTIG
Phase 4: Unibox                   ████████████████████  ✅ FERTIG
Phase 5: KI-Features              ████████████████████  ✅ FERTIG
Phase 6: Warmup System            ░░░░░░░░░░░░░░░░░░░░  ← Optional (Konzept noch offen)
```

### Status

- [x] Planung abgeschlossen
- [x] **Phase 1: E-Mail Infrastruktur** ✅ FERTIG (22.12.2024)
- [x] **Phase 2: Kampagnen-Engine** ✅ FERTIG (22.12.2025)
- [x] **Phase 2.5: Kampagnen-Versand** ✅ FERTIG (22.12.2025)
- [x] **Phase 3: Tracking & Analytics** ✅ FERTIG (22.12.2025)
- [x] **Phase 3.5: Echtzeit Reply-Detection** ✅ FERTIG (22.12.2025)
- [x] **Phase 4: Unibox** ✅ FERTIG (22.12.2025)
- [x] **Phase 5: KI-Features** ✅ FERTIG (22.12.2025)
- [ ] Phase 6: Warmup (optional, Konzept noch zu klären)

### MVP (Minimum Viable Product)

Für einen schnellen Start reichen:
1. ✅ Phase 1: Multi-Account - **FERTIG**
2. Phase 2: Kampagnen-Engine (ohne A/B Testing)
3. Phase 3: Basis-Tracking (Opens, Clicks)

Das ergibt ein funktionsfähiges E-Mail-Marketing-Tool.

---

## Technische Abhängigkeiten

### NPM Packages

```bash
npm install nodemailer          # SMTP Versand
npm install imap                # IMAP Empfang
npm install mailparser          # E-Mail Parsing
npm install dns                 # DNS Lookups (SPF/DKIM)
npm install html-to-text        # HTML → Text
npm install node-cron           # Scheduled Jobs
npm install bullmq              # Job Queue (für Massen-Versand)
npm install ioredis             # Redis (für Queue)
```

### Infrastruktur

- **Redis**: Für Job-Queue (Massen-E-Mail-Versand)
- **Cron Jobs**: Für Warmup, IMAP-Sync, Kampagnen-Scheduler
- **Verschlüsselung**: SMTP/IMAP-Passwörter verschlüsselt speichern

---

## Offene Fragen

1. **Warmup-Strategie**: Eigenes Netzwerk oder externes Tool (Instantly, Warmup Inbox)?
2. **E-Mail Provider**: Nur SMTP/IMAP oder auch OAuth (Google, Microsoft)?
3. **Job Queue**: Redis + BullMQ oder einfachere Lösung?
4. **E-Mail Volumen**: Erwartete Mails pro Tag? (beeinflusst Architektur)
5. **Compliance**: DSGVO, Double-Opt-In, Unsubscribe-Handling?

---

## Nächste Schritte

1. [x] Prisma Schema erweitern ✅
2. [x] Phase 1 implementieren (E-Mail Accounts) ✅
3. [ ] **Phase 2 implementieren (Kampagnen)** ← JETZT
4. [ ] Phase 3 implementieren (Tracking)
5. [ ] Testen mit echten E-Mail-Konten
6. [ ] Weitere Phasen nach Bedarf

---

*Letzte Aktualisierung: 22.12.2024*
