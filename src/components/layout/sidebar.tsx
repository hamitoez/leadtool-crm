"use client";

import React, { memo, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  LogOut,
  Table2,
  Upload,
  Kanban,
  CheckSquare,
  Mail,
  Zap,
  Building2,
  ChevronsUpDown,
  Plus,
  Check,
  Users,
  Send,
  Inbox,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrganization } from "@/lib/organization-context";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Projekte",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    name: "Pipeline",
    href: "/pipeline",
    icon: Kanban,
  },
  {
    name: "Aufgaben",
    href: "/tasks",
    icon: CheckSquare,
  },
  {
    name: "E-Mail",
    href: "/email",
    icon: Mail,
  },
  {
    name: "Kampagnen",
    href: "/campaigns",
    icon: Send,
  },
  {
    name: "Unibox",
    href: "/unibox",
    icon: Inbox,
  },
  {
    name: "Automatisierung",
    href: "/workflows",
    icon: Zap,
  },
  {
    name: "Team",
    href: "/team",
    icon: Users,
  },
  {
    name: "Import",
    href: "/import",
    icon: Upload,
  },
];

const secondaryNavigation = [
  {
    name: "Einstellungen",
    href: "/settings",
    icon: Settings,
  },
];

// Memoized NavLink component to prevent re-renders
const NavLink = memo(function NavLink({
  href,
  name,
  icon: Icon,
  isActive,
}: {
  href: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {name}
    </Link>
  );
});

// Organization Selector Component
const OrganizationSelector = memo(function OrganizationSelector() {
  const { organizations, currentOrg, setCurrentOrg, loading } = useOrganization();

  if (loading) {
    return (
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm text-muted-foreground">Laden...</span>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
          <Table2 className="h-4 w-4 text-primary" />
        </div>
        <span className="text-lg font-semibold">LeadTool</span>
      </div>
    );
  }

  return (
    <div className="border-b px-3 py-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-2 h-auto py-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 flex-shrink-0">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm font-medium truncate max-w-[140px]">
                  {currentOrg?.name || "Keine Organisation"}
                </span>
                {currentOrg && (
                  <span className="text-xs text-muted-foreground">
                    {currentOrg.memberCount} Mitglied{currentOrg.memberCount !== 1 ? "er" : ""}
                  </span>
                )}
              </div>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px]">
          <DropdownMenuLabel>Organisationen</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => setCurrentOrg(org)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{org.name}</span>
              </div>
              {currentOrg?.id === org.id && (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/team" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Neue Organisation
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();

  const handleLogout = useCallback(() => {
    signOut({ callbackUrl: "/login" });
  }, []);

  // Memoize active state calculations
  const navItemsWithState = useMemo(
    () =>
      navigation.map((item) => ({
        ...item,
        isActive: pathname.startsWith(item.href),
      })),
    [pathname]
  );

  const secondaryNavItemsWithState = useMemo(
    () =>
      secondaryNavigation.map((item) => ({
        ...item,
        isActive: pathname.startsWith(item.href),
      })),
    [pathname]
  );

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      {/* Organization Selector */}
      <OrganizationSelector />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItemsWithState.map((item) => (
          <NavLink
            key={item.name}
            href={item.href}
            name={item.name}
            icon={item.icon}
            isActive={item.isActive}
          />
        ))}
      </nav>

      <Separator />

      {/* Secondary Navigation */}
      <div className="p-4">
        {secondaryNavItemsWithState.map((item) => (
          <NavLink
            key={item.name}
            href={item.href}
            name={item.name}
            icon={item.icon}
            isActive={item.isActive}
          />
        ))}

        <Button
          variant="ghost"
          className="mt-2 w-full justify-start gap-3 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
});
