# LeadTool CRM - Entwicklungsstand
**Datum:** 20. Dezember 2025
**Letzte Aktualisierung:** 22.12.2025 - Phase 5 E-Mail Marketing zu 70% (Reply-Detection)

---

## DIE 4 PHASEN - UEBERSICHT

### Phase 5: E-Mail Marketing Suite - IN ARBEIT (70%)
- [x] E-Mail Infrastruktur & Multi-Account (Phase 1 des Plans)
- [x] **KAMPAGNEN-UI** (22.12.2025)
- [x] **VERSAND-SCHEDULER** (Cron Job alle 5 Min)
- [x] **TRACKING** (Open-Pixel, Click-Wrapper)
- [x] **REPLY-DETECTION** - NEU! (IMAP Sync alle 10 Min)
- [x] **BOUNCE-DETECTION** - NEU! (Hard/Soft Bounce Erkennung)
- [ ] Unibox (Unified Inbox)
- [ ] KI-Features
- [ ] Warmup System

### Phase 1: CRM Grundfunktionen - ABGESCHLOSSEN (100%)
- [x] Pipeline/Kanban Board
- [x] Deals verwalten (erstellen, bearbeiten, loeschen, verschieben)
- [x] Stages verwalten (erstellen, bearbeiten, loeschen)
- [x] Aktivitaeten/Tasks (erstellen, bearbeiten, loeschen)
- [x] Aktivitaeten-Filter
- [x] Kontakt-Detail-Seite mit Timeline/History
- [x] Deal-Detail-Ansicht
- [x] Reminders/Erinnerungen UI

### Phase 2: Kommunikation & Automatisierung - ABGESCHLOSSEN (100%)
- [x] E-Mail-Integration (Senden)
- [x] E-Mail-Templates
- [x] Automatische Follow-ups (Regeln-System)
- [x] E-Mail Compose Dialog
- [x] E-Mail-Konto Einstellungen
- [x] **VISUELLER WORKFLOW-EDITOR** (n8n/Make.com-Style)
- [x] Workflow-Execution Engine
- [x] Demo-Workflow fuer alle Benutzer
- [x] **E-Mail-Empfang (IMAP)** - NEU! (20.12.2025)
- [x] **Anruf-Scripts & Timer** - NEU! (20.12.2025)
- [x] **Notiz-Vorlagen** - NEU! (20.12.2025)

### Phase 3: Reporting & Analytics - ABGESCHLOSSEN (100%)
- [x] Dashboard mit KPIs (Pipeline-Wert, Win Rate, Offene Deals, Aktivitaeten)
- [x] Pipeline-Reports (Conversion Rates, Durchlaufzeiten, Deals pro Stage)
- [x] Umsatz-Prognosen (Forecast Tab mit Monats-Prognose)
- [x] Aktivitaets-Reports (Trends, E-Mail Tracking)
- [x] Export-Funktionen (CSV + PDF fuer alle Reports)

### Phase 4: Erweiterte Features - ABGESCHLOSSEN (100%)
- [x] Team-Funktionen (Organisationen, Mitglieder einladen, SMTP) - 100%
- [x] Rollen & Berechtigungen (OWNER, ADMIN, MANAGER, MEMBER) - 100%
- [x] Multi-Org Datentrennung (alle APIs org-aware) - 100% (21.12.2025)
- [x] API fuer externe Integrationen (REST API, API-Keys) - 100% (21.12.2025)
- [x] Webhooks (Event-basierte Benachrichtigungen) - 100% (22.12.2025)

---

## PHASE 1 - KOMPLETT ERLEDIGT

### Pipeline (Sales Pipeline Board)
- [x] Pipeline-Board mit Drag & Drop (Deals zwischen Stages verschieben)
- [x] Stages bearbeiten (Name, Farbe, Typ)
- [x] Stages loeschen (nur wenn leer)
- [x] Deals bearbeiten (Wert, Wahrscheinlichkeit, Abschlussdatum)
- [x] Deals aus Pipeline entfernen
- [x] Deal hinzufuegen Button funktioniert
- [x] Aktualisieren-Button mit Lade-Animation
- [x] Einstellungen-Dialog (Pipeline-Name aendern, Stages-Uebersicht, neue Stages hinzufuegen)
- [x] Deal-Detail-Sheet (Klick auf Deal oeffnet Details)

