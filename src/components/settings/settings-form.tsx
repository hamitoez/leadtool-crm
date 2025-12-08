"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Eye,
  EyeOff,
  Check,
  ExternalLink,
  Sparkles,
  Brain,
  Zap,
  Globe,
  Bot,
  X,
  AlertCircle,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsFormProps {
  user: {
    name: string | null;
    email: string | null;
  };
}

export function ProfileForm({ user }: SettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(user.name || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "profile", name }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }

      toast.success("Profile updated successfully");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>Update your personal information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                defaultValue={user.email || ""}
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed
              </p>
            </div>
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "password",
          currentPassword,
          newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update password");
      }

      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
        <CardDescription>
          Update your password to keep your account secure
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          <Button type="submit" disabled={isLoading || !currentPassword || !newPassword}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// AI Provider Configuration
interface AIProvider {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  placeholder: string;
  docsUrl: string;
  color: string;
  bgColor: string;
  model: string;
  pricing: string;
  recommended?: boolean;
}

const AI_PROVIDERS: AIProvider[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Günstigster Anbieter - Perfekt für Web Scraping",
    icon: <Coins className="h-5 w-5" />,
    placeholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
    color: "text-amber-600",
    bgColor: "bg-amber-500",
    model: "deepseek-chat",
    pricing: "~$0.14/1M tokens",
    recommended: true,
  },
  {
    id: "google",
    name: "Google Gemini",
    description: "Kostenlos mit Limits - Googles KI",
    icon: <Globe className="h-5 w-5" />,
    placeholder: "AIza...",
    docsUrl: "https://aistudio.google.com/app/apikey",
    color: "text-blue-600",
    bgColor: "bg-blue-500",
    model: "gemini-2.0-flash",
    pricing: "Kostenlos (Limits)",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Hochwertige Texte - Premium Qualität",
    icon: <Sparkles className="h-5 w-5" />,
    placeholder: "sk-ant-api03-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
    color: "text-orange-600",
    bgColor: "bg-orange-500",
    model: "claude-3-5-sonnet",
    pricing: "~$3/1M tokens",
  },
  {
    id: "openai",
    name: "OpenAI GPT",
    description: "GPT-4 - Vielseitig und zuverlässig",
    icon: <Brain className="h-5 w-5" />,
    placeholder: "sk-proj-...",
    docsUrl: "https://platform.openai.com/api-keys",
    color: "text-emerald-600",
    bgColor: "bg-emerald-500",
    model: "gpt-4o-mini",
    pricing: "~$0.15/1M tokens",
  },
  {
    id: "groq",
    name: "Groq",
    description: "Ultra-schnell - Llama 3.1",
    icon: <Zap className="h-5 w-5" />,
    placeholder: "gsk_...",
    docsUrl: "https://console.groq.com/keys",
    color: "text-pink-600",
    bgColor: "bg-pink-500",
    model: "llama-3.1-8b",
    pricing: "Kostenlos (Limits)",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    description: "Europäische KI - Schnell und günstig",
    icon: <Bot className="h-5 w-5" />,
    placeholder: "...",
    docsUrl: "https://console.mistral.ai/api-keys/",
    color: "text-violet-600",
    bgColor: "bg-violet-500",
    model: "mistral-small",
    pricing: "~$0.25/1M tokens",
  },
];

type ValidationStatus = "idle" | "validating" | "valid" | "invalid";

interface SavedProvider {
  provider: string;
  apiKey: string;
  model: string;
  validatedAt: string;
}

