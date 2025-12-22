"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  Star,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmailAccountForm } from "@/components/email/email-account-form";
import { EmailTemplateForm } from "@/components/email/email-template-form";

interface EmailAccount {
  id: string;
  name: string;
  email: string;
  accountType: string;
  isDefault: boolean;
  isActive: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  imapUser: string | null;
  syncEnabled: boolean;
  signature: string | null;
  lastSyncAt: string | null;
  _count: { emails: number };
}

interface EmailTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  subject: string;
  bodyHtml: string;
  variables: string[];
  usageCount: number;
  lastUsedAt: string | null;
}

export function EmailSettingsForm() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [accountsRes, templatesRes] = await Promise.all([
        fetch("/api/email/accounts"),
        fetch("/api/email/templates"),
      ]);

      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data.accounts || []);
      }

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data.templates || []);
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error("Error loading email settings:", error);
      toast.error("Fehler beim Laden der E-Mail-Einstellungen");
    } finally {
      setLoading(false);
    }
  };

  const handleEditAccount = (account: EmailAccount) => {
    setSelectedAccount(account);
    setAccountFormOpen(true);
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setTemplateFormOpen(true);
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountId) return;

    try {
      const res = await fetch(`/api/email/accounts/${deleteAccountId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Fehler beim Loeschen");

      toast.success("E-Mail-Konto geloescht");
      setDeleteAccountId(null);
      loadData();
    } catch (error) {
      toast.error("Fehler beim Loeschen des Kontos");
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;

    try {
      const res = await fetch(`/api/email/templates/${deleteTemplateId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Fehler beim Loeschen");

      toast.success("Vorlage geloescht");
      setDeleteTemplateId(null);
      loadData();
    } catch (error) {
      toast.error("Fehler beim Loeschen der Vorlage");
    }
  };

  const handleSetDefault = async (accountId: string) => {
    try {
      const res = await fetch(`/api/email/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });

      if (!res.ok) throw new Error("Fehler beim Setzen als Standard");

      toast.success("Standardkonto geaendert");
      loadData();
    } catch (error) {
      toast.error("Fehler beim Aendern des Standardkontos");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Accounts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              E-Mail-Konten
            </CardTitle>
            <CardDescription>
              Verwalten Sie Ihre E-Mail-Konten fuer den Versand
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              setSelectedAccount(null);
              setAccountFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Konto hinzufuegen
          </Button>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine E-Mail-Konten eingerichtet</p>
              <p className="text-sm">Fuegen Sie ein Konto hinzu, um E-Mails senden zu koennen</p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{account.name}</span>
                        {account.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Standard
                          </Badge>
                        )}
                        {account.isActive ? (
                          <Badge variant="outline" className="text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Aktiv
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-gray-500">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inaktiv
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{account.email}</p>
                      {account.smtpHost && (
                        <p className="text-xs text-muted-foreground">
                          SMTP: {account.smtpHost}:{account.smtpPort}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {account._count.emails} E-Mails
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditAccount(account)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Bearbeiten
                        </DropdownMenuItem>
                        {!account.isDefault && (
                          <DropdownMenuItem onClick={() => handleSetDefault(account.id)}>
                            <Star className="mr-2 h-4 w-4" />
                            Als Standard setzen
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteAccountId(account.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Loeschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Templates */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              E-Mail-Vorlagen
            </CardTitle>
            <CardDescription>
              Vorlagen fuer haeufig verwendete E-Mails
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              setSelectedTemplate(null);
              setTemplateFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Vorlage erstellen
          </Button>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Noch keine E-Mail-Vorlagen erstellt</p>
              <p className="text-sm">Erstellen Sie Vorlagen fuer wiederkehrende E-Mails</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{template.name}</span>
                        {template.category && (
                          <Badge variant="outline" className="text-xs">
                            {template.category}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {template.subject}
                      </p>
                      {template.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{template.usageCount}x verwendet</span>
                        {template.variables.length > 0 && (
                          <span>{template.variables.length} Variablen</span>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditTemplate(template)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setDeleteTemplateId(template.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Loeschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Form Dialog */}
      <EmailAccountForm
        open={accountFormOpen}
        onOpenChange={setAccountFormOpen}
        account={selectedAccount}
        onSuccess={loadData}
      />

      {/* Template Form Dialog */}
      <EmailTemplateForm
        open={templateFormOpen}
        onOpenChange={setTemplateFormOpen}
        template={selectedTemplate}
        categories={categories}
        onSuccess={loadData}
      />

      {/* Delete Account Confirmation */}
      <AlertDialog open={!!deleteAccountId} onOpenChange={() => setDeleteAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>E-Mail-Konto loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Konto wird unwiderruflich geloescht. Gesendete E-Mails bleiben erhalten,
              aber Sie koennen ueber dieses Konto keine neuen E-Mails mehr senden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground">
              Loeschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Template Confirmation */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Vorlage wird unwiderruflich geloescht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} className="bg-destructive text-destructive-foreground">
              Loeschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
