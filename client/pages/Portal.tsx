/**
 * /portal — Portal admin dashboard.
 * Accessible only to isPortalAdmin users. Redirects others to /.
 * ADR-002
 */

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Shield, Users, CheckCircle, Trash2, ChevronDown, ChevronUp, Copy, Check,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchAllFamiliesForPortal, fetchAllProfiles,
  promoteToPortalAdmin, demotePortalAdmin,
  deleteFamily, deleteUser, setFamilyRole,
} from "@/lib/supabase";
import { format } from "date-fns";

type Tab = "families" | "users";

export default function Portal() {
  const { isPortalAdmin, session, loading: authLoading } = useAuth();
  if (authLoading) return null;
  if (!session) return <Navigate to="/" replace />;
  if (!isPortalAdmin) return <Navigate to="/" replace />;

  return (
    <div className="container py-10 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center">
          <Shield className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Portal Admin</h1>
          <p className="text-sm text-muted-foreground">Platform-wide management — Family Vibes</p>
        </div>
      </div>
      <PortalTabs />
    </div>
  );
}

function PortalTabs() {
  const [tab, setTab] = useState<Tab>("families");
  return (
    <>
      <div className="flex gap-1 border-b mb-6">
        {(["families", "users"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? "border-violet-500 text-violet-700" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === "families" && <FamiliesTab />}
      {tab === "users"    && <UsersTab />}
    </>
  );
}

// ── Families tab ──────────────────────────────────────────────────────────────

function FamiliesTab() {
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied]     = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setFamilies(await fetchAllFamiliesForPortal()); }
    finally { setLoading(false); }
  }

  async function handleDelete(familyId: string) {
    setActing(familyId);
    setDeleteError(null);
    try {
      await deleteFamily(familyId);
      setFamilies((prev) => prev.filter((f) => f.id !== familyId));
    } catch (err: any) {
      setDeleteError(err.message);
    } finally { setActing(null); setDeleteConfirmId(null); }
  }

  function copyLink(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading families…</p>;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { label: "Total families", value: families.length },
          { label: "Total members",  value: families.reduce((s: number, f: any) => s + Number(f.member_count ?? 0), 0) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border p-4 bg-card text-center">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {families.length === 0 && <p className="text-sm text-muted-foreground">No families found.</p>}

      {families.map((fam) => {
        const admins: any[]   = Array.isArray(fam.admins) ? fam.admins : [];
        const isExpanded      = expanded === fam.id;
        const joinLink        = `${window.location.origin}/join/${fam.invite_code}`;

        return (
          <div key={fam.id} className="rounded-xl border bg-card">
            {/* Row */}
            <div className="flex items-start gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{fam.name}</p>
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {fam.member_count} member{fam.member_count !== 1 ? "s" : ""}
                  </Badge>
                </div>

                {/* Admin users shown in row */}
                {admins.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">Admins:</span>
                    {admins.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded-full px-2 py-0.5">
                        <Avatar className="h-3.5 w-3.5">
                          <AvatarImage src={a.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[8px]">{a.full_name?.[0] ?? "?"}</AvatarFallback>
                        </Avatar>
                        {a.full_name ?? "—"}
                      </span>
                    ))}
                  </div>
                )}

                {fam.bio && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{fam.bio}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Created {fam.created_at ? format(new Date(fam.created_at), "MMM d, yyyy") : "—"}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* [ROLE: portal-admin] delete family */}
                {deleteConfirmId === fam.id ? (
                  <div className="flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs">
                    <span className="text-red-800">Delete "{fam.name}"?</span>
                    <button onClick={() => handleDelete(fam.id)} disabled={acting === fam.id}
                      className="text-destructive font-medium hover:underline">Delete</button>
                    <button onClick={() => { setDeleteConfirmId(null); setDeleteError(null); }}
                      className="text-muted-foreground hover:underline">Cancel</button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" disabled={acting === fam.id}
                    onClick={() => setDeleteConfirmId(fam.id)}
                    className="text-rose-700 border-rose-200 hover:bg-rose-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setExpanded(isExpanded ? null : fam.id)} aria-label="Toggle details">
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
              {deleteError && deleteConfirmId === null && (
                <p className="text-xs text-destructive mt-1">{deleteError}</p>
              )}
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="border-t px-4 py-3 bg-slate-50/50 rounded-b-xl space-y-2">
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <span className="font-medium text-foreground">Family ID</span>
                  <span className="text-muted-foreground font-mono">{fam.id}</span>

                  <span className="font-medium text-foreground">Created by</span>
                  <span className="text-muted-foreground">{fam.creator_name ?? fam.created_by ?? "—"}</span>

                  <span className="font-medium text-foreground">Invite code</span>
                  <span className="text-muted-foreground font-mono">{fam.invite_code}</span>

                  <span className="font-medium text-foreground">Group invite link</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="font-mono truncate">{joinLink}</span>
                    <button onClick={() => copyLink(joinLink, fam.id)}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" title="Copy link">
                      {copied === fam.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const { profile: currentProfile } = useAuth();
  const [profiles, setProfiles]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [acting, setActing]         = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    type: "promote" | "demote" | "familyRole" | "delete";
    userId: string; name: string; familyId?: string; familyName?: string; newRole?: string; label: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllProfiles().then(setProfiles).finally(() => setLoading(false));
  }, []);

  async function executeAction() {
    if (!pendingAction) return;
    const { type, userId, familyId, newRole } = pendingAction;
    setActing(userId);
    setActionError(null);
    try {
      if (type === "promote") {
        await promoteToPortalAdmin(userId);
        setProfiles((prev) => prev.map((p) => p.id === userId ? { ...p, is_portal_admin: true } : p));
      } else if (type === "demote") {
        await demotePortalAdmin(userId);
        setProfiles((prev) => prev.map((p) => p.id === userId ? { ...p, is_portal_admin: false } : p));
      } else if (type === "familyRole" && familyId && newRole) {
        await setFamilyRole(userId, familyId, newRole as "admin" | "member");
        setProfiles((prev) => prev.map((p) => {
          if (p.id !== userId) return p;
          return { ...p, family_memberships: (p.family_memberships ?? []).map((m: any) =>
            m.family_id === familyId ? { ...m, role: newRole } : m) };
        }));
      } else if (type === "delete") {
        await deleteUser(userId);
        setProfiles((prev) => prev.filter((p) => p.id !== userId));
      }
      setPendingAction(null);
    } catch (err: any) {
      setActionError(err.message);
    } finally { setActing(null); }
  }

  function handlePromotePortal(userId: string, name: string) {
    setPendingAction({ type: "promote", userId, name, label: `Make "${name}" a Portal Admin? They'll have full platform access.` });
  }
  function handleDemotePortal(userId: string, name: string) {
    setPendingAction({ type: "demote", userId, name, label: `Remove Portal Admin rights from "${name}"?` });
  }
  function handleFamilyRole(userId: string, familyId: string, familyName: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const label = newRole === 'admin' ? `Make family admin of "${familyName}"?` : `Remove family admin of "${familyName}"?`;
    setPendingAction({ type: "familyRole", userId, name: "", familyId, familyName, newRole, label });
  }
  function handleDeleteUser(userId: string, name: string) {
    setPendingAction({ type: "delete", userId, name, label: `Permanently remove "${name}" from the platform? Their stories/events remain but will be unattributed.` });
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading users…</p>;

  const portalAdmins = profiles.filter((p) => p.is_portal_admin);

  return (
    <div className="space-y-4">
      {/* Inline confirm dialog */}
      {pendingAction && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="text-amber-900 font-medium mb-2">{pendingAction.label}</p>
          {actionError && <p className="text-xs text-destructive mb-2">{actionError}</p>}
          <div className="flex gap-2">
            <button onClick={executeAction} disabled={!!acting}
              className="inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-medium bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50">
              Confirm
            </button>
            <button onClick={() => { setPendingAction(null); setActionError(null); }}
              className="inline-flex items-center gap-1 rounded border px-3 py-1 text-xs font-medium hover:bg-muted">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { label: "Total users",   value: profiles.length },
          { label: "Portal admins", value: portalAdmins.length, color: "text-violet-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border p-4 bg-card text-center">
            <p className={`text-2xl font-bold ${color ?? ""}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        ))}
      </div>

      {profiles.map((p) => {
        const initials       = p.full_name?.[0]?.toUpperCase() ?? "?";
        const isSelf         = p.id === currentProfile?.id;
        const isPortal       = p.is_portal_admin;
        const memberships    = Array.isArray(p.family_memberships) ? p.family_memberships : [];
        const familyAdminOf  = memberships.filter((m: any) => m.role === 'admin');
        const memberOnly     = memberships.filter((m: any) => m.role === 'member');

        return (
          <div key={p.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                {/* Name + portal badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{p.full_name ?? "—"}</p>
                  {isPortal && (
                    <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">
                      <Shield className="h-3 w-3 mr-1" />Portal Admin
                    </Badge>
                  )}
                  {isSelf && <Badge variant="outline" className="text-xs">You</Badge>}
                </div>

                {/* Email */}
                {p.email && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.email}</p>
                )}

                {/* Family admin badges */}
                {familyAdminOf.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {familyAdminOf.map((m: any) => (
                      <span key={m.family_id}
                        className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                        <Shield className="h-3 w-3" />
                        Admin · {m.family_name}
                        {/* [ROLE: portal-admin] — remove family admin */}
                        {!isSelf && (
                          <button
                            onClick={() => handleFamilyRole(p.id, m.family_id, m.family_name, 'admin')}
                            className="ml-0.5 opacity-60 hover:opacity-100" title="Remove family admin">✕</button>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {/* Member-only family chips — promote to family admin */}
                {memberOnly.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {memberOnly.map((m: any) => (
                      <span key={m.family_id}
                        className="inline-flex items-center gap-1 text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded-full px-2 py-0.5">
                        {m.family_name}
                        {/* [ROLE: portal-admin] — make family admin */}
                        {!isSelf && (
                          <button
                            onClick={() => handleFamilyRole(p.id, m.family_id, m.family_name, 'member')}
                            className="ml-0.5 opacity-60 hover:opacity-100 text-amber-600" title="Make family admin">↑</button>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-1">
                  Joined {p.created_at ? format(new Date(p.created_at), "MMM d, yyyy") : "—"}
                </p>
              </div>

              {/* Action buttons — not shown for self */}
              {!isSelf && (
                <div className="flex items-center gap-2 shrink-0">
                  {/* [ROLE: portal-admin] portal admin toggle */}
                  {isPortal ? (
                    <Button size="sm" variant="outline" disabled={acting === p.id}
                      onClick={() => handleDemotePortal(p.id, p.full_name ?? p.id)}
                      className="text-rose-700 border-rose-200 hover:bg-rose-50 text-xs">
                      {acting === p.id ? "Removing…" : "Remove portal admin"}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={acting === p.id}
                      onClick={() => handlePromotePortal(p.id, p.full_name ?? p.id)}
                      className="text-violet-700 border-violet-200 hover:bg-violet-50 text-xs">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      {acting === p.id ? "Promoting…" : "Make portal admin"}
                    </Button>
                  )}
                  {/* [ROLE: portal-admin] delete user */}
                  <Button size="sm" variant="outline" disabled={!!acting}
                    onClick={() => handleDeleteUser(p.id, p.full_name ?? p.id)}
                    className="text-rose-700 border-rose-200 hover:bg-rose-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
