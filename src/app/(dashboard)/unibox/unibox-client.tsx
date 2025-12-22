"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Inbox,
  Star,
  Archive,
  Search,
  RefreshCw,
  Mail,
  MailOpen,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  HelpCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversationView } from "@/components/unibox/conversation-view";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

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
  repliedAt: string;
  lastActivityAt: string;
  campaign: { id: string; name: string };
  lastReply: { preview: string; receivedAt: string } | null;
}

interface Stats {
  total: number;
  unread: number;
  starred: number;
  byIntent: {
    INTERESTED: number;
    NOT_INTERESTED: number;
    MEETING_REQUEST: number;
    QUESTION: number;
  };
}

const INTENT_CONFIG: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  INTERESTED: { label: "Interessiert", icon: ThumbsUp, color: "text-green-600 bg-green-100" },
  NOT_INTERESTED: { label: "Kein Interesse", icon: ThumbsDown, color: "text-red-600 bg-red-100" },
  MEETING_REQUEST: { label: "Termin", icon: Calendar, color: "text-blue-600 bg-blue-100" },
  QUESTION: { label: "Frage", icon: HelpCircle, color: "text-yellow-600 bg-yellow-100" },
  OOO: { label: "Abwesend", icon: Mail, color: "text-gray-600 bg-gray-100" },
  UNSUBSCRIBE: { label: "Abmeldung", icon: Archive, color: "text-red-600 bg-red-100" },
};

export function UniboxClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [filter, setFilter] = useState<string>("all");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Load conversations
  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "50");

      if (filter === "unread") params.set("isRead", "false");
      if (filter === "starred") params.set("isStarred", "true");
      if (filter === "archived") params.set("isArchived", "true");

      if (intentFilter !== "all") params.set("intent", intentFilter);
      if (search) params.set("search", search);

      const response = await fetch(`/api/unibox?${params}`);
      const data = await response.json();

      setConversations(data.conversations || []);
      setStats(data.stats || null);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [filter, intentFilter, search, page]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Select first conversation on load
  useEffect(() => {
    if (conversations.length > 0 && !selectedId) {
      const idFromUrl = searchParams.get("id");
      if (idFromUrl) {
        setSelectedId(idFromUrl);
      } else {
        setSelectedId(conversations[0].id);
      }
    }
  }, [conversations, selectedId, searchParams]);

  // Handle conversation update
  const handleConversationUpdate = () => {
    loadConversations();
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/30 flex flex-col">
        {/* Stats */}
        <div className="p-4 border-b">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Unibox
          </h1>
          {stats && (
            <p className="text-sm text-muted-foreground mt-1">
              {stats.unread > 0 ? `${stats.unread} ungelesen` : "Keine ungelesenen"}
            </p>
          )}
        </div>

        {/* Filter Buttons */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            <Button
              variant={filter === "all" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setFilter("all")}
            >
              <Inbox className="h-4 w-4 mr-2" />
              Alle
              {stats && <Badge variant="outline" className="ml-auto">{stats.total}</Badge>}
            </Button>
            <Button
              variant={filter === "unread" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setFilter("unread")}
            >
              <Mail className="h-4 w-4 mr-2" />
              Ungelesen
              {stats && stats.unread > 0 && (
                <Badge className="ml-auto bg-blue-600">{stats.unread}</Badge>
              )}
            </Button>
            <Button
              variant={filter === "starred" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setFilter("starred")}
            >
              <Star className="h-4 w-4 mr-2" />
              Markiert
              {stats && stats.starred > 0 && (
                <Badge variant="outline" className="ml-auto">{stats.starred}</Badge>
              )}
            </Button>
            <Button
              variant={filter === "archived" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setFilter("archived")}
            >
              <Archive className="h-4 w-4 mr-2" />
              Archiviert
            </Button>

            {/* Intent Filters */}
            <div className="pt-4 pb-2 px-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Nach Intent</p>
            </div>
            {Object.entries(INTENT_CONFIG).slice(0, 4).map(([key, config]) => {
              const Icon = config.icon;
              const count = stats?.byIntent[key as keyof typeof stats.byIntent] || 0;
              return (
                <Button
                  key={key}
                  variant={intentFilter === key ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setIntentFilter(intentFilter === key ? "all" : key)}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {config.label}
                  {count > 0 && (
                    <Badge variant="outline" className="ml-auto">{count}</Badge>
                  )}
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Conversation List */}
      <div className="w-96 border-r flex flex-col">
        {/* Search & Actions */}
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadConversations}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            <Select value={intentFilter} onValueChange={setIntentFilter}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Alle Intents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Intents</SelectItem>
                {Object.entries(INTENT_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {loading && conversations.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center p-4">
              <MailOpen className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Keine Konversationen gefunden</p>
            </div>
          ) : (
            <div className="divide-y">
              {conversations.map((conv) => {
                const intentConfig = conv.replyIntent ? INTENT_CONFIG[conv.replyIntent] : null;
                return (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setSelectedId(conv.id);
                      router.push(`/unibox?id=${conv.id}`, { scroll: false });
                    }}
                    className={cn(
                      "w-full p-3 text-left hover:bg-muted/50 transition-colors",
                      selectedId === conv.id && "bg-muted",
                      !conv.isRead && "bg-blue-50 dark:bg-blue-950/20"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {!conv.isRead && (
                            <div className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                          )}
                          <span className={cn("font-medium truncate", !conv.isRead && "font-semibold")}>
                            {conv.fullName}
                          </span>
                          {conv.isStarred && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
                        </div>
                        {conv.company && (
                          <p className="text-xs text-muted-foreground truncate">{conv.company}</p>
                        )}
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {conv.lastReply?.preview || conv.replySummary || "Keine Vorschau"}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(conv.repliedAt), {
                            addSuffix: true,
                            locale: de,
                          })}
                        </span>
                        {intentConfig && (
                          <Badge className={cn("text-xs", intentConfig.color)} variant="outline">
                            {intentConfig.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-2 border-t flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Seite {page} von {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Conversation Detail */}
      <div className="flex-1 flex flex-col">
        {selectedId ? (
          <ConversationView
            recipientId={selectedId}
            onUpdate={handleConversationUpdate}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium">Wähle eine Konversation</h3>
              <p className="text-sm text-muted-foreground">
                Klicke auf eine Konversation, um sie anzuzeigen
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
