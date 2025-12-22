"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { OrganizationProvider } from "@/lib/organization-context";

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <OrganizationProvider>
          {children}
        </OrganizationProvider>
        <Toaster />
      </ThemeProvider>
    </SessionProvider>
  );
}