### Aufgaben/Tasks
- [x] Neue Aufgabe erstellen Dialog
- [x] Aufgaben bearbeiten (Titel, Beschreibung, Status, Prioritaet, Faelligkeitsdatum)
- [x] Aufgaben loeschen
- [x] Erledigt-Status zuruecksetzbar (Checkbox togglebar)
- [x] "Wieder oeffnen" Option im Menue

### Activities (Aktivitaeten)
- [x] Activity-Liste mit Filtern (Typ, Status)
- [x] Activities bearbeiten
- [x] Activities loeschen
- [x] Status-Wechsel (PLANNED, COMPLETED, CANCELLED, MISSED)

### Kontakte/Leads (Tabellen-Ansicht)
- [x] Kontakt-Detail-Sheet mit Tabs (Details, Aktivitaeten, Timeline)
- [x] Aktivitaeten pro Kontakt anzeigen
- [x] History/Verlauf pro Kontakt (Timeline)
- [x] Quick-Actions (Anruf, E-Mail, Meeting, Notiz, Aufgabe, Erinnerung)

### Reminders (Erinnerungen)
- [x] Reminder-Bell im Header (zeigt anstehende/ueberfaellige Erinnerungen)
- [x] CreateReminderDialog (Erinnerung erstellen mit Schnellauswahl)
- [x] Reminder-Aktionen (Snooze, Dismiss, Complete)
- [x] Reminder-Button in Deal-Details und Row-Details

### Design-Fixes
- [x] Dialog Overflow-Probleme behoben (Firmennamen bleiben im Popup)
- [x] Sentry-Fehler behoben (Sentry deaktiviert, Stub-Funktionen erstellt)
- [x] SelectItem leere Werte Fix (activity-filters.tsx)

### Rechtliche Seiten
- [x] Impressum erstellt (`/impressum`)
- [x] Datenschutzerklaerung erstellt (`/datenschutz`)
- [x] AGB erstellt (`/agb`)
- [x] Footer-Links auf Startseite hinzugefuegt

---

## NEUE KOMPONENTEN (18.12.2025)

### Deal-Detail-Sheet
`src/components/pipeline/deal-detail-sheet.tsx`
- 3 Tabs: Details | Aktivitaeten | Timeline
- Kontaktdaten (Email, Telefon, Website)
- Deal-Infos bearbeitbar (Wert, Wahrscheinlichkeit, Abschlussdatum)
- Quick-Actions: Anruf, Email, Meeting, Notiz, Aufgabe, Erinnerung
- Link zur Tabellen-Ansicht

### Row-Details mit Timeline
`src/components/table/row-details-sheet.tsx` (erweitert)
- 3 Tabs: Details | Aktivitaeten | Timeline
- Quick-Activity-Buttons inkl. Erinnerung
- ContactTimeline integriert

### CreateReminderDialog
`src/components/reminders/create-reminder-dialog.tsx`
- Schnellauswahl: 15 Min, 1 Std, 3 Std, Morgen 9:00, Naechste Woche
- Datum/Uhrzeit Picker
- Reminder-Typen: Benutzerdefiniert, Follow-up, Deadline, Vor Aktivitaet

---

## TECHNISCHE NOTIZEN

### Build-Prozess
```bash
# Build erstellen
npx next build

# Static Files kopieren (WICHTIG fuer Standalone-Mode!)
cp -r /var/www/leadtool/.next/static /var/www/leadtool/.next/standalone/.next/

# PM2 neu starten
pm2 restart leadtool
```

### Wichtige Dateien
- `/src/components/pipeline/` - Pipeline-Komponenten
- `/src/components/activities/` - Aufgaben/Activities-Komponenten
- `/src/components/reminders/` - Reminder-Komponenten
- `/src/components/timeline/` - Timeline-Komponenten
- `/src/app/api/` - API-Routen
- `/src/lib/` - Utilities und Services

### Bekannte Issues
- Sentry ist deaktiviert (next.config.ts) wegen Standalone-Mode Problemen
- `instrumentation.ts` wurde zu `.bak` umbenannt

### Server-Info
- Domain: performanty.de
- PM2 Process: leadtool
- Port: 3000
- Nginx als Reverse Proxy

---

## PHASE 2 - IN ARBEIT (18.12.2025)

### E-Mail-Integration
- [x] Prisma Schema erweitert (EmailAccount, EmailMessage, EmailTemplate, FollowUpRule, AutomationLog)
- [x] API: `/api/email/accounts` - E-Mail-Konten CRUD
- [x] API: `/api/email/templates` - E-Mail-Vorlagen CRUD
- [x] API: `/api/email/send` - E-Mails senden via SMTP (nodemailer)
- [x] UI: E-Mail-Einstellungen Tab in Settings (Konten, Vorlagen)
- [x] UI: ComposeEmailDialog - E-Mail verfassen mit Template-Auswahl

