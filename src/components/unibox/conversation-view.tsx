"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Star,
  Archive,
  MoreVertical,
  Send,
  Loader2,
  ArrowLeft,
  User,
  Building,
  Mail,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  HelpCircle,
  CheckCircle,
  Eye,
  MousePointer,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface ThreadMessage {
  id: string;
  type: "sent" | "reply";
  subject: string | null;
  body: string | null;
  bodyHtml: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  timestamp: string;
  account: { id: string; email: string; name: string } | null;
  intent?: string | null;
  stepNumber?: number;
  status?: string;
  openCount?: number;
  clickCount?: number;
}

interface Conversation {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  fullName: string;
  status: string;
  replyIntent: string | null;
  replyConfidence: number | null;
  replySummary: string | null;
  uniboxStatus: string | null;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  notes: string | null;
  repliedAt: string;
  lastActivityAt: string;
  campaign: { id: string; name: string };
  rowId: string | null;
  thread: ThreadMessage[];
  messageCount: number;
}

interface ConversationViewProps {
  recipientId: string;
  onUpdate: () => void;
}

const INTENT_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  INTERESTED: { label: "Interessiert", icon: ThumbsUp, color: "text-green-600 bg-green-100" },
  NOT_INTERESTED: { label: "Kein Interesse", icon: ThumbsDown, color: "text-red-600 bg-red-100" },
  MEETING_REQUEST: { label: "Termin-Anfrage", icon: Calendar, color: "text-blue-600 bg-blue-100" },
  QUESTION: { label: "Frage", icon: HelpCircle, color: "text-yellow-600 bg-yellow-100" },
  OOO: { label: "Abwesend", icon: Mail, color: "text-gray-600 bg-gray-100" },
  UNSUBSCRIBE: { label: "Abmeldung", icon: Archive, color: "text-red-600 bg-red-100" },
};

interface ReplySuggestion {
  type: string;
  subject?: string;
  body: string;
  tone: string;
}

