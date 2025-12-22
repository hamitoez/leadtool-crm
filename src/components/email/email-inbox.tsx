"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Mail,
  MailOpen,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  Paperclip,
  User,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

interface EmailAccount {
  id: string;
  name: string;
  email: string;
}

interface Email {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  status: string;
  contactName: string;
  contactEmail: string;
  subject: string;
  preview: string;
  bodyHtml?: string;
  bodyText?: string;
  hasAttachments: boolean;
  sentAt?: string;
  createdAt: string;
  rowId?: string;
  account: EmailAccount;
  openCount: number;
  clickCount: number;
}

interface EmailInboxProps {
  rowId?: string;
  compact?: boolean;
}

export function EmailInbox({ rowId, compact = false }: EmailInboxProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<"all" | "INBOUND" | "OUTBOUND">("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [deleteEmailId, setDeleteEmailId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [emailDetailOpen, setEmailDetailOpen] = useState(false);

  const fetchEmails = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: "20" });
      if (rowId) params.set("rowId", rowId);
      if (filter !== "all") params.set("direction", filter);

      const res = await fetch(`/api/email/inbox?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails);
        setTotal(data.total);
      }
    } catch (error) {
      console.error("Error fetching emails:", error);
    } finally {
      setLoading(false);
    }
  }, [page, rowId, filter]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/email/accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    }
  };

  useEffect(() => {
    fetchEmails();
    fetchAccounts();
  }, [fetchEmails]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/email/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`${data.messagesNew} neue E-Mails synchronisiert`);
        fetchEmails();
      } else {
        const error = await res.json();
        toast.error(error.error || "Sync fehlgeschlagen");
      }
    } catch {
      toast.error("Fehler beim Synchronisieren");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteEmailId) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/email/inbox", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailIds: [deleteEmailId] }),
      });

      if (res.ok) {
        toast.success("E-Mail geloescht");
        setDeleteEmailId(null);
        fetchEmails();
      } else {
        const error = await res.json();
        toast.error(error.error || "Loeschen fehlgeschlagen");
      }
    } catch {
      toast.error("Fehler beim Loeschen");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (email: Email) => {
    if (email.direction === "OUTBOUND") {
      if (email.status === "SENT" || email.status === "DELIVERED") {
        return <Badge variant="outline" className="text-green-600">Gesendet</Badge>;
      }
      if (email.status === "OPENED") {
        return <Badge variant="outline" className="text-blue-600">Geoeffnet ({email.openCount})</Badge>;
      }
      if (email.status === "FAILED" || email.status === "BOUNCED") {
        return <Badge variant="destructive">Fehlgeschlagen</Badge>;
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {!compact && (
        <div className="flex items-center justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="all">Alle</TabsTrigger>
              <TabsTrigger value="INBOUND">
                <ArrowDownLeft className="h-4 w-4 mr-1" />
                Empfangen
              </TabsTrigger>
              <TabsTrigger value="OUTBOUND">
                <ArrowUpRight className="h-4 w-4 mr-1" />
                Gesendet
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing || accounts.length === 0}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Synchronisieren
          </Button>
        </div>
      )}

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Kein E-Mail-Konto konfiguriert
            </p>
            <p className="text-sm text-muted-foreground">
              Richten Sie ein E-Mail-Konto in den Einstellungen ein
            </p>
          </CardContent>
        </Card>
      ) : emails.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <MailOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Keine E-Mails gefunden</p>
            {filter === "INBOUND" && (
              <Button variant="outline" size="sm" className="mt-4" onClick={handleSync}>
                <RefreshCw className="h-4 w-4 mr-2" />
                E-Mails abrufen
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className={compact ? "max-h-[300px] overflow-y-auto" : "max-h-[calc(100vh-400px)] min-h-[400px] overflow-y-auto"}>
            <div className="space-y-2 pr-2">
              {emails.map((email) => (
                <Card
                  key={email.id}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedEmail(email);
                    setEmailDetailOpen(true);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {email.direction === "INBOUND" ? (
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            <ArrowDownLeft className="h-4 w-4 text-blue-600" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                            <Send className="h-4 w-4 text-green-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium text-sm truncate">
                              {email.contactName}
                            </span>
                          </div>
                          {email.hasAttachments && (
                            <Paperclip className="h-3 w-3 text-muted-foreground" />
                          )}
                          {getStatusBadge(email)}
                        </div>
                        <div className="text-sm font-medium truncate">
                          {email.subject}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {email.preview}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                          {formatDistanceToNow(new Date(email.sentAt || email.createdAt), {
                            addSuffix: true,
                            locale: de,
                          })}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setDeleteEmailId(email.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Loeschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {total > 20 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {emails.length} von {total} E-Mails
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Zurueck
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={emails.length < 20}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Weiter
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEmailId} onOpenChange={() => setDeleteEmailId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>E-Mail loeschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese E-Mail wird unwiderruflich geloescht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Loeschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Detail Sheet */}
      <Sheet open={emailDetailOpen} onOpenChange={setEmailDetailOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedEmail && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 mb-2">
                  {selectedEmail.direction === "INBOUND" ? (
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <ArrowDownLeft className="h-4 w-4 text-blue-600" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <Send className="h-4 w-4 text-green-600" />
                    </div>
                  )}
                  <Badge variant={selectedEmail.direction === "INBOUND" ? "secondary" : "default"}>
                    {selectedEmail.direction === "INBOUND" ? "Empfangen" : "Gesendet"}
                  </Badge>
                </div>
                <SheetTitle className="text-xl">{selectedEmail.subject}</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* Email metadata */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {selectedEmail.direction === "INBOUND" ? "Von:" : "An:"}
                    </span>
                    <span>{selectedEmail.contactName}</span>
                    <span className="text-muted-foreground">&lt;{selectedEmail.contactEmail}&gt;</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>
                      {new Date(selectedEmail.sentAt || selectedEmail.createdAt).toLocaleString("de-DE", {
                        dateStyle: "full",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  {selectedEmail.account && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>Konto: {selectedEmail.account.name} ({selectedEmail.account.email})</span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Email content */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {selectedEmail.bodyHtml ? (
                    <div
                      dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }}
                      className="email-content"
                    />
                  ) : selectedEmail.bodyText ? (
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {selectedEmail.bodyText}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground italic">Kein Inhalt verfuegbar</p>
                  )}
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setDeleteEmailId(selectedEmail.id);
                      setEmailDetailOpen(false);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Loeschen
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