### E-Mail-Compose Features
- Vorlage auswaehlen
- Variablen-Ersetzung ({{vorname}}, {{nachname}}, {{firma}}, etc.)
- CC/BCC Optionen
- Automatische Signatur
- Verknuepfung mit Kontakt (Activity + History Eintrag)

### Automatisierungen
- [x] API: `/api/automation/rules` - Follow-up Regeln CRUD
- [x] API: `/api/automation/logs` - Automatisierungs-Logs
- [x] UI: Automatisierung Tab in Settings

### Trigger-Typen
- DEAL_CREATED - Neuer Deal erstellt
- STAGE_CHANGED - Stage gewechselt
- NO_ACTIVITY - Keine Aktivitaet seit X Tagen
- EMAIL_OPENED - E-Mail geoeffnet
- EMAIL_NOT_OPENED - E-Mail nicht geoeffnet
- EMAIL_CLICKED - Link geklickt
- TASK_OVERDUE - Aufgabe ueberfaellig
- MEETING_SCHEDULED/COMPLETED
- CALL_COMPLETED

### Aktions-Typen
- SEND_EMAIL - E-Mail senden
- CREATE_TASK - Aufgabe erstellen
- CREATE_REMINDER - Erinnerung erstellen
- MOVE_STAGE - Stage aendern
- ADD_NOTE - Notiz hinzufuegen
- NOTIFY_USER - Benutzer benachrichtigen

### Neue Komponenten
- `src/components/email/compose-email-dialog.tsx`
- `src/components/email/email-account-form.tsx`
- `src/components/email/email-template-form.tsx`
- `src/components/settings/email-settings-form.tsx`
- `src/components/settings/automation-settings-form.tsx`

### Neue API-Routen
- `/api/email/accounts/` (GET, POST)
- `/api/email/accounts/[accountId]/` (GET, PATCH, DELETE)
- `/api/email/templates/` (GET, POST)
- `/api/email/templates/[templateId]/` (GET, PATCH, DELETE)
- `/api/email/send/` (POST)
- `/api/automation/rules/` (GET, POST)
- `/api/automation/rules/[ruleId]/` (GET, PATCH, DELETE)
- `/api/automation/logs/` (GET)

---

## PHASE 2 ABSCHLUSS (20.12.2025)

Phase 2 wurde vollstaendig abgeschlossen mit folgenden neuen Features:

### E-Mail-Empfang (IMAP)
- [x] IMAP-Sync API (`/api/email/sync`)
- [x] E-Mail Inbox API (`/api/email/inbox`)
- [x] Automatische Kontakt-Zuordnung
- [x] Activity & History Eintraege bei eingehenden E-Mails
- [x] Sync-Status und Logs

### Anruf-Scripts & Timer
- [x] CallScript Prisma Model
- [x] API: `/api/call-scripts` (CRUD)
- [x] Call Script Editor mit Fragen & Einwaenden
- [x] Call Script Selector im Aktivitaets-Dialog
- [x] Live-Timer fuer Anrufdauer
- [x] Anruf-Ergebnis Dropdown (erreicht, nicht erreicht, Mailbox, etc.)
- [x] Settings-Tab fuer Anruf-Scripts

### Notiz-Vorlagen
- [x] NoteTemplate Prisma Model
- [x] API: `/api/note-templates` (CRUD)
- [x] Notiz-Vorlagen Editor mit Variablen
- [x] Notiz-Vorlagen Selector im Aktivitaets-Dialog
- [x] Automatische Variablen-Ersetzung
- [x] Settings-Tab fuer Notiz-Vorlagen

### Neue API-Routen
- `/api/email/sync` (POST, GET)
- `/api/email/inbox` (GET)
- `/api/call-scripts` (GET, POST)
- `/api/call-scripts/[scriptId]` (GET, PATCH, DELETE, POST)
- `/api/note-templates` (GET, POST)
- `/api/note-templates/[templateId]` (GET, PATCH, DELETE, POST)

### Neue Komponenten
```
src/components/call-scripts/
├── call-script-form.tsx
├── call-script-selector.tsx
└── call-scripts-settings.tsx

src/components/notes/
├── note-template-form.tsx
├── note-template-selector.tsx
└── note-templates-settings.tsx

src/components/email/
└── email-inbox.tsx
```