export function ConversationView({ recipientId, onUpdate }: ConversationViewProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<ReplySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversation
  useEffect(() => {
    async function loadConversation() {
      setLoading(true);
      try {
        const response = await fetch(`/api/unibox/${recipientId}`);
        if (response.ok) {
          const data = await response.json();
          setConversation(data);
        }
      } catch (error) {
        console.error("Failed to load conversation:", error);
      } finally {
        setLoading(false);
      }
    }

    loadConversation();
  }, [recipientId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.thread]);

  // Toggle star
  const handleToggleStar = async () => {
    if (!conversation) return;
    try {
      await fetch(`/api/unibox/${recipientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStarred: !conversation.isStarred }),
      });
      setConversation({ ...conversation, isStarred: !conversation.isStarred });
      onUpdate();
    } catch (error) {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  // Archive
  const handleArchive = async () => {
    if (!conversation) return;
    try {
      await fetch(`/api/unibox/${recipientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: true }),
      });
      toast.success("Konversation archiviert");
      onUpdate();
    } catch (error) {
      toast.error("Fehler beim Archivieren");
    }
  };

  // Update intent
  const handleUpdateIntent = async (intent: string) => {
    if (!conversation) return;
    try {
      await fetch(`/api/unibox/${recipientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyIntent: intent }),
      });
      setConversation({ ...conversation, replyIntent: intent });
      toast.success("Intent aktualisiert");
      onUpdate();
    } catch (error) {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  // Send reply
  const handleSendReply = async () => {
    if (!conversation || !replyText.trim()) return;
    setSending(true);
    try {
      const response = await fetch(`/api/unibox/${recipientId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText }),
      });

      if (response.ok) {
        setReplyText("");
        setSuggestions([]);
        setShowSuggestions(false);
        toast.success("Antwort gesendet");
        // Reload conversation to show new message
        const newResponse = await fetch(`/api/unibox/${recipientId}`);
        if (newResponse.ok) {
          const data = await newResponse.json();
          setConversation(data);
        }
        onUpdate();
      } else {
        const error = await response.json();
        toast.error(error.error || "Fehler beim Senden");
      }
    } catch (error) {
      toast.error("Fehler beim Senden");
    } finally {
      setSending(false);
    }
  };

  // Load AI suggestions
  const handleLoadSuggestions = async () => {
    if (!conversation || conversation.thread.length === 0) return;

    setLoadingSuggestions(true);
    setShowSuggestions(true);

    try {
      // Find the last sent email and last reply
      const sentEmails = conversation.thread.filter((m) => m.type === "sent");
      const replies = conversation.thread.filter((m) => m.type === "reply");

      const lastSent = sentEmails[sentEmails.length - 1];
      const lastReply = replies[replies.length - 1];

      if (!lastSent || !lastReply) {
        toast.error("Keine E-Mails für Vorschläge gefunden");
        setShowSuggestions(false);
        return;
      }

      const response = await fetch("/api/ai/email/reply-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalEmail: lastSent.body || lastSent.bodyHtml || "",
          replyEmail: lastReply.body || lastReply.bodyHtml || "",
          replyIntent: conversation.replyIntent,
          context: {
            recipientName: conversation.fullName,
            company: conversation.company,
            campaignName: conversation.campaign.name,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } else {
        const error = await response.json();
        toast.error(error.error || "Fehler bei KI-Vorschlägen");
        setShowSuggestions(false);
      }
    } catch (error) {
      toast.error("Fehler beim Laden der Vorschläge");
      setShowSuggestions(false);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Use a suggestion
  const handleUseSuggestion = (suggestion: ReplySuggestion) => {
    setReplyText(suggestion.body);
    setShowSuggestions(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Konversation nicht gefunden</p>
      </div>
    );
  }

  const intentConfig = conversation.replyIntent
    ? INTENT_CONFIG[conversation.replyIntent]
    : null;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">{conversation.fullName}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-3 w-3" />
              {conversation.email}
              {conversation.company && (
                <>
                  <span className="mx-1">•</span>
                  <Building className="h-3 w-3" />
                  {conversation.company}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {intentConfig && (
            <Badge className={cn("gap-1", intentConfig.color)} variant="outline">
              <intentConfig.icon className="h-3 w-3" />
              {intentConfig.label}
              {conversation.replyConfidence && (
                <span className="text-xs opacity-70">
                  ({Math.round(conversation.replyConfidence * 100)}%)
                </span>
              )}
            </Badge>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={handleToggleStar}
            className={cn(conversation.isStarred && "text-yellow-500")}
          >
            <Star className={cn("h-4 w-4", conversation.isStarred && "fill-current")} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archivieren
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Intent ändern
              </div>
              {Object.entries(INTENT_CONFIG).map(([key, config]) => (
                <DropdownMenuItem key={key} onClick={() => handleUpdateIntent(key)}>
                  <config.icon className="h-4 w-4 mr-2" />
                  {config.label}
                  {conversation.replyIntent === key && (
                    <CheckCircle className="h-4 w-4 ml-auto text-green-600" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {conversation.rowId && (
                <DropdownMenuItem asChild>
                  <a href={`/projects?rowId=${conversation.rowId}`} target="_blank">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Lead anzeigen
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <a href={`/campaigns/${conversation.campaign.id}`} target="_blank">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Kampagne: {conversation.campaign.name}
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Thread */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4 max-w-3xl mx-auto">
          {conversation.thread.map((message) => (
            <div
              key={message.id}
              className={cn(
                "rounded-lg p-4",
                message.type === "sent"
                  ? "bg-primary/5 border border-primary/20 ml-8"
                  : "bg-muted mr-8"
              )}
            >
              {/* Message Header */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium">
                    {message.type === "sent" ? (
                      <>
                        <span className="text-primary">Du</span>
                        {message.account && (
                          <span className="text-xs text-muted-foreground ml-1">
                            via {message.account.email}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        {message.fromName || message.fromEmail}
                        {message.intent && (
                          <Badge
                            className={cn(
                              "ml-2 text-xs",
                              INTENT_CONFIG[message.intent]?.color
                            )}
                            variant="outline"
                          >
                            {INTENT_CONFIG[message.intent]?.label}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                  {message.subject && (
                    <p className="text-sm text-muted-foreground">
                      Betreff: {message.subject}
                    </p>
                  )}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  {message.type === "sent" && (
                    <>
                      {message.stepNumber && (
                        <Badge variant="outline" className="text-xs">
                          Step {message.stepNumber}
                        </Badge>
                      )}
                      {message.openCount !== undefined && message.openCount > 0 && (
                        <span className="flex items-center gap-1" title="Geöffnet">
                          <Eye className="h-3 w-3" />
                          {message.openCount}
                        </span>
                      )}
                      {message.clickCount !== undefined && message.clickCount > 0 && (
                        <span className="flex items-center gap-1" title="Geklickt">
                          <MousePointer className="h-3 w-3" />
                          {message.clickCount}
                        </span>
                      )}
                    </>
                  )}
                  {format(new Date(message.timestamp), "dd.MM.yyyy HH:mm", {
                    locale: de,
                  })}
                </div>
              </div>

              {/* Message Body */}
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{
                  __html:
                    message.bodyHtml ||
                    message.body?.replace(/\n/g, "<br>") ||
                    "",
                }}
              />
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Reply Box */}
      <div className="p-4 border-t">
        <div className="max-w-3xl mx-auto">
          {/* AI Suggestions */}
          {showSuggestions && (
            <div className="mb-3 p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  KI-Antwortvorschläge
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSuggestions(false)}
                  className="h-6 px-2 text-xs"
                >
                  Schließen
                </Button>
              </div>

              {loadingSuggestions ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Generiere Vorschläge...</span>
                </div>
              ) : suggestions.length > 0 ? (
                <div className="space-y-2">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleUseSuggestion(suggestion)}
                      className="w-full text-left p-3 rounded-md bg-background hover:bg-accent transition-colors border"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {suggestion.type === "interested" && "Interesse"}
                          {suggestion.type === "meeting" && "Termin"}
                          {suggestion.type === "more_info" && "Mehr Info"}
                          {suggestion.type === "decline" && "Absage"}
                          {suggestion.type === "follow_up" && "Follow-up"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{suggestion.tone}</span>
                      </div>
                      <p className="text-sm line-clamp-2">{suggestion.body}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Keine Vorschläge verfügbar
                </p>
              )}
            </div>
          )}

          <Textarea
            placeholder="Antwort schreiben..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={3}
            className="resize-none mb-2"
          />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                Antwort wird gesendet an: {conversation.email}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadSuggestions}
                disabled={loadingSuggestions || conversation.thread.length === 0}
              >
                {loadingSuggestions ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-1" />
                )}
                KI-Vorschlag
              </Button>
              <Button onClick={handleSendReply} disabled={!replyText.trim() || sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Senden
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
