"use client";

import { cn } from "@/lib/utils";
import {
  User,
  Shield,
  Bot,
  Key,
  Webhook,
  Bell,
  Phone,
  FileText,
  ChevronRight,
  Mail,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SettingsSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface SettingsGroup {
  title: string;
  sections: SettingsSection[];
}

const settingsGroups: SettingsGroup[] = [
  {
    title: "Konto",
    sections: [
      {
        id: "profile",
        label: "Profil",
        icon: User,
        description: "Name, E-Mail und Avatar",
      },
      {
        id: "security",
        label: "Sicherheit",
        icon: Shield,
        description: "Passwort und 2FA",
      },
    ],
  },
  {
    title: "Integrationen",
    sections: [
      {
        id: "ai",
        label: "KI-Anbieter",
        icon: Bot,
        description: "OpenAI, Anthropic, etc.",
      },
      {
        id: "inbound-email",
        label: "Inbound E-Mail",
        icon: Mail,
        description: "Echtzeit Reply-Detection",
      },
      {
        id: "api-keys",
        label: "API-Schlüssel",
        icon: Key,
        description: "Externe API-Zugänge",
      },
      {
        id: "webhooks",
        label: "Webhooks",
        icon: Webhook,
        description: "Event-Benachrichtigungen",
      },
    ],
  },
  {
    title: "Vorlagen",
    sections: [
      {
        id: "call-scripts",
        label: "Anruf-Scripts",
        icon: Phone,
        description: "Gesprächsleitfäden",
      },
      {
        id: "note-templates",
        label: "Notiz-Vorlagen",
        icon: FileText,
        description: "Vorlagen für Notizen",
      },
    ],
  },
  {
    title: "System",
    sections: [
      {
        id: "notifications",
        label: "Benachrichtigungen",
        icon: Bell,
        description: "E-Mail und Push",
      },
    ],
  },
];

interface SettingsLayoutProps {
  children: React.ReactNode;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export function SettingsLayout({
  children,
  activeSection,
  onSectionChange,
}: SettingsLayoutProps) {
  return (
    <div className="flex gap-6">
      {/* Settings Sidebar */}
      <aside className="w-64 flex-shrink-0">
        <ScrollArea className="h-[calc(100vh-12rem)]">
          <nav className="space-y-6 pr-4">
            {settingsGroups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.sections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                      <button
                        key={section.id}
                        onClick={() => onSectionChange(section.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <div className="flex-1 text-left">
                          <div className="font-medium">{section.label}</div>
                        </div>
                        {isActive && (
                          <ChevronRight className="h-4 w-4 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>
      </aside>

      {/* Settings Content */}
      <main className="flex-1 min-w-0">
        <div className="rounded-lg border bg-card p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export { settingsGroups };