### Neue Prisma Models
- `CallScript` - Anruf-Leitfaeden mit Fragen und Einwaenden
- `NoteTemplate` - Notiz-Vorlagen mit Variablen
- `EmailSyncLog` - IMAP Sync-Protokolle

---

## WICHTIG: DEPLOYMENT NACH CODE-AENDERUNGEN

**MUSS nach JEDER Code-Aenderung ausgefuehrt werden!**

Wenn du Code aenderst und 404-Fehler fuer CSS/JS-Dateien siehst, liegt das am Standalone-Build von Next.js. Die alten Asset-Hashes sind nicht mehr gueltig.

### Befehle zum Deployen:
```bash
# 1. PM2 stoppen
pm2 stop leadtool

# 2. Build-Ordner loeschen und neu bauen
rm -rf .next && npm run build

# 3. PM2 neu starten
pm2 restart leadtool
```

### Oder als Einzeiler:
```bash
pm2 stop leadtool; rm -rf .next && npm run build && pm2 restart leadtool
```

### Warum ist das noetig?
- Next.js im Standalone-Modus generiert gehashte Asset-Namen (z.B. `50fb52bb3ea49aa0.css`)
- Nach Code-Aenderungen aendern sich diese Hashes
- Ohne Rebuild zeigt der Browser auf die alten (nicht mehr existierenden) Dateien
- `postbuild` Script kopiert statische Dateien in den Standalone-Ordner

---

## NAECHSTE SCHRITTE (Phase 4 - Rest)

Phase 4: Erweiterte Features - Verbleibend:
1. **Mobile App / PWA** - Progressive Web App fuer mobile Nutzung

Bereits erledigt in Phase 4:
- [x] Team-Funktionen (Organisationen, Mitglieder, Einladungen)
- [x] Rollen & Berechtigungen (OWNER, ADMIN, MANAGER, MEMBER)
- [x] Multi-Org Datentrennung - Alle APIs filtern nach Organisation (21.12.2025)
- [x] API fuer externe Integrationen - REST API v1 mit API-Keys (21.12.2025)
- [x] Webhooks - Event-basierte Benachrichtigungen an externe URLs (22.12.2025)

## WEBHOOKS (22.12.2025) - NEU!

### Uebersicht
Webhooks senden automatisch HTTP POST Requests an externe URLs wenn Events in LeadTool auftreten. Perfekt fuer Integrationen mit Zapier, Make.com, n8n oder eigene Backend-Systeme.

### Unterstuetzte Events
| Event | Beschreibung |
|-------|-------------|
| LEAD_CREATED | Neuer Lead erstellt |
| LEAD_UPDATED | Lead aktualisiert |
| LEAD_DELETED | Lead geloescht |
| DEAL_CREATED | Deal erstellt |
| DEAL_UPDATED | Deal aktualisiert |
| DEAL_DELETED | Deal geloescht |
| DEAL_STAGE_CHANGED | Deal in andere Stage verschoben |
| DEAL_WON | Deal gewonnen |
| DEAL_LOST | Deal verloren |
| ACTIVITY_CREATED | Aktivitaet erstellt |
| ACTIVITY_COMPLETED | Aktivitaet abgeschlossen |
| PIPELINE_CREATED | Pipeline erstellt |
| STAGE_CREATED | Stage erstellt |

### Payload Format
```json
{
  "event": "DEAL_CREATED",
  "timestamp": "2025-12-22T10:30:00Z",
  "data": {
    "deal_id": "...",
    "lead_id": "...",
    "stage_id": "...",
    "stage_name": "Qualifiziert",
    "value": 5000,
    "probability": 50
  }
}
```

### Headers
- `Content-Type: application/json`
- `User-Agent: LeadTool-Webhook/1.0`
- `X-Webhook-Event: DEAL_CREATED`
- `X-Webhook-ID: webhook_id`
- `X-Webhook-Signature: sha256=...` (wenn Secret konfiguriert)

### Features
- HMAC-SHA256 Signatur fuer Sicherheit
- Automatische Retries (max 3, exponential backoff)
- Webhook-Logs mit Response-Details
- Test-Funktion zum Pruefen der Verbindung

### API Endpunkte
- `GET /api/webhooks` - Liste aller Webhooks
- `POST /api/webhooks` - Webhook erstellen
- `GET /api/webhooks/[id]` - Webhook Details
- `PATCH /api/webhooks/[id]` - Webhook aktualisieren
- `DELETE /api/webhooks/[id]` - Webhook loeschen
- `POST /api/webhooks/[id]` - Webhook testen
- `GET /api/webhooks/[id]/logs` - Webhook Logs

