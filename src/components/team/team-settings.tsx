"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import { Building2, Users, Plus, MoreVertical, Mail, Crown, Shield, UserCog, User, Loader2, Copy, Check, X, LogOut, Settings, Eye, EyeOff, Send } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

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
  joinedAt: string;
}

interface Member {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  role: OrganizationRole;
  joinedAt: string;
  isCurrentUser: boolean;
}

interface PendingInvite {
  id: string;
  email: string;
  role: OrganizationRole;
  expiresAt: string;
  createdAt: string;
}

const roleLabels: Record<OrganizationRole, string> = {
  OWNER: "Eigentümer",
  ADMIN: "Administrator",
  MANAGER: "Manager",
  MEMBER: "Mitglied",
};

const roleColors: Record<OrganizationRole, string> = {
  OWNER: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  ADMIN: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  MANAGER: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  MEMBER: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

const roleIcons: Record<OrganizationRole, React.ReactNode> = {
  OWNER: <Crown className="h-3 w-3" />,
  ADMIN: <Shield className="h-3 w-3" />,
  MANAGER: <UserCog className="h-3 w-3" />,
  MEMBER: <User className="h-3 w-3" />,
};

export function TeamSettings() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Create org dialog
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDescription, setNewOrgDescription] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRole>("MEMBER");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviting, setInviting] = useState(false);

  // Delete/Remove dialogs
  const [removeMemberOpen, setRemoveMemberOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [leaveOrgOpen, setLeaveOrgOpen] = useState(false);

  // Copied state
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  // SMTP settings state
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [loadingSmtp, setLoadingSmtp] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);

  // Fetch organizations
  const fetchOrganizations = useCallback(async () => {
    try {
      const res = await fetch("/api/organizations");
      if (res.ok) {
        const data = await res.json();
        setOrganizations(data);
        if (data.length > 0 && !selectedOrg) {
          setSelectedOrg(data[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching organizations:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedOrg]);

  // Fetch members
  const fetchMembers = useCallback(async (orgId: string) => {
    setLoadingMembers(true);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch(`/api/organizations/${orgId}/members`),
        fetch(`/api/organizations/${orgId}/invite`),
      ]);

      if (membersRes.ok) {
        setMembers(await membersRes.json());
      }
      if (invitesRes.ok) {
        const invites = await invitesRes.json();
        setPendingInvites(invites.filter((i: PendingInvite & { status: string }) => i.status === "PENDING"));
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    if (selectedOrg) {
      fetchMembers(selectedOrg.id);
      fetchSmtpSettings(selectedOrg.id);
    }
  }, [selectedOrg, fetchMembers]);

  // Fetch SMTP settings
  const fetchSmtpSettings = async (orgId: string) => {
    setLoadingSmtp(true);
    try {
      const res = await fetch(`/api/organizations/${orgId}/smtp`);
      if (res.ok) {
        const data = await res.json();
        setSmtpHost(data.smtpHost || "");
        setSmtpPort(data.smtpPort?.toString() || "587");
        setSmtpSecure(data.smtpSecure || false);
        setSmtpUser(data.smtpUser || "");
        setSmtpPassword(data.smtpPassword || "");
        setSmtpFrom(data.smtpFrom || "");
        setSmtpFromName(data.smtpFromName || "");
        setSmtpConfigured(data.isConfigured || false);
      }
    } catch (error) {
      console.error("Error fetching SMTP settings:", error);
    } finally {
      setLoadingSmtp(false);
    }
  };

  // Save SMTP settings
  const handleSaveSmtp = async () => {
    if (!selectedOrg) return;

    setSavingSmtp(true);
    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}/smtp`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost,
          smtpPort,
          smtpSecure,
          smtpUser,
          smtpPassword,
          smtpFrom,
          smtpFromName,
        }),
      });

      if (res.ok) {
        toast.success("SMTP-Einstellungen gespeichert");
        setSmtpConfigured(!!(smtpHost && smtpUser && smtpPassword));
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Speichern");
      }
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSavingSmtp(false);
    }
  };

  // Test SMTP connection
  const handleTestSmtp = async () => {
    if (!selectedOrg) return;

    // First save the settings
    await handleSaveSmtp();

    setTestingSmtp(true);
    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}/smtp`, {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "SMTP-Verbindung erfolgreich!");
      } else {
        toast.error(data.error || "SMTP-Verbindung fehlgeschlagen");
      }
    } catch {
      toast.error("Fehler beim Testen der Verbindung");
    } finally {
      setTestingSmtp(false);
    }
  };

  // Create organization
  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;

    setCreatingOrg(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newOrgName.trim(),
          description: newOrgDescription.trim() || undefined,
        }),
      });

      if (res.ok) {
        const newOrg = await res.json();
        toast.success("Organisation erstellt");
        setCreateOrgOpen(false);
        setNewOrgName("");
        setNewOrgDescription("");
        await fetchOrganizations();
        setSelectedOrg({ ...newOrg, memberCount: 1, projectCount: 0, joinedAt: new Date().toISOString() });
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Erstellen");
      }
    } catch {
      toast.error("Fehler beim Erstellen");
    } finally {
      setCreatingOrg(false);
    }
  };

  // Send invite
  const handleInvite = async () => {
    if (!inviteEmail.trim() || !selectedOrg) return;

    setInviting(true);
    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          message: inviteMessage.trim() || undefined,
        }),
      });

      if (res.ok) {
        toast.success("Einladung gesendet");
        setInviteOpen(false);
        setInviteEmail("");
        setInviteRole("MEMBER");
        setInviteMessage("");
        fetchMembers(selectedOrg.id);
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Einladen");
      }
    } catch {
      toast.error("Fehler beim Einladen");
    } finally {
      setInviting(false);
    }
  };

  // Change member role
  const handleChangeRole = async (member: Member, newRole: OrganizationRole) => {
    if (!selectedOrg) return;

    try {
      const res = await fetch(`/api/organizations/${selectedOrg.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, role: newRole }),
      });

      if (res.ok) {
        toast.success("Rolle aktualisiert");
        fetchMembers(selectedOrg.id);
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Aktualisieren");
      }
    } catch {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  // Remove member
  const handleRemoveMember = async () => {
    if (!memberToRemove || !selectedOrg) return;

    try {
      const res = await fetch(
        `/api/organizations/${selectedOrg.id}/members?memberId=${memberToRemove.id}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        toast.success(memberToRemove.isCurrentUser ? "Organisation verlassen" : "Mitglied entfernt");
        setRemoveMemberOpen(false);
        setMemberToRemove(null);
        if (memberToRemove.isCurrentUser) {
          await fetchOrganizations();
          setSelectedOrg(null);
        } else {
          fetchMembers(selectedOrg.id);
        }
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler");
      }
    } catch {
      toast.error("Fehler");
    }
  };

  // Revoke invite
  const handleRevokeInvite = async (inviteId: string) => {
    if (!selectedOrg) return;

    try {
      const res = await fetch(
        `/api/organizations/${selectedOrg.id}/invite?inviteId=${inviteId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        toast.success("Einladung widerrufen");
        fetchMembers(selectedOrg.id);
      } else {
        const data = await res.json();
        toast.error(data.error || "Fehler");
      }
    } catch {
      toast.error("Fehler");
    }
  };

  // Copy invite link
  const copyInviteLink = async (inviteId: string, token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedInviteId(inviteId);
    setTimeout(() => setCopiedInviteId(null), 2000);
  };

  const canManageMembers = selectedOrg?.role === "OWNER" || selectedOrg?.role === "ADMIN";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Organization Selector / Creator */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organisationen
              </CardTitle>
              <CardDescription>
                Verwalte deine Teams und Organisationen
              </CardDescription>
            </div>
            <Dialog open={createOrgOpen} onOpenChange={setCreateOrgOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Neue Organisation
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Neue Organisation erstellen</DialogTitle>
                  <DialogDescription>
                    Erstelle eine Organisation, um mit deinem Team zusammenzuarbeiten.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">Name *</Label>
                    <Input
                      id="org-name"
                      placeholder="z.B. Meine Firma GmbH"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-desc">Beschreibung</Label>
                    <Textarea
                      id="org-desc"
                      placeholder="Optionale Beschreibung..."
                      value={newOrgDescription}
                      onChange={(e) => setNewOrgDescription(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOrgOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleCreateOrg} disabled={!newOrgName.trim() || creatingOrg}>
                    {creatingOrg && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Erstellen
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {organizations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Du bist noch keiner Organisation beigetreten. Erstelle eine neue oder warte auf eine Einladung.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {organizations.map((org) => (
                <Button
                  key={org.id}
                  variant={selectedOrg?.id === org.id ? "default" : "outline"}
                  className="justify-start"
                  onClick={() => setSelectedOrg(org)}
                >
                  <Building2 className="h-4 w-4 mr-2" />
                  {org.name}
                  <Badge variant="secondary" className="ml-2">
                    {org.memberCount}
                  </Badge>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Organization Details */}
      {selectedOrg && (
        <>
          {/* Members */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Mitglieder
                  </CardTitle>
                  <CardDescription>
                    {selectedOrg.memberCount} Mitglied{selectedOrg.memberCount !== 1 ? "er" : ""} in {selectedOrg.name}
                  </CardDescription>
                </div>
                {canManageMembers && (
                  <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Mail className="h-4 w-4 mr-2" />
                        Einladen
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Mitglied einladen</DialogTitle>
                        <DialogDescription>
                          Lade ein neues Teammitglied zu {selectedOrg.name} ein.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="invite-email">E-Mail-Adresse *</Label>
                          <Input
                            id="invite-email"
                            type="email"
                            placeholder="kollege@firma.de"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="invite-role">Rolle</Label>
                          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrganizationRole)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MEMBER">Mitglied</SelectItem>
                              <SelectItem value="MANAGER">Manager</SelectItem>
                              {selectedOrg.role === "OWNER" && (
                                <SelectItem value="ADMIN">Administrator</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="invite-message">Nachricht (optional)</Label>
                          <Textarea
                            id="invite-message"
                            placeholder="Persönliche Nachricht an den Eingeladenen..."
                            value={inviteMessage}
                            onChange={(e) => setInviteMessage(e.target.value)}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setInviteOpen(false)}>
                          Abbrechen
                        </Button>
                        <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}>
                          {inviting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Einladung senden
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingMembers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Active Members */}
                  <div className="divide-y">
                    {members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.image || undefined} />
                            <AvatarFallback>
                              {member.name?.charAt(0).toUpperCase() || member.email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {member.name || member.email}
                              </span>
                              {member.isCurrentUser && (
                                <Badge variant="outline" className="text-xs">Du</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={roleColors[member.role]}>
                            {roleIcons[member.role]}
                            <span className="ml-1">{roleLabels[member.role]}</span>
                          </Badge>
                          {canManageMembers && !member.isCurrentUser && member.role !== "OWNER" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleChangeRole(member, "MEMBER")}>
                                  <User className="h-4 w-4 mr-2" />
                                  Zu Mitglied machen
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleChangeRole(member, "MANAGER")}>
                                  <UserCog className="h-4 w-4 mr-2" />
                                  Zu Manager machen
                                </DropdownMenuItem>
                                {selectedOrg.role === "OWNER" && (
                                  <DropdownMenuItem onClick={() => handleChangeRole(member, "ADMIN")}>
                                    <Shield className="h-4 w-4 mr-2" />
                                    Zu Admin machen
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setMemberToRemove(member);
                                    setRemoveMemberOpen(true);
                                  }}
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Entfernen
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          {member.isCurrentUser && member.role !== "OWNER" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground"
                              onClick={() => setLeaveOrgOpen(true)}
                            >
                              <LogOut className="h-4 w-4 mr-2" />
                              Verlassen
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pending Invites */}
                  {pendingInvites.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-muted-foreground mb-3">
                        Ausstehende Einladungen
                      </h4>
                      <div className="space-y-2">
                        {pendingInvites.map((invite) => (
                          <div
                            key={invite.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {invite.email.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{invite.email}</p>
                                <p className="text-xs text-muted-foreground">
                                  Läuft ab am {new Date(invite.expiresAt).toLocaleDateString("de-DE")}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{roleLabels[invite.role]}</Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyInviteLink(invite.id, invite.id)}
                              >
                                {copiedInviteId === invite.id ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              {canManageMembers && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => handleRevokeInvite(invite.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* SMTP Email Settings - nur für OWNER und ADMIN */}
          {canManageMembers && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      E-Mail-Einstellungen
                    </CardTitle>
                    <CardDescription>
                      SMTP-Server für Einladungs-E-Mails konfigurieren
                    </CardDescription>
                  </div>
                  {smtpConfigured && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Konfiguriert
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingSmtp ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="smtp-host">SMTP Server *</Label>
                        <Input
                          id="smtp-host"
                          placeholder="smtp.example.com"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-port">Port</Label>
                        <Input
                          id="smtp-port"
                          placeholder="587"
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="smtp-user">Benutzername *</Label>
                        <Input
                          id="smtp-user"
                          placeholder="user@example.com"
                          value={smtpUser}
                          onChange={(e) => setSmtpUser(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-password">Passwort *</Label>
                        <div className="relative">
                          <Input
                            id="smtp-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={smtpPassword}
                            onChange={(e) => setSmtpPassword(e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="smtp-from">Absender E-Mail</Label>
                        <Input
                          id="smtp-from"
                          placeholder="noreply@example.com"
                          value={smtpFrom}
                          onChange={(e) => setSmtpFrom(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-from-name">Absender Name</Label>
                        <Input
                          id="smtp-from-name"
                          placeholder="Meine Firma"
                          value={smtpFromName}
                          onChange={(e) => setSmtpFromName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="smtp-secure"
                        checked={smtpSecure}
                        onCheckedChange={setSmtpSecure}
                      />
                      <Label htmlFor="smtp-secure">SSL/TLS verwenden (Port 465)</Label>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button onClick={handleSaveSmtp} disabled={savingSmtp}>
                        {savingSmtp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Settings className="h-4 w-4 mr-2" />
                        Speichern
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleTestSmtp}
                        disabled={testingSmtp || !smtpHost || !smtpUser || !smtpPassword}
                      >
                        {testingSmtp && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Send className="h-4 w-4 mr-2" />
                        Verbindung testen
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">
                      Diese Einstellungen werden für das Versenden von Einladungs-E-Mails verwendet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Remove Member Dialog */}
      <AlertDialog open={removeMemberOpen} onOpenChange={setRemoveMemberOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mitglied entfernen</AlertDialogTitle>
            <AlertDialogDescription>
              Bist du sicher, dass du {memberToRemove?.name || memberToRemove?.email} aus der Organisation entfernen möchtest?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground">
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Organization Dialog */}
      <AlertDialog open={leaveOrgOpen} onOpenChange={setLeaveOrgOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Organisation verlassen</AlertDialogTitle>
            <AlertDialogDescription>
              Bist du sicher, dass du {selectedOrg?.name} verlassen möchtest? Du wirst keinen Zugriff mehr auf die Projekte dieser Organisation haben.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const me = members.find((m) => m.isCurrentUser);
                if (me) {
                  setMemberToRemove(me);
                  setLeaveOrgOpen(false);
                  handleRemoveMember();
                }
              }}
              className="bg-destructive text-destructive-foreground"
            >
              Verlassen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
