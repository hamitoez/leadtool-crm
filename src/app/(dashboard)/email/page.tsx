"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Send,
  Inbox,
  Activity,
  Shield,
  ShieldCheck,
  ShieldX,
  AlertTriangle,
  TestTube,
  RefreshCw,
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
import { ComposeEmailDialog } from "@/components/email/compose-email-dialog";
import { EmailInbox } from "@/components/email/email-inbox";

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
  // Marketing fields
  dailyLimit: number;
  sentToday: number;
  sentTotal: number;
  healthScore: number;
  spfValid: boolean | null;
  dkimValid: boolean | null;
  dmarcValid: boolean | null;
  dnsCheckedAt: string | null;
  smtpVerified: boolean;
  imapVerified: boolean;
  lastVerifiedAt: string | null;
  verificationError: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
  bounceCount: number;
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

export default function EmailPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [accountFormOpen, setAccountFormOpen] = useState(false);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
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
      console.error("Error loading email data:", error);
      toast.error("Fehler beim Laden");
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
      const res = await fetch(`/api/email/accounts/${deleteAccountId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Loeschen");
      toast.success("E-Mail-Konto geloescht");
      setDeleteAccountId(null);
      loadData();
    } catch {
      toast.error("Fehler beim Loeschen des Kontos");
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;
    try {
      const res = await fetch(`/api/email/templates/${deleteTemplateId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Loeschen");
      toast.success("Vorlage geloescht");
      setDeleteTemplateId(null);
      loadData();
    } catch {
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
      if (!res.ok) throw new Error("Fehler");
      toast.success("Standardkonto geaendert");
      loadData();
    } catch {
      toast.error("Fehler beim Aendern");
    }
  };

  const [testingAccountId, setTestingAccountId] = useState<string | null>(null);
  const [dnsCheckingAccountId, setDnsCheckingAccountId] = useState<string | null>(null);

  const handleTestConnection = async (accountId: string, type: "smtp" | "imap") => {
    setTestingAccountId(accountId);
    try {
      const res = await fetch(`/api/email/accounts/${accountId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${type.toUpperCase()}-Verbindung erfolgreich!`);
        loadData();
      } else {
        toast.error(data.error || "Verbindungstest fehlgeschlagen");
      }
    } catch {
      toast.error("Fehler beim Testen der Verbindung");
    } finally {
      setTestingAccountId(null);
    }
  };

  const handleCheckDns = async (accountId: string) => {
    setDnsCheckingAccountId(accountId);
    try {
      const res = await fetch(`/api/email/accounts/${accountId}/verify-dns`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        const score = data.score;
        let message = `DNS-Score: ${score}/100`;
        if (data.results.spf.valid) message += " | SPF ✓";
        if (data.results.dkim.valid) message += " | DKIM ✓";
        if (data.results.dmarc.valid) message += " | DMARC ✓";
        toast.success(message);
        loadData();
      } else {
        toast.error(data.error || "DNS-Prüfung fehlgeschlagen");
      }
    } catch {
      toast.error("Fehler bei der DNS-Prüfung");
    } finally {
      setDnsCheckingAccountId(null);
    }
  };

  // Helper function to get health score color
  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getHealthScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-100 dark:bg-green-900/30";
    if (score >= 50) return "bg-yellow-100 dark:bg-yellow-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Mail className="h-8 w-8" />
            E-Mail
          </h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre E-Mail-Konten und Vorlagen
          </p>
        </div>
        <Button onClick={() => setComposeOpen(true)} disabled={accounts.length === 0}>
          <Send className="mr-2 h-4 w-4" />
          Neue E-Mail
        </Button>
      </div>

      <Tabs defaultValue="inbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-2">
            <Mail className="h-4 w-4" />
            Posteingang
          </TabsTrigger>
          <TabsTrigger value="accounts" className="gap-2">
            <Inbox className="h-4 w-4" />
            Konten ({accounts.length})
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Vorlagen ({templates.length})
          </TabsTrigger>
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox">
          <Card>
            <CardHeader>
              <CardTitle>Posteingang</CardTitle>
              <CardDescription>
                Alle empfangenen und gesendeten E-Mails
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailInbox />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accounts Tab */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>E-Mail-Konten</CardTitle>
                <CardDescription>
                  SMTP-Konten fuer den E-Mail-Versand
                </CardDescription>
              </div>
              <Button onClick={() => { setSelectedAccount(null); setAccountFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Konto hinzufuegen
              </Button>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Noch keine E-Mail-Konten</p>
                  <p className="text-sm">Fuegen Sie ein SMTP-Konto hinzu, um E-Mails senden zu koennen</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {accounts.map((account) => (
                    <div key={account.id} className={`p-4 border rounded-lg hover:bg-muted/50 transition-colors ${account.isBlocked ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : ''}`}>
                      {/* Top Row: Account Info + Actions */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getHealthScoreBg(account.healthScore)}`}>
                            <Activity className={`h-6 w-6 ${getHealthScoreColor(account.healthScore)}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-lg">{account.name}</span>
                              {account.isDefault && (
                                <Badge variant="secondary"><Star className="h-3 w-3 mr-1" />Standard</Badge>
                              )}
                              {account.isBlocked ? (
                                <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Blockiert</Badge>
                              ) : account.isActive ? (
                                <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Aktiv</Badge>
                              ) : (
                                <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Inaktiv</Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground">{account.email}</p>
                            {account.blockedReason && (
                              <p className="text-xs text-red-600">{account.blockedReason}</p>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditAccount(account)}>
                              <Pencil className="mr-2 h-4 w-4" />Bearbeiten
                            </DropdownMenuItem>
                            {!account.isDefault && (
                              <DropdownMenuItem onClick={() => handleSetDefault(account.id)}>
                                <Star className="mr-2 h-4 w-4" />Als Standard
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteAccountId(account.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />Loeschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Stats Row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                        {/* Health Score */}
                        <div className={`p-2 rounded-lg ${getHealthScoreBg(account.healthScore)}`}>
                          <div className="flex items-center gap-1.5">
                            <Activity className={`h-4 w-4 ${getHealthScoreColor(account.healthScore)}`} />
                            <span className="font-medium">Health</span>
                          </div>
                          <p className={`text-lg font-bold ${getHealthScoreColor(account.healthScore)}`}>{account.healthScore}%</p>
                        </div>

                        {/* Daily Limit */}
                        <div className="p-2 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-1.5">
                            <Send className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Heute</span>
                          </div>
                          <p className="text-lg font-bold">{account.sentToday}/{account.dailyLimit}</p>
                          <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                            <div
                              className={`h-1.5 rounded-full ${account.sentToday >= account.dailyLimit ? 'bg-red-500' : 'bg-blue-500'}`}
                              style={{ width: `${Math.min(100, (account.sentToday / account.dailyLimit) * 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* DNS Status */}
                        <div className="p-2 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">DNS</span>
                          </div>
                          <div className="flex gap-1">
                            <span title="SPF" className={`px-1.5 py-0.5 rounded text-xs font-medium ${account.spfValid === true ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : account.spfValid === false ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                              SPF
                            </span>
                            <span title="DKIM" className={`px-1.5 py-0.5 rounded text-xs font-medium ${account.dkimValid === true ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : account.dkimValid === false ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                              DKIM
                            </span>
                            <span title="DMARC" className={`px-1.5 py-0.5 rounded text-xs font-medium ${account.dmarcValid === true ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : account.dmarcValid === false ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                              DMARC
                            </span>
                          </div>
                        </div>

                        {/* Verification Status */}
                        <div className="p-2 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-1.5 mb-1">
                            <TestTube className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Verifiziert</span>
                          </div>
                          <div className="flex gap-2">
                            <span className={`flex items-center gap-1 text-xs ${account.smtpVerified ? 'text-green-600' : 'text-gray-400'}`}>
                              {account.smtpVerified ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                              SMTP
                            </span>
                            <span className={`flex items-center gap-1 text-xs ${account.imapVerified ? 'text-green-600' : 'text-gray-400'}`}>
                              {account.imapVerified ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                              IMAP
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(account.id, "smtp")}
                          disabled={testingAccountId === account.id}
                        >
                          {testingAccountId === account.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <TestTube className="h-3 w-3 mr-1" />
                          )}
                          SMTP testen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(account.id, "imap")}
                          disabled={testingAccountId === account.id}
                        >
                          {testingAccountId === account.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <TestTube className="h-3 w-3 mr-1" />
                          )}
                          IMAP testen
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCheckDns(account.id)}
                          disabled={dnsCheckingAccountId === account.id}
                        >
                          {dnsCheckingAccountId === account.id ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3 mr-1" />
                          )}
                          DNS pruefen
                        </Button>
                        {account.verificationError && (
                          <span className="text-xs text-red-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {account.verificationError}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>E-Mail-Vorlagen</CardTitle>
                <CardDescription>
                  Wiederverwendbare Vorlagen mit Variablen
                </CardDescription>
              </div>
              <Button onClick={() => { setSelectedTemplate(null); setTemplateFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Vorlage erstellen
              </Button>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Noch keine Vorlagen</p>
                  <p className="text-sm">Erstellen Sie Vorlagen fuer wiederkehrende E-Mails</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {templates.map((template) => (
                    <div key={template.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium truncate">{template.name}</span>
                          </div>
                          {template.category && (
                            <Badge variant="outline" className="text-xs mb-2">{template.category}</Badge>
                          )}
                          <p className="text-sm text-muted-foreground truncate">{template.subject}</p>
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
                              <Pencil className="mr-2 h-4 w-4" />Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteTemplateId(template.id)} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />Loeschen
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
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <EmailAccountForm open={accountFormOpen} onOpenChange={setAccountFormOpen} account={selectedAccount} onSuccess={loadData} />
      <EmailTemplateForm open={templateFormOpen} onOpenChange={setTemplateFormOpen} template={selectedTemplate} categories={categories} onSuccess={loadData} />
      <ComposeEmailDialog open={composeOpen} onOpenChange={setComposeOpen} onSuccess={() => toast.success("E-Mail gesendet!")} />

      <AlertDialog open={!!deleteAccountId} onOpenChange={() => setDeleteAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>E-Mail-Konto loeschen?</AlertDialogTitle>
            <AlertDialogDescription>Das Konto wird unwiderruflich geloescht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground">Loeschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage loeschen?</AlertDialogTitle>
            <AlertDialogDescription>Die Vorlage wird unwiderruflich geloescht.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} className="bg-destructive text-destructive-foreground">Loeschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