### UI
Settings > Webhooks Tab
- Webhooks erstellen/bearbeiten/loeschen
- Events per Checkbox auswaehlen
- Test-Button zum Pruefen
- Logs anzeigen mit Status/Response

## REST API v1 (21.12.2025) - NEU!

### Endpunkte
- `GET /api/v1/leads` - Leads abrufen
- `POST /api/v1/leads` - Lead erstellen
- `GET /api/v1/deals` - Deals abrufen
- `POST /api/v1/deals` - Deal erstellen
- `GET /api/v1/activities` - Aktivitaeten abrufen
- `POST /api/v1/activities` - Aktivitaet erstellen
- `GET /api/v1/pipelines` - Pipelines abrufen

### Authentifizierung
- API-Key via `Authorization: Bearer ldt_xxx` Header
- Oder via `X-API-Key: ldt_xxx` Header

### Features
- Rate Limiting (1000 Requests/Stunde)
- Scope-basierte Berechtigungen (leads:read, deals:write, etc.)
- API-Key Verwaltung in Settings > API Integrationen

---

## VISUELLER WORKFLOW-EDITOR (19.12.2025) - NEU!

### Uebersicht
Ein vollstaendiger visueller Workflow-Editor im Stil von n8n/Make.com/Zapier.
Basiert auf **@xyflow/react** (ReactFlow v12).

### Features
- [x] Drag & Drop Node-Editor
- [x] 4 Node-Typen: Trigger, Action, Condition, Delay
- [x] Professionelles Node-Design mit Gradient-Headern
- [x] Linke Sidebar mit verfuegbaren Nodes
- [x] Rechte Sidebar fuer Node-Konfiguration
- [x] Verbindungen zwischen Nodes (Edges)
- [x] Auto-Save mit Debounce
- [x] Workflow ausfuehren (manuell)
- [x] Execution-Trace anzeigen
- [x] Demo-Workflow fuer alle Benutzer

### Komponenten-Struktur
```
src/components/workflow-editor/
├── workflow-editor.tsx          # Haupt-Editor mit ReactFlow
├── workflow-toolbar.tsx         # Toolbar (Speichern, Aktivieren, Ausfuehren)
├── nodes/
│   ├── index.ts                 # Node-Registry
│   ├── trigger-node.tsx         # Trigger-Node (gruen)
│   ├── action-node.tsx          # Action-Node (blau)
│   ├── condition-node.tsx       # Bedingung-Node (orange)
│   └── delay-node.tsx           # Verzoegerung-Node (grau)
├── panels/
│   ├── node-palette.tsx         # Linke Sidebar - verfuegbare Nodes
│   └── node-config-panel.tsx    # Rechte Sidebar - Node-Konfiguration
└── utils/
    └── node-definitions.ts      # Trigger/Action Definitionen
```

### API-Routen
- `/api/workflows` - GET (Liste), POST (erstellen)
- `/api/workflows/[workflowId]` - GET, PATCH, DELETE
- `/api/workflows/[workflowId]/execute` - POST (manuell ausfuehren), GET (History)
- `/api/workflows/template` - POST (Demo erstellen), GET (Demo pruefen)

### Workflow-Engine
`src/lib/workflow/engine.ts`
- Fuehrt Workflows schrittweise aus
- Folgt den Node-Verbindungen
- Unterstuetzt Bedingungen (If/Else)
- Speichert Execution-Trace in DB
- Actions werden tatsaechlich ausgefuehrt (Notifications, Reminders, Tasks)

### Verfuegbare Trigger
| SubType | Beschreibung |
|---------|-------------|
| MANUAL | Manueller Start |
| DEAL_CREATED | Neuer Deal erstellt |
| STAGE_CHANGED | Stage gewechselt |
| NO_ACTIVITY | Keine Aktivitaet seit X Tagen |
| EMAIL_OPENED | E-Mail geoeffnet |
| EMAIL_NOT_OPENED | E-Mail nicht geoeffnet |
| EMAIL_CLICKED | Link geklickt |
| TASK_OVERDUE | Aufgabe ueberfaellig |
| MEETING_SCHEDULED | Meeting geplant |
| MEETING_COMPLETED | Meeting abgeschlossen |
| CALL_COMPLETED | Anruf abgeschlossen |

