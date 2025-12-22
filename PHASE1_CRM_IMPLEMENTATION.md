# Phase 1: Kern-CRM Features Implementation

## Projektkontext

**Projekt:** LeadTool CRM (https://performanty.de)
**Tech Stack:** Next.js 16 + React 19 + TypeScript + PostgreSQL + Prisma + Tailwind + Radix UI
**Bestehende Struktur:** Notion-ähnliche Tabellen mit Projekten → Tabellen → Zeilen → Zellen
**Ziel:** Erweitern um echte CRM-Funktionalitäten

---

## PHASE 1 FEATURES

### 1. PIPELINE / KANBAN VIEW
### 2. AKTIVITÄTEN & TASKS
### 3. ERINNERUNGEN / FOLLOW-UPS
### 4. KONTAKT-HISTORIE

---

# 1. PIPELINE / KANBAN VIEW

## 1.1 Konzept

Eine visuelle Kanban-Board Ansicht für Leads mit Drag & Drop zwischen Stages.

**Default Pipeline Stages:**
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│    NEU      │  │  KONTAKT    │  │   ANGEBOT   │  │ VERHANDLUNG │  │   GEWONNEN  │
│   (Lead)    │→ │  AUFGEBAUT  │→ │   GESENDET  │→ │             │→ │   (Kunde)   │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
                                                                    ┌─────────────┐
                                                                    │  VERLOREN   │
                                                                    └─────────────┘
```

## 1.2 Datenmodell (Prisma Schema Erweiterungen)

```prisma
// Pipeline Definition
model Pipeline {
  id        String   @id @default(cuid())
  projectId String
  name      String
  isDefault Boolean  @default(false)

  project Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  stages  PipelineStage[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([projectId])
  @@map("pipelines")
}

// Pipeline Stages (Spalten im Kanban)
model PipelineStage {
  id         String @id @default(cuid())
  pipelineId String
  name       String
  color      String @default("#6B7280") // Gray als Default
  position   Int

  // Stage-Typ für spezielle Behandlung
  stageType  StageType @default(OPEN)

  // Automatisierung
  autoMoveAfterDays Int?     // Auto-move wenn keine Aktivität

  pipeline Pipeline    @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
  deals    Deal[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([pipelineId])
  @@map("pipeline_stages")
}

enum StageType {
  OPEN       // Normale offene Stage
  WON        // Gewonnen
  LOST       // Verloren
}

// Deal (Lead in der Pipeline)
model Deal {
  id        String   @id @default(cuid())
  rowId     String   @unique  // Verknüpfung zur bestehenden Row
  stageId   String

  // Deal-spezifische Daten
  value         Float?    // Geschätzter Wert in EUR
  currency      String    @default("EUR")
  probability   Int       @default(50) // Abschlusswahrscheinlichkeit 0-100%
  expectedClose DateTime? // Erwartetes Abschlussdatum

  // Position in der Stage (für Sortierung)
  position   Int

  // Timestamps
  stageChangedAt DateTime @default(now())
  wonAt          DateTime?
  lostAt         DateTime?
  lostReason     String?

  row   Row           @relation(fields: [rowId], references: [id], onDelete: Cascade)
  stage PipelineStage @relation(fields: [stageId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([stageId])
  @@index([rowId])
  @@map("deals")
}
```

## 1.3 API Endpoints

```
GET    /api/projects/[projectId]/pipelines          - Alle Pipelines eines Projekts
POST   /api/projects/[projectId]/pipelines          - Neue Pipeline erstellen
GET    /api/pipelines/[pipelineId]                  - Pipeline mit Stages & Deals
PATCH  /api/pipelines/[pipelineId]                  - Pipeline bearbeiten
DELETE /api/pipelines/[pipelineId]                  - Pipeline löschen

POST   /api/pipelines/[pipelineId]/stages           - Neue Stage hinzufügen
PATCH  /api/pipelines/stages/[stageId]              - Stage bearbeiten
DELETE /api/pipelines/stages/[stageId]              - Stage löschen
POST   /api/pipelines/[pipelineId]/stages/reorder   - Stages neu ordnen

POST   /api/deals                                    - Deal erstellen (Row → Pipeline)
PATCH  /api/deals/[dealId]                          - Deal bearbeiten
PATCH  /api/deals/[dealId]/move                     - Deal in andere Stage verschieben
DELETE /api/deals/[dealId]                          - Deal aus Pipeline entfernen
POST   /api/deals/bulk-move                         - Mehrere Deals verschieben
```

## 1.4 UI Komponenten

```
src/components/pipeline/
├── pipeline-board.tsx           # Hauptkomponente (Kanban Board)
├── pipeline-stage.tsx           # Einzelne Stage/Spalte
├── pipeline-card.tsx            # Deal-Karte in der Stage
├── pipeline-card-skeleton.tsx   # Loading State
├── add-stage-dialog.tsx         # Stage hinzufügen
├── edit-stage-dialog.tsx        # Stage bearbeiten
├── deal-quick-add.tsx           # Schnell Deal erstellen
├── deal-details-sheet.tsx       # Deal Details Sidebar
├── pipeline-header.tsx          # Header mit Stats
├── pipeline-filters.tsx         # Filter (Value, Probability, etc.)
├── stage-settings-popover.tsx   # Stage Einstellungen
└── won-lost-dialog.tsx          # Dialog für Won/Lost mit Grund
```

## 1.5 Features der Pipeline View

**Drag & Drop:**
- Deals zwischen Stages verschieben (dnd-kit)
- Stages neu anordnen
- Optimistic Updates

**Deal-Karte zeigt:**
- Firmenname / Kontaktname
- Deal-Wert (€)
- Erwartetes Abschlussdatum
- Wahrscheinlichkeit (farbiger Balken)
- Tage in aktueller Stage
- Nächste Aktivität (falls vorhanden)
- Quick Actions (Anruf, E-Mail, Task)

**Stage Header zeigt:**
- Stage Name & Farbe
- Anzahl Deals
- Gesamtwert der Deals in Stage
- Durchschnittliche Verweildauer

**Pipeline Header zeigt:**
- Gesamtwert aller offenen Deals
- Gewichteter Pipeline-Wert (Wert × Wahrscheinlichkeit)
- Conversion Rate pro Stage
- Anzahl Deals pro Stage (Mini-Chart)

**Filter & Sortierung:**
- Nach Wert (aufsteigend/absteigend)
- Nach Datum (erstellt, geändert, erwartet)
- Nach Wahrscheinlichkeit
- Nach zugewiesenem User (später)
- Zeitraum-Filter (Diese Woche, Monat, Quartal)

---

# 2. AKTIVITÄTEN & TASKS

## 2.1 Konzept

System zum Tracken aller Interaktionen mit Leads/Deals und zum Erstellen von Aufgaben.

**Aktivitätstypen:**
- 📞 Anruf (geplant, durchgeführt, nicht erreicht)
- 📧 E-Mail (gesendet, empfangen)
- 📅 Meeting (geplant, durchgeführt, abgesagt)
- 📝 Notiz
- ✅ Task (To-Do)
- 📄 Dokument (hochgeladen, geteilt)
- 🔄 Status-Änderung (automatisch)
- 💬 Kommentar

## 2.2 Datenmodell

```prisma
enum ActivityType {
  CALL
  EMAIL
  MEETING
  NOTE
  TASK
  DOCUMENT
  STATUS_CHANGE
  COMMENT
  DEAL_CREATED
  DEAL_WON
  DEAL_LOST
  STAGE_CHANGED
}

enum ActivityStatus {
  PLANNED     // Geplant
  COMPLETED   // Erledigt
  CANCELLED   // Abgesagt
  MISSED      // Verpasst (Anruf nicht erreicht)
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model Activity {
  id     String       @id @default(cuid())
  rowId  String       // Verknüpfung zum Lead/Deal
  userId String       // Wer hat es erstellt

  type   ActivityType
  status ActivityStatus @default(COMPLETED)

  // Inhalt
  title       String
  description String?   @db.Text

  // Für Tasks
  priority    TaskPriority?
  dueDate     DateTime?
  completedAt DateTime?

  // Für Anrufe
  callDuration  Int?      // Sekunden
  callOutcome   String?   // Ergebnis des Anrufs

  // Für Meetings
  meetingLocation String?
  meetingLink     String?  // Zoom/Teams Link
  meetingDuration Int?     // Minuten
  attendees       Json?    // Array von E-Mails

  // Für E-Mails
  emailSubject String?
  emailTo      String?
  emailCc      String?

  // Für Dokumente
  documentUrl  String?
  documentName String?
  documentType String?

  // Automatische Aktivitäten
  isAutomatic Boolean @default(false)
  metadata    Json    @default("{}")

  row  Row  @relation(fields: [rowId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])

  // Erinnerungen für diese Aktivität
  reminders Reminder[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([rowId])
  @@index([userId])
  @@index([type])
  @@index([status])
  @@index([dueDate])
  @@index([rowId, createdAt])
  @@map("activities")
}
```

## 2.3 API Endpoints

```
GET    /api/activities                          - Alle Aktivitäten (mit Filter)
GET    /api/activities/today                    - Heutige Aktivitäten
GET    /api/activities/overdue                  - Überfällige Tasks
POST   /api/activities                          - Aktivität erstellen
GET    /api/activities/[activityId]             - Einzelne Aktivität
PATCH  /api/activities/[activityId]             - Aktivität bearbeiten
DELETE /api/activities/[activityId]             - Aktivität löschen
POST   /api/activities/[activityId]/complete    - Task als erledigt markieren

GET    /api/rows/[rowId]/activities             - Aktivitäten eines Leads
GET    /api/rows/[rowId]/activities/timeline    - Timeline-Format

GET    /api/dashboard/activities                - Dashboard Widget Daten
```

## 2.4 UI Komponenten

```
src/components/activities/
├── activity-list.tsx            # Liste aller Aktivitäten
├── activity-item.tsx            # Einzelne Aktivität
├── activity-timeline.tsx        # Timeline-Ansicht
├── activity-filters.tsx         # Filter (Typ, Datum, Status)
├── create-activity-dialog.tsx   # Neue Aktivität
├── edit-activity-dialog.tsx     # Aktivität bearbeiten
├── quick-activity-buttons.tsx   # Schnell-Buttons (Anruf, E-Mail, etc.)
├── task-checkbox.tsx            # Task abhaken
├── activity-icon.tsx            # Icons pro Typ
├── call-log-form.tsx            # Anruf-Details Form
├── meeting-form.tsx             # Meeting-Details Form
├── email-form.tsx               # E-Mail Form
└── activity-badge.tsx           # Badge mit Anzahl
```

## 2.5 Features

**Activity Stream:**
- Chronologische Liste aller Aktivitäten
- Gruppiert nach Datum
- Infinite Scroll
- Filter nach Typ, Status, Datum

**Quick Actions:**
- Ein-Klick Anruf loggen
- Schnelle Notiz erstellen
- Task hinzufügen
- E-Mail Entwurf

**Task Management:**
- Überfällige Tasks hervorgehoben
- Prioritäts-Sortierung
- Batch-Complete
- Snooze (auf morgen verschieben)

---

# 3. ERINNERUNGEN / FOLLOW-UPS

## 3.1 Konzept

System für zeitbasierte Erinnerungen mit verschiedenen Benachrichtigungskanälen.

**Erinnerungstypen:**
- Vor einer Aktivität (15min, 1h, 1 Tag)
- Follow-up nach Aktivität
- Wiederkehrende Erinnerungen
- Deadline-Erinnerungen

## 3.2 Datenmodell

```prisma
enum ReminderType {
  BEFORE_ACTIVITY  // X Minuten/Stunden vor
  FOLLOW_UP        // Nach einer Aktivität
  CUSTOM           // Frei gewählt
  RECURRING        // Wiederkehrend
  DEADLINE         // Deadline-basiert
}

enum ReminderChannel {
  IN_APP           // Browser Notification + In-App
  EMAIL            // E-Mail
  BOTH             // Beides
}

enum ReminderStatus {
  PENDING          // Noch nicht gesendet
  SENT             // Gesendet
  DISMISSED        // Weggeklickt
  SNOOZED          // Zurückgestellt
  COMPLETED        // Erledigt (Aktion durchgeführt)
}

model Reminder {
  id         String   @id @default(cuid())
  userId     String
  activityId String?  // Optional: Verknüpfung zu Aktivität
  rowId      String?  // Optional: Verknüpfung zu Lead/Deal

  type    ReminderType
  channel ReminderChannel @default(IN_APP)
  status  ReminderStatus  @default(PENDING)

  // Wann erinnern
  remindAt DateTime

  // Inhalt
  title   String
  message String?

  // Für wiederkehrende Erinnerungen
  isRecurring     Boolean @default(false)
  recurringRule   String? // RRULE Format (iCal)
  nextOccurrence  DateTime?

  // Snooze
  snoozedUntil DateTime?
  snoozeCount  Int      @default(0)

  // Tracking
  sentAt      DateTime?
  dismissedAt DateTime?
  completedAt DateTime?

  user     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  activity Activity? @relation(fields: [activityId], references: [id], onDelete: Cascade)
  row      Row?      @relation(fields: [rowId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, status])
  @@index([userId, remindAt])
  @@index([status, remindAt])
  @@map("reminders")
}

// Benutzer-Einstellungen für Erinnerungen erweitern
// In UserSettings hinzufügen:
model UserSettings {
  // ... bestehende Felder ...

  // Reminder Settings
  defaultReminderChannel  ReminderChannel @default(IN_APP)
  defaultReminderBefore   Int            @default(15)  // Minuten

  // Quiet Hours (keine Notifications)
  quietHoursEnabled Boolean @default(false)
  quietHoursStart   String  @default("22:00")
  quietHoursEnd     String  @default("08:00")

  // Arbeitstage für Erinnerungen
  workDays          Json    @default("[1,2,3,4,5]") // Mo-Fr
}
```

## 3.3 API Endpoints

```
GET    /api/reminders                      - Alle Erinnerungen
GET    /api/reminders/upcoming             - Anstehende (nächste 24h)
GET    /api/reminders/due                  - Fällige (jetzt)
POST   /api/reminders                      - Erinnerung erstellen
PATCH  /api/reminders/[id]                 - Bearbeiten
DELETE /api/reminders/[id]                 - Löschen
POST   /api/reminders/[id]/dismiss         - Wegklicken
POST   /api/reminders/[id]/snooze          - Snooze (15min, 1h, morgen)
POST   /api/reminders/[id]/complete        - Als erledigt markieren

GET    /api/rows/[rowId]/reminders         - Erinnerungen für einen Lead
```

## 3.4 Background Job für Erinnerungen

```typescript
// src/lib/jobs/reminder-processor.ts

// Läuft alle 1 Minute via Cron/PM2
async function processReminders() {
  // 1. Fällige Erinnerungen finden
  const dueReminders = await prisma.reminder.findMany({
    where: {
      status: 'PENDING',
      remindAt: { lte: new Date() }
    },
    include: { user: true, row: true, activity: true }
  });

  // 2. Für jede Erinnerung:
  for (const reminder of dueReminders) {
    // - In-App Notification erstellen
    // - E-Mail senden (falls aktiviert)
    // - Status auf SENT setzen
    // - Bei recurring: Nächste Occurrence berechnen
  }
}
```

## 3.5 UI Komponenten

```
src/components/reminders/
├── reminder-bell.tsx            # Bell Icon mit Badge (Header)
├── reminder-dropdown.tsx        # Dropdown mit anstehenden
├── reminder-list.tsx            # Liste aller Erinnerungen
├── reminder-item.tsx            # Einzelne Erinnerung
├── create-reminder-dialog.tsx   # Neue Erinnerung
├── snooze-popover.tsx           # Snooze Optionen
├── reminder-settings.tsx        # Einstellungen
└── quick-reminder-button.tsx    # Schnell-Erinnerung setzen
```

## 3.6 Features

**Erinnerungs-Center:**
- Bell Icon im Header mit Badge
- Dropdown mit anstehenden Erinnerungen
- Snooze-Optionen (15min, 1h, 3h, morgen, nächste Woche)
- Dismiss oder Complete

**Smart Reminders:**
- Automatisch bei Task-Erstellung
- Follow-up Vorschläge nach Anrufen
- "Stale Deal" Warnung (keine Aktivität seit X Tagen)

**Browser Notifications:**
- Web Push Notifications
- Permission Request beim ersten Mal
- Fallback auf In-App

---

# 4. KONTAKT-HISTORIE

## 4.1 Konzept

Eine vollständige Timeline aller Interaktionen und Änderungen für jeden Lead/Deal.

## 4.2 Datenmodell

```prisma
enum HistoryEventType {
  // Manuelle Ereignisse
  CREATED
  UPDATED
  DELETED

  // Aktivitäten
  CALL_LOGGED
  EMAIL_SENT
  EMAIL_RECEIVED
  MEETING_SCHEDULED
  MEETING_COMPLETED
  NOTE_ADDED
  TASK_CREATED
  TASK_COMPLETED
  DOCUMENT_UPLOADED

  // Pipeline
  DEAL_CREATED
  STAGE_CHANGED
  DEAL_WON
  DEAL_LOST
  VALUE_CHANGED
  PROBABILITY_CHANGED

  // Daten
  FIELD_CHANGED
  SCRAPED
  MERGED

  // System
  REMINDER_SENT
  AUTO_MOVED
  IMPORTED
}

model ContactHistory {
  id     String @id @default(cuid())
  rowId  String
  userId String? // Null bei System-Events

  eventType HistoryEventType

  // Was wurde geändert
  fieldName  String?  // z.B. "email", "stage", "value"
  oldValue   Json?    // Vorheriger Wert
  newValue   Json?    // Neuer Wert

  // Kontext
  title       String   // Kurzbeschreibung
  description String?  // Details
  metadata    Json     @default("{}")

  // Verknüpfungen
  activityId String?
  dealId     String?

  row      Row       @relation(fields: [rowId], references: [id], onDelete: Cascade)
  user     User?     @relation(fields: [userId], references: [id])
  activity Activity? @relation(fields: [activityId], references: [id])

  createdAt DateTime @default(now())

  @@index([rowId])
  @@index([rowId, createdAt])
  @@index([eventType])
  @@map("contact_history")
}
```

## 4.3 Automatische History-Einträge

```typescript
// src/lib/history/tracker.ts

// Middleware/Hook bei jeder Änderung
async function trackChange(params: {
  rowId: string;
  userId?: string;
  eventType: HistoryEventType;
  fieldName?: string;
  oldValue?: any;
  newValue?: any;
  title: string;
  description?: string;
}) {
  await prisma.contactHistory.create({
    data: {
      rowId: params.rowId,
      userId: params.userId,
      eventType: params.eventType,
      fieldName: params.fieldName,
      oldValue: params.oldValue,
      newValue: params.newValue,
      title: params.title,
      description: params.description,
    }
  });
}

// Beispiel-Nutzung in Cell Update:
// trackChange({
//   rowId: cell.rowId,
//   userId: session.user.id,
//   eventType: 'FIELD_CHANGED',
//   fieldName: column.name,
//   oldValue: cell.value,
//   newValue: newValue,
//   title: `${column.name} geändert`,
// });
```

## 4.4 API Endpoints

```
GET /api/rows/[rowId]/history              - Vollständige Historie
GET /api/rows/[rowId]/history/summary      - Zusammenfassung (letzte Aktivität, etc.)
GET /api/rows/[rowId]/timeline             - Kombinierte Timeline (History + Activities)
```

## 4.5 UI Komponenten

```
src/components/history/
├── contact-timeline.tsx         # Hauptkomponente
├── timeline-item.tsx            # Einzelner Eintrag
├── timeline-filters.tsx         # Filter nach Event-Typ
├── timeline-group.tsx           # Gruppiert nach Datum
├── history-icon.tsx             # Icon pro Event-Typ
├── field-change-display.tsx     # Zeigt Änderungen (vorher → nachher)
└── timeline-skeleton.tsx        # Loading State
```

## 4.6 Features

**Timeline View:**
- Chronologisch (neueste zuerst)
- Gruppiert nach Datum
- Farbcodiert nach Event-Typ
- Infinite Scroll

**Filter:**
- Nach Event-Typ (Anrufe, E-Mails, Änderungen, etc.)
- Nach Zeitraum
- Nach User

**Darstellung:**
- Icon + Titel + Timestamp
- Bei Änderungen: "Email: alt@mail.de → neu@mail.de"
- Verknüpfung zur Aktivität (klickbar)
- User Avatar bei manuellen Änderungen

---

# 5. UI/UX INTEGRATION

## 5.1 Navigation

```
Header
├── Logo
├── Search (Global)
├── + Neu (Dropdown: Lead, Deal, Task, etc.)
├── Reminder Bell 🔔 (mit Badge)
├── Notifications 🔔
└── User Menu

Sidebar
├── Dashboard
├── Pipeline (NEU)
├── Leads (Tabellen-View)
├── Aufgaben (NEU) ← Alle Tasks
├── Kalender (später)
├── ---
├── Projekte
│   └── [Projekt]
│       ├── Übersicht
│       ├── Pipeline ← Projekt-spezifisch
│       └── Tabellen
└── Einstellungen
```

## 5.2 Lead/Deal Detail View

```
┌─────────────────────────────────────────────────────────────────┐
│ [←] Firmenname GmbH                           [⭐] [···] [×]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────┐  ┌──────────────────────────┐ │
│  │ KONTAKT INFO                │  │ DEAL INFO                │ │
│  │ Max Mustermann              │  │ Stage: Angebot gesendet  │ │
│  │ 📧 max@firma.de             │  │ Wert: €25.000            │ │
│  │ 📞 +49 123 456789           │  │ Wahrsch.: 60%            │ │
│  │ 🏢 Musterstraße 1, Berlin   │  │ Erwartet: 15.01.2026     │ │
│  └─────────────────────────────┘  └──────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ QUICK ACTIONS                                               ││
│  │ [📞 Anruf] [📧 E-Mail] [📅 Meeting] [✅ Task] [📝 Notiz]   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ TIMELINE                                    [Filter ▾]      ││
│  │─────────────────────────────────────────────────────────────││
│  │ Heute                                                       ││
│  │ 14:30  📞 Anruf (3 min) - Angebot besprochen      [Max M.] ││
│  │ 10:15  📧 E-Mail gesendet - Angebot PDF           [Max M.] ││
│  │                                                             ││
│  │ Gestern                                                     ││
│  │ 16:00  🔄 Stage: Kontakt → Angebot               [System]  ││
│  │ 15:45  💰 Wert: €0 → €25.000                     [Max M.]  ││
│  │ 09:00  📞 Anruf (5 min) - Erstgespräch           [Max M.]  ││
│  │                                                             ││
│  │ 12.12.2025                                                  ││
│  │ 11:00  ➕ Deal erstellt                          [System]  ││
│  │ 10:30  🔍 Gescraped - 3 Seiten                   [System]  ││
│  │ 10:30  ➕ Lead erstellt                          [Max M.]  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ANSTEHEND                                                   ││
│  │ 🔔 Morgen 10:00 - Follow-up Anruf                          ││
│  │ ✅ 20.12. - Angebot nachfassen (HIGH)                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## 5.3 Keyboard Shortcuts

```
Global:
  Cmd/Ctrl + K     → Quick Search
  Cmd/Ctrl + N     → Neuer Lead
  Cmd/Ctrl + T     → Neuer Task
  Cmd/Ctrl + .     → Command Palette

Pipeline:
  ←/→              → Stage wechseln
  ↑/↓              → Deal auswählen
  Enter            → Deal öffnen
  D                → Deal Details
  M                → Move Dialog
  W                → Als Won markieren
  L                → Als Lost markieren

Liste:
  j/k              → Navigation
  x                → Auswählen
  Enter            → Öffnen
  e                → Bearbeiten
  c                → Anruf loggen
  t                → Task erstellen
```

---

# 6. DATENBANK MIGRATION STRATEGIE

## 6.1 Migration Reihenfolge

```bash
# 1. Neue Tabellen erstellen (non-breaking)
prisma migrate dev --name add_pipeline_tables
prisma migrate dev --name add_activity_tables
prisma migrate dev --name add_reminder_tables
prisma migrate dev --name add_history_tables

# 2. Relations zu bestehenden Tabellen
prisma migrate dev --name add_relations

# 3. Default Pipeline für bestehende Projekte erstellen
npx ts-node scripts/create-default-pipelines.ts
```

## 6.2 Bestehende Daten

- Bestehende Rows bleiben unverändert
- Deals werden optional erstellt (Row kann ohne Deal existieren)
- Default Pipeline wird pro Projekt automatisch erstellt

---

# 7. IMPLEMENTATION PLAN

## Phase 1a: Pipeline/Kanban (Woche 1-2)

```
Tag 1-2:
- [ ] Prisma Schema erweitern (Pipeline, Stage, Deal)
- [ ] Migration durchführen
- [ ] API Endpoints: Pipelines CRUD
- [ ] API Endpoints: Stages CRUD

Tag 3-4:
- [ ] API Endpoints: Deals CRUD
- [ ] Default Pipeline bei Projekt-Erstellung
- [ ] Migration Script für bestehende Projekte

Tag 5-7:
- [ ] UI: Pipeline Board Grundstruktur
- [ ] UI: Stage Komponenten
- [ ] UI: Deal Cards

Tag 8-10:
- [ ] Drag & Drop mit dnd-kit
- [ ] Stage Header mit Stats
- [ ] Pipeline Header mit Gesamtstats

Tag 11-12:
- [ ] Won/Lost Dialoge
- [ ] Stage Einstellungen
- [ ] Filter & Sortierung

Tag 13-14:
- [ ] Integration in Navigation
- [ ] Tests & Bugfixes
- [ ] Performance Optimierung
```

## Phase 1b: Aktivitäten & Tasks (Woche 3-4)

```
Tag 1-2:
- [ ] Prisma Schema (Activity)
- [ ] Migration
- [ ] API Endpoints CRUD

Tag 3-4:
- [ ] UI: Activity List
- [ ] UI: Timeline View
- [ ] UI: Create/Edit Dialogs

Tag 5-7:
- [ ] Quick Action Buttons
- [ ] Call/Meeting/Email Forms
- [ ] Task Checkbox & Priority

Tag 8-10:
- [ ] Activity Stream auf Dashboard
- [ ] Overdue Tasks Widget
- [ ] Today's Activities

Tag 11-14:
- [ ] Integration in Deal Details
- [ ] Batch Actions
- [ ] Tests
```

## Phase 1c: Erinnerungen (Woche 5)

```
Tag 1-2:
- [ ] Prisma Schema (Reminder)
- [ ] Migration
- [ ] API Endpoints

Tag 3-4:
- [ ] Background Job Setup
- [ ] E-Mail Notifications
- [ ] In-App Notifications

Tag 5-7:
- [ ] UI: Reminder Bell
- [ ] UI: Dropdown & List
- [ ] Snooze Functionality

Tag 8-10:
- [ ] Settings Page
- [ ] Browser Push Notifications
- [ ] Tests
```

## Phase 1d: Kontakt-Historie (Woche 6)

```
Tag 1-3:
- [ ] Prisma Schema (ContactHistory)
- [ ] Migration
- [ ] Auto-Tracking Integration

Tag 4-7:
- [ ] UI: Timeline Component
- [ ] Integration in Lead/Deal Detail
- [ ] Filter & Search

Tag 8-10:
- [ ] Field Change Tracking
- [ ] Performance (Pagination)
- [ ] Tests
```

---

# 8. TECHNISCHE DETAILS

## 8.1 State Management

Für komplexe Echtzeit-Daten:

```typescript
// Option 1: TanStack Query (Empfohlen)
const { data: pipeline } = useQuery({
  queryKey: ['pipeline', pipelineId],
  queryFn: () => fetchPipeline(pipelineId),
});

// Option 2: Zustand für lokalen UI State
const usePipelineStore = create((set) => ({
  selectedDeal: null,
  setSelectedDeal: (deal) => set({ selectedDeal: deal }),
}));
```

## 8.2 Optimistic Updates

```typescript
const moveDeal = useMutation({
  mutationFn: (data) => api.deals.move(data),
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['pipeline', pipelineId]);

    // Snapshot previous value
    const previous = queryClient.getQueryData(['pipeline', pipelineId]);

    // Optimistically update
    queryClient.setQueryData(['pipeline', pipelineId], (old) => ({
      ...old,
      // Update deal position
    }));

    return { previous };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    queryClient.setQueryData(['pipeline', pipelineId], context.previous);
  },
});
```

## 8.3 Real-time Updates (Optional/Später)

```typescript
// Server-Sent Events oder WebSocket für Live-Updates
// Wenn User A einen Deal verschiebt, sieht User B es sofort
```

---

# 9. TESTING STRATEGIE

## Unit Tests
- Utility Functions
- API Route Handlers
- Prisma Queries

## Integration Tests
- API Endpoint Tests
- Database Operations

## E2E Tests (Playwright)
- Pipeline Drag & Drop
- Activity Creation
- Reminder Flow

---

# 10. ERFOLGS-METRIKEN

Nach Implementation sollten folgende Szenarien funktionieren:

1. ✅ Neuer Lead wird in Pipeline "Neu" Stage angezeigt
2. ✅ Deal per Drag & Drop zwischen Stages verschieben
3. ✅ Anruf loggen mit Dauer und Ergebnis
4. ✅ Task erstellen mit Fälligkeitsdatum
5. ✅ Erinnerung für morgen 10:00 setzen
6. ✅ Erinnerung erscheint als Notification
7. ✅ Vollständige Timeline eines Leads sehen
8. ✅ Pipeline-Wert und Conversion Rate im Header
9. ✅ Überfällige Tasks auf Dashboard sehen
10. ✅ E-Mail direkt aus CRM senden (vorbereitet)

---

# NÄCHSTE SCHRITTE

1. **Sofort:** Prisma Schema erweitern
2. **Heute:** Migrations durchführen
3. **Diese Woche:** Pipeline API + Basic UI
4. **Investor Demo:** Kanban Board mit Drag & Drop zeigen

---

*Erstellt: 17.12.2025*
*Version: 1.0*
*Autor: Claude Code Assistant*