export function ApiKeysForm() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedProvider, setSavedProvider] = useState<SavedProvider | null>(null);

  // Load saved provider on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem("ai_provider_config");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SavedProvider;
        setSavedProvider(parsed);
        setSelectedProvider(parsed.provider);
        setApiKey(parsed.apiKey);
        setValidationStatus("valid");
      } catch {
        // Invalid saved data, ignore
      }
    }
  }, []);

  const handleSelectProvider = (providerId: string) => {
    if (savedProvider && savedProvider.provider !== providerId) {
      // Switching provider - reset state
      setApiKey("");
      setValidationStatus("idle");
      setValidationError(null);
    } else if (savedProvider && savedProvider.provider === providerId) {
      // Same provider - restore key
      setApiKey(savedProvider.apiKey);
      setValidationStatus("valid");
    }
    setSelectedProvider(providerId);
  };

  const handleValidateAndSave = async () => {
    if (!selectedProvider || !apiKey.trim()) {
      toast.error("Bitte gib einen API Key ein");
      return;
    }

    setValidationStatus("validating");
    setValidationError(null);

    try {
      const response = await fetch("/api/settings/validate-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKey.trim(),
        }),
      });

      const result = await response.json();

      if (result.valid) {
        // Save to localStorage
        const config: SavedProvider = {
          provider: selectedProvider,
          apiKey: apiKey.trim(),
          model: result.model || AI_PROVIDERS.find(p => p.id === selectedProvider)?.model || "",
          validatedAt: new Date().toISOString(),
        };
        localStorage.setItem("ai_provider_config", JSON.stringify(config));

        // Also save under legacy keys for compatibility
        localStorage.setItem("ai_provider", selectedProvider);
        localStorage.setItem("ai_api_key", apiKey.trim());
        localStorage.setItem("default_ai_provider", selectedProvider);

        setSavedProvider(config);
        setValidationStatus("valid");

        const provider = AI_PROVIDERS.find(p => p.id === selectedProvider);
        toast.success(`${provider?.name} erfolgreich verbunden!`);
      } else {
        setValidationStatus("invalid");
        setValidationError(result.error || "API Key ist ungültig");
        toast.error(result.error || "API Key ist ungültig");
      }
    } catch (error) {
      setValidationStatus("invalid");
      setValidationError("Verbindungsfehler - bitte versuche es erneut");
      toast.error("Verbindungsfehler");
    }
  };

  const handleRemoveKey = () => {
    if (!confirm("Möchtest du die KI-Verbindung trennen?")) return;

    localStorage.removeItem("ai_provider_config");
    localStorage.removeItem("ai_provider");
    localStorage.removeItem("ai_api_key");
    localStorage.removeItem("default_ai_provider");

    setSavedProvider(null);
    setSelectedProvider(null);
    setApiKey("");
    setValidationStatus("idle");
    setValidationError(null);

    toast.success("KI-Verbindung getrennt");
  };

  const currentProvider = AI_PROVIDERS.find(p => p.id === selectedProvider);

  return (
    <div className="space-y-6">
      {/* Header Card - Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            KI-Anbieter für Web Scraping
          </CardTitle>
          <CardDescription>
            Wähle einen KI-Anbieter für die automatische Extraktion von Namen und E-Mails aus Impressum-Seiten.
            Der API Key wird <strong>validiert</strong> bevor er gespeichert wird.
          </CardDescription>
        </CardHeader>
        {savedProvider && (
          <CardContent>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
              <div className={cn("p-2 rounded-lg text-white", AI_PROVIDERS.find(p => p.id === savedProvider.provider)?.bgColor)}>
                {AI_PROVIDERS.find(p => p.id === savedProvider.provider)?.icon}
              </div>
              <div className="flex-1">
                <p className="font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Verbunden mit {AI_PROVIDERS.find(p => p.id === savedProvider.provider)?.name}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Model: {savedProvider.model} • Validiert am {new Date(savedProvider.validatedAt).toLocaleDateString("de-DE")}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleRemoveKey} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <X className="h-4 w-4 mr-1" />
                Trennen
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">KI-Anbieter auswählen</CardTitle>
          <CardDescription>
            Empfohlen: DeepSeek (günstigster) oder Google Gemini (kostenlos mit Limits)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {AI_PROVIDERS.map((provider) => {
              const isSelected = selectedProvider === provider.id;
              const isConnected = savedProvider?.provider === provider.id;

              return (
                <button
                  key={provider.id}
                  onClick={() => handleSelectProvider(provider.id)}
                  className={cn(
                    "relative flex flex-col gap-2 p-4 rounded-lg border-2 text-left transition-all",
                    isConnected
                      ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                      : isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-accent/50"
                  )}
                >
                  {provider.recommended && (
                    <Badge className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px]">
                      Empfohlen
                    </Badge>
                  )}
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg text-white", provider.bgColor)}>
                      {provider.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{provider.name}</p>
                        {isConnected && <Check className="h-4 w-4 text-green-600 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {provider.pricing}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {provider.description}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* API Key Configuration */}
      {selectedProvider && (
        <Card className={cn(
          validationStatus === "valid" && "border-green-500/50",
          validationStatus === "invalid" && "border-red-500/50"
        )}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg text-white", currentProvider?.bgColor)}>
                {currentProvider?.icon}
              </div>
              <div className="flex-1">
                <CardTitle className="text-base">{currentProvider?.name} konfigurieren</CardTitle>
                <CardDescription>{currentProvider?.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* API Key Input */}
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="api-key"
                    type={isVisible ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      // Reset validation when key changes
                      if (validationStatus !== "idle") {
                        setValidationStatus("idle");
                        setValidationError(null);
                      }
                    }}
                    placeholder={currentProvider?.placeholder}
                    disabled={validationStatus === "validating"}
                    className={cn(
                      "pr-10",
                      validationStatus === "valid" && "border-green-500 focus-visible:ring-green-500",
                      validationStatus === "invalid" && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setIsVisible(!isVisible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  onClick={handleValidateAndSave}
                  disabled={validationStatus === "validating" || !apiKey.trim() || validationStatus === "valid"}
                  className={cn(
                    validationStatus === "valid" && "bg-green-600 hover:bg-green-700"
                  )}
                >
                  {validationStatus === "validating" ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Prüfe...
                    </>
                  ) : validationStatus === "valid" ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Verbunden
                    </>
                  ) : (
                    "Validieren & Speichern"
                  )}
                </Button>
              </div>

              {/* Validation Error */}
              {validationStatus === "invalid" && validationError && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Success Message */}
              {validationStatus === "valid" && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
                  <Check className="h-4 w-4 flex-shrink-0" />
                  <span>API Key wurde validiert und gespeichert. Du kannst jetzt Web Scraping mit KI nutzen!</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <a
                href={currentProvider?.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                API Key holen
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* What this key is used for */}
            {validationStatus === "valid" && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Dieser API Key wird verwendet für:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Name aus Impressum extrahieren</Badge>
                  <Badge variant="secondary">E-Mail aus Impressum extrahieren</Badge>
                  <Badge variant="secondary">Lead-Analyse</Badge>
                  <Badge variant="secondary">Texterstellung</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 h-fit">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Wichtiger Hinweis</p>
              <p className="text-xs text-muted-foreground">
                Der API Key wird lokal in deinem Browser gespeichert und <strong>erst nach erfolgreicher Validierung</strong> aktiviert.
                Dein Key wird sicher übertragen und nur zum Testen einer minimalen Anfrage verwendet.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