### Verfuegbare Actions
| SubType | Beschreibung | Implementiert |
|---------|-------------|---------------|
| SEND_EMAIL | E-Mail senden | Simuliert |
| CREATE_TASK | Aufgabe erstellen | Ja |
| CREATE_REMINDER | Erinnerung erstellen | Ja |
| MOVE_STAGE | Deal-Stage aendern | Ja |
| ADD_NOTE | Notiz hinzufuegen | Ja |
| NOTIFY_USER | Benachrichtigung senden | Ja |

### Demo-Workflow
Automatisch fuer alle Benutzer erstellt:
1. **Trigger**: Manueller Start
2. **Action 1**: Benachrichtigung senden ("Workflow gestartet!")
3. **Action 2**: Erinnerung in 5 Minuten erstellen

### Database Schema (Prisma)
```prisma
model Workflow {
  id             String   @id @default(cuid())
  userId         String
  name           String
  description    String?
  isActive       Boolean  @default(false)
  viewport       Json     @default("{\"x\": 0, \"y\": 0, \"zoom\": 1}")
  executionCount Int      @default(0)
  lastExecutedAt DateTime?
  pipelineId     String?
  nodes          WorkflowNode[]
  edges          WorkflowEdge[]
  executions     WorkflowExecution[]
}

model WorkflowNode {
  id         String           @id @default(cuid())
  workflowId String
  nodeType   WorkflowNodeType // TRIGGER, ACTION, CONDITION, DELAY
  subType    String
  label      String?
  positionX  Float
  positionY  Float
  config     Json
}

model WorkflowEdge {
  id           String  @id @default(cuid())
  workflowId   String
  sourceNodeId String
  targetNodeId String
  sourceHandle String? // "true"/"false" fuer Conditions
  targetHandle String?
}

model WorkflowExecution {
  id          String    @id @default(cuid())
  workflowId  String
  status      String    // "running", "completed", "failed"
  trace       Json      // Array mit allen Schritten
  startedAt   DateTime
  completedAt DateTime?
}
```

### Build-Hinweise
```bash
# Nach Aenderungen am Workflow-Editor:
npx next build
cp -r .next/static .next/standalone/.next/
cp -r .next/server .next/standalone/.next/
pm2 restart leadtool
```

### Neue NPM-Pakete
- `@xyflow/react` - ReactFlow v12 fuer Node-basierte UIs

---

---

## KAMPAGNEN-UI (22.12.2025) - NEU!

### Uebersicht
Vollstaendige UI fuer E-Mail-Marketing-Kampagnen mit Sequences, Empfaengerverwaltung und Statistiken.

### Neue Seiten
- `/campaigns` - Kampagnen-Uebersicht mit Stats
- `/campaigns/[id]` - Kampagnen-Detail mit Tabs

### Neue Komponenten
```
src/app/(dashboard)/campaigns/
├── page.tsx                     # Kampagnen-Liste
└── [campaignId]/
    └── page.tsx                 # Kampagnen-Detail

src/components/campaigns/
├── create-campaign-dialog.tsx   # Neue Kampagne erstellen
├── sequence-editor.tsx          # E-Mail-Sequence Editor
├── recipient-manager.tsx        # Empfaenger verwalten
├── campaign-stats.tsx           # Statistiken
└── campaign-settings.tsx        # Einstellungen
```

### Features
- **Kampagnen-Uebersicht**: Liste aller Kampagnen mit Status, Statistiken
- **Kampagnen-Builder**: Erstellen mit E-Mail-Konten-Auswahl, Limits, Zeitplan
- **Sequence-Editor**: E-Mail-Schritte hinzufuegen/bearbeiten mit Spintax-Vorschau
- **Empfaenger-Verwaltung**: Manuell hinzufuegen oder aus Projekten importieren
- **Statistiken**: Oeffnungsrate, Klickrate, Antwortrate, Bounces
- **Einstellungen**: Alle Kampagnen-Parameter bearbeitbar

### Naechste Schritte (Phase 2 des Email-Plans)
1. Kampagnen-Versand-Scheduler (Cron Job)
2. Tracking-Pixel und Link-Wrapper
3. Reply-Detection via IMAP

---

*Erstellt am 18.12.2025 um ca. 01:30 Uhr*
*Phase 1 abgeschlossen: 18.12.2025*
*Phase 2 gestartet: 18.12.2025*
*Workflow-Editor hinzugefuegt: 19.12.2025*
*Phase 2 abgeschlossen: 20.12.2025 (IMAP, Call Scripts, Note Templates)*
*Kampagnen-UI hinzugefuegt: 22.12.2025*
