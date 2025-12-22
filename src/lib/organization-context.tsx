"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

type OrganizationRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER";

interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  plan: string;
  role: OrganizationRole;
  memberCount: number;
  projectCount: number;
}

interface OrganizationContextType {
  organizations: Organization[];
  currentOrg: Organization | null;
  setCurrentOrg: (org: Organization | null) => void;
  loading: boolean;
  refresh: () => Promise<void>;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  canManageMembers: boolean;
  canManageProjects: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const STORAGE_KEY = "leadtool_current_org";

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrgState] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrganizations = useCallback(async () => {
    try {
      const res = await fetch("/api/organizations");
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data);

        // Restore previously selected org from localStorage
        const savedOrgId = localStorage.getItem(STORAGE_KEY);
        if (savedOrgId) {
          const savedOrg = data.find((o: Organization) => o.id === savedOrgId);
          if (savedOrg) {
            setCurrentOrgState(savedOrg);
          } else if (data.length > 0) {
            setCurrentOrgState(data[0]);
          }
        } else if (data.length > 0) {
          setCurrentOrgState(data[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching organizations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const setCurrentOrg = useCallback((org: Organization | null) => {
    setCurrentOrgState(org);
    if (org) {
      localStorage.setItem(STORAGE_KEY, org.id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchOrganizations();
  }, [fetchOrganizations]);

  // Permission helpers
  const isOwner = currentOrg?.role === "OWNER";
  const isAdmin = currentOrg?.role === "ADMIN" || isOwner;
  const isManager = currentOrg?.role === "MANAGER" || isAdmin;
  const canManageMembers = isAdmin;
  const canManageProjects = isManager;

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrg,
        setCurrentOrg,
        loading,
        refresh,
        isOwner,
        isAdmin,
        isManager,
        canManageMembers,
        canManageProjects,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}

// Optional hook for conditional use (doesn't throw if not in provider)
export function useOrganizationOptional() {
  return useContext(OrganizationContext);
}
