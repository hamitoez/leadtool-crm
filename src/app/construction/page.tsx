"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Construction, Lock, Rocket, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function UnderConstructionPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/construction/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        // Hard redirect to ensure cookie is set before navigation
        window.location.href = "/";
      } else {
        setError("Falsches Passwort. Bitte versuche es erneut.");
      }
    } catch {
      setError("Ein Fehler ist aufgetreten.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Animated construction icon */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 animate-ping bg-yellow-400/20 rounded-full" />
            <div className="relative bg-yellow-500/20 p-6 rounded-full">
              <Construction className="h-16 w-16 text-yellow-400 animate-bounce" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Under Construction
          </h1>
          <p className="text-gray-400 text-lg">
            Wir arbeiten an etwas Großartigem!
          </p>
        </div>

        {/* Features coming soon */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/10">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Rocket className="h-5 w-5 text-purple-400" />
            Coming Soon
          </h2>
          <ul className="space-y-3 text-gray-300 text-sm">
            <li className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-yellow-400" />
              TURBO Web Scraper mit 100x Geschwindigkeit
            </li>
            <li className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-yellow-400" />
              KI-gestützte Kontaktdaten-Extraktion
            </li>
            <li className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-yellow-400" />
              Notion-ähnliche Tabellenoberfläche
            </li>
          </ul>
        </div>

        {/* Password form */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5 text-green-400" />
            Beta-Zugang
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-300">
                Passwort eingeben
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Passwort"
                className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                autoComplete="off"
              />
            </div>
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
            <Button
              type="submit"
              disabled={isLoading || !password}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {isLoading ? "Prüfe..." : "Zugang freischalten"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          &copy; {new Date().getFullYear()} LeadTool. Alle Rechte vorbehalten.
        </p>
      </div>
    </div>
  );
}
