"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { signOut } from "next-auth/react";
import {
  Search,
  Menu,
  LayoutDashboard,
  FolderKanban,
  Upload,
  Settings,
  LogOut,
  Table2,
  Sun,
  Moon,
  Monitor,
  FileSpreadsheet
} from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ReminderBell } from "@/components/reminders/reminder-bell";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Import", href: "/import", icon: Upload },
];

const secondaryNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
];

interface SearchResult {
  id: string;
  type: "project" | "table";
  name: string;
  href: string;
  projectName?: string;
}

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || "U";

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Search function with debounce
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/projects?search=${encodeURIComponent(query)}`);
      if (response.ok) {
        const projects = await response.json();
        const results: SearchResult[] = [];

        // Add projects to results
        projects.forEach((project: { id: string; name: string; tables?: { id: string; name: string }[] }) => {
          if (project.name.toLowerCase().includes(query.toLowerCase())) {
            results.push({
              id: project.id,
              type: "project",
              name: project.name,
              href: `/projects/${project.id}`,
            });
          }

          // Add tables from this project
          project.tables?.forEach((table: { id: string; name: string }) => {
            if (table.name.toLowerCase().includes(query.toLowerCase())) {
              results.push({
                id: table.id,
                type: "table",
                name: table.name,
                href: `/projects/${project.id}/tables/${table.id}`,
                projectName: project.name,
              });
            }
          });
        });

        setSearchResults(results.slice(0, 10));
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  const handleSearchSelect = (href: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    router.push(href);
  };

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const getThemeIcon = () => {
    if (!mounted) return <Monitor className="h-4 w-4" />;
    if (theme === "light") return <Sun className="h-4 w-4" />;
    if (theme === "dark") return <Moon className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
      {/* Mobile Menu Button */}
      <div className="flex items-center gap-3 md:hidden">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menü öffnen</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b px-6 py-4">
              <SheetTitle className="flex items-center gap-2">
                <Table2 className="h-6 w-6 text-primary" />
                <span className="text-xl font-bold">LeadTool</span>
              </SheetTitle>
            </SheetHeader>

            {/* Mobile Navigation */}
            <nav className="flex-1 space-y-1 p-4">
              {navigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <Separator />

            {/* Secondary Navigation */}
            <div className="p-4">
              {secondaryNavigation.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}

              <Button
                variant="ghost"
                className="mt-2 w-full justify-start gap-3 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setMobileMenuOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Mobile Logo */}
        <div className="flex items-center gap-2">
          <Table2 className="h-5 w-5 text-primary" />
          <span className="font-bold">LeadTool</span>
        </div>
      </div>

      {/* Search - clickable to open command dialog */}
      <button
        onClick={() => setSearchOpen(true)}
        className="relative hidden w-96 md:flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Suchen...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Command Dialog for Search */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput
          placeholder="Projekte, Tabellen suchen..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>
            {isSearching ? "Suche..." : "Keine Ergebnisse gefunden."}
          </CommandEmpty>
          {searchResults.filter((r) => r.type === "project").length > 0 && (
            <CommandGroup heading="Projekte">
              {searchResults
                .filter((r) => r.type === "project")
                .map((result) => (
                  <CommandItem
                    key={result.id}
                    value={result.name}
                    onSelect={() => handleSearchSelect(result.href)}
                  >
                    <FolderKanban className="mr-2 h-4 w-4" />
                    {result.name}
                  </CommandItem>
                ))}
            </CommandGroup>
          )}
          {searchResults.filter((r) => r.type === "table").length > 0 && (
            <CommandGroup heading="Tabellen">
              {searchResults
                .filter((r) => r.type === "table")
                .map((result) => (
                  <CommandItem
                    key={result.id}
                    value={`${result.name} ${result.projectName}`}
                    onSelect={() => handleSearchSelect(result.href)}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    <span>{result.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      in {result.projectName}
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>

      {/* Right side */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={cycleTheme}
          title={mounted ? `Theme: ${theme}` : "Theme"}
        >
          {getThemeIcon()}
          <span className="sr-only">Theme wechseln</span>
        </Button>

        <ReminderBell />
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarImage src={session?.user?.image || undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {session?.user?.name || "User"}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {session?.user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/settings">Settings</a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
