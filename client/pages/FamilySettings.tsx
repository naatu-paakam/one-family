/**
 * /family-settings — family admin panel.
 * Tabs: Bio · Members · Invites
 * ADR-003, ADR-004, ADR-005
 */

import { useEffect, useState } from "react";
import { useSearchParams, Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Copy, Check, RefreshCw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import {
  fetchFamilyMembers,
  fetchFamilyInvitations,
  generateFamilyInvitation,
  revokeFamilyInvitation,
  rotateInviteCode,
  updateFamilyBio,
  updateFamilyVisibility,
  joinFamilyByCode,
  createFamily,
  removeFamilyMember,
} from "@/lib/supabase";
import { format } from "date-fns";

const BASE_URL = window.location.origin;

type Tab = "general" | "members" | "bio" | "invites";

export default function FamilySettings() {
  const { session, loading: authLoading } = useAuth();
  const { activeFamily, isFamilyAdmin, activeFamilyId, reload, families, setActiveFamilyId } = useFamily();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("general");

  // Create / join flow (triggered from empty-family state on home page)
  const showCreate = searchParams.get("create") === "1";
  const showJoin   = searchParams.get("join")   === "1";

  // Wait for auth to resolve before redirecting — avoids flash-redirect on page load
  if (authLoading) return null;
  if (!session) return <Navigate to="/" replace />;

  return (
    <div className="container py-10 max-w-2xl mx-auto">
      {/* Create family flow */}
      {showCreate && <CreateFamilyPanel onDone={() => navigate("/")} />}
      {showJoin   && <JoinFamilyPanel   onDone={() => navigate("/")} />}

      {activeFamily && (
        <>
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight flex-1">
              {activeFamily.name} — Settings
            </h1>
            <Badge variant="outline" className={isFamilyAdmin ? "bg-rose-50 text-rose-700 border-rose-200" : ""}>
              {activeFamily.role}
            </Badge>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b mb-6">
            {(["general", "members", "bio", "invites"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? "border-rose-500 text-rose-700" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "general" && <GeneralTab family={activeFamily} isFamilyAdmin={isFamilyAdmin} onSaved={reload} />}
          {tab === "members" && <MembersTab familyId={activeFamily.id} isFamilyAdmin={isFamilyAdmin} currentUserId={session?.user?.id} />}
          {tab === "bio" && <BioTab family={activeFamily} isFamilyAdmin={isFamilyAdmin} onSaved={reload} />}
          {/* [ROLE: family-admin] — invites tab only shown to admins */}
          {tab === "invites" && isFamilyAdmin && <InvitesTab family={activeFamily} onRotated={reload} />}
          {tab === "invites" && !isFamilyAdmin && (
            <p className="text-sm text-muted-foreground">Only family admins can manage invite links.</p>
          )}
        </>
      )}
    </div>
  );
}

// ── General tab (family visibility) ──────────────────────────────────────────

function GeneralTab({ family, isFamilyAdmin, onSaved }: { family: any; isFamilyAdmin: boolean; onSaved: () => Promise<void> }) {
  const current = (family.visibility ?? 'private') as 'private' | 'open' | 'public';
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const options: { value: 'private' | 'open' | 'public'; icon: string; label: string; desc: string }[] = [
    { value: 'private', icon: '🔒', label: 'Private',          desc: 'Family name and bio visible to members only' },
    { value: 'open',    icon: '👥', label: 'Open to members',  desc: 'Family name and bio visible to any registered user (direct link only)' },
    { value: 'public',  icon: '🌐', label: 'Public',           desc: 'Family name and bio visible to anyone (direct link only)' },
  ];

  async function handleChange(v: 'private' | 'open' | 'public') {
    setSaving(true);
    try {
      await updateFamilyVisibility(family.id, v);
      await onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium">Family profile visibility</Label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-3">
          Controls who can see your family's name and bio page. Does not affect individual story or event visibility.
          Family tree and member list are always members-only.
        </p>
        <div className="flex flex-col gap-2">
          {options.map(({ value, icon, label, desc }) => (
            <button
              key={value}
              disabled={!isFamilyAdmin || saving}
              onClick={() => handleChange(value)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                current === value
                  ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-200'
                  : isFamilyAdmin ? 'hover:bg-slate-50 hover:border-slate-300' : 'opacity-60 cursor-not-allowed'
              }`}
            >
              <span className="text-2xl">{icon}</span>
              <span className="flex-1">
                <span className="block font-medium text-sm">{label}</span>
                <span className="block text-xs text-muted-foreground">{desc}</span>
              </span>
              {current === value && (
                <span className="text-xs font-semibold text-rose-600">{saved ? 'Saved ✓' : 'Current'}</span>
              )}
            </button>
          ))}
        </div>
        {!isFamilyAdmin && (
          <p className="text-xs text-muted-foreground mt-2">Only family admins can change this setting.</p>
        )}
      </div>
    </div>
  );
}

// ── Members tab ───────────────────────────────────────────────────────────────

function MembersTab({ familyId, isFamilyAdmin, currentUserId }: {
  familyId: string;
  isFamilyAdmin: boolean;
  currentUserId?: string;
}) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetchFamilyMembers(familyId)
      .then(setMembers)
      .finally(() => setLoading(false));
  }, [familyId]);

  const { toast } = useToast();

  async function handleRemove(userId: string, name: string) {
    setRemoving(true);
    try {
      await removeFamilyMember(familyId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      setRemoveConfirmId(null);
      toast({ title: `${name || "Member"} removed from family` });
    } catch (e: any) {
      toast({ title: "Could not remove member", description: e.message, variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading members…</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{members.length} member{members.length !== 1 ? "s" : ""}</p>
      {members.map((m) => {
        const profile = m.profiles as any;
        const initials = profile?.full_name?.[0]?.toUpperCase() ?? "?";
        const isSelf = m.user_id === currentUserId;
        // Admins cannot remove themselves; only family admin can remove others
        const canRemove = isFamilyAdmin && !isSelf;

        return (
          <div key={m.id}>
            <div className="flex items-center gap-3 rounded-xl border p-3 bg-card">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile?.full_name ?? "Family member"}</p>
                <p className="text-xs text-muted-foreground">
                  Joined {m.joined_at ? format(new Date(m.joined_at), "MMM d, yyyy") : "—"}
                </p>
              </div>
              <Badge variant="outline" className={m.role === "admin" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-50"}>
                {m.role}
              </Badge>
              {canRemove && (
                <button
                  onClick={() => setRemoveConfirmId(removeConfirmId === m.user_id ? null : m.user_id)}
                  className="ml-1 rounded p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove from family"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {/* Inline remove confirmation */}
            {removeConfirmId === m.user_id && (
              <div className="mx-1 mt-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                <p className="text-red-700 font-medium mb-2">
                  Remove {profile?.full_name ?? "this member"} from the family?
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={removing}
                    onClick={() => handleRemove(m.user_id, profile?.full_name ?? "")}
                  >
                    Remove
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRemoveConfirmId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Bio tab ───────────────────────────────────────────────────────────────────

function BioTab({ family, isFamilyAdmin, onSaved }: { family: any; isFamilyAdmin: boolean; onSaved: () => Promise<void> }) {
  const [bio, setBio] = useState(family.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateFamilyBio(family.id, bio);
      await onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>About {family.name}</Label>
        <p className="text-xs text-muted-foreground mb-2">
          A short write-up about your family — who you are, a motto, founding year. Shown on the home page.
        </p>
        {/* [ROLE: family-admin] */}
        {isFamilyAdmin ? (
          <form onSubmit={handleSave} className="space-y-3">
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="e.g. The Bijjala family — from Andhra Pradesh, now across three continents. Est. 1970."
              rows={4}
              maxLength={400}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" disabled={saving} className="bg-rose-600 hover:bg-rose-700">
                {saving ? "Saving…" : saved ? "Saved ✓" : "Save bio"}
              </Button>
              <span className="text-xs text-muted-foreground">{bio.length}/400 chars</span>
            </div>
          </form>
        ) : (
          <div className="rounded-xl border p-4 bg-slate-50 text-sm text-muted-foreground">
            {family.bio || "No bio written yet. Ask a family admin to add one."}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Invites tab ───────────────────────────────────────────────────────────────

function InvitesTab({ family, onRotated }: { family: any; onRotated: () => Promise<void> }) {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [rotating, setRotating]     = useState(false);
  const [copied, setCopied]          = useState<string | null>(null);

  const groupLink    = `${BASE_URL}/join/${family.invite_code}`;

  useEffect(() => { loadInvitations(); }, [family.id]);

  async function loadInvitations() {
    fetchFamilyInvitations(family.id).then(setInvitations);
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await generateFamilyInvitation(family.id);
      await loadInvitations();
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: string) {
    await revokeFamilyInvitation(id);
    await loadInvitations();
  }

  async function handleRotate() {
    if (!confirm("Rotate group invite code? The old link will stop working.")) return;
    setRotating(true);
    try { await rotateInviteCode(family.id); await onRotated(); }
    finally { setRotating(false); }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="space-y-8">
      {/* Group invite link */}
      <div>
        <h3 className="font-semibold mb-1">Group invite link</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Anyone with this link can join as a member. Share in WhatsApp or iMessage.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={groupLink} className="font-mono text-xs" />
          <Button size="sm" variant="outline" onClick={() => copyToClipboard(groupLink, "group")}>
            {copied === "group" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={handleRotate} disabled={rotating} title="Rotate code — old link stops working">
            <RefreshCw className={`h-4 w-4 ${rotating ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Personal invite tokens */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h3 className="font-semibold flex-1">Personal invite links</h3>
          <Button size="sm" onClick={handleGenerate} disabled={generating} className="bg-rose-600 hover:bg-rose-700">
            {generating ? "Generating…" : "+ Generate link"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          One-time links you can paste into WhatsApp to invite a specific person. Expires in 7 days.
        </p>
        {invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active invite links.</p>
        ) : (
          <div className="space-y-2">
            {invitations.map((inv) => {
              const token = inv.token as string;
              const inviteLink = `${BASE_URL}/join/${token}`;
              const expired = new Date(inv.expires_at) < new Date();
              const used    = !!inv.accepted_at;
              return (
                <div key={inv.id} className={`flex items-center gap-2 rounded-xl border p-3 ${expired || used ? "opacity-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs truncate">{inviteLink}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {used ? "Used" : expired ? "Expired" : `Expires ${format(new Date(inv.expires_at), "MMM d")}`}
                    </p>
                  </div>
                  {!used && !expired && (
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(inviteLink, inv.id)}>
                      {copied === inv.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleRevoke(inv.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create family panel ───────────────────────────────────────────────────────

function CreateFamilyPanel({ onDone }: { onDone: () => void }) {
  const { reload, setActiveFamilyId } = useFamily();
  const [name, setName]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const fam = await createFamily(name.trim());
      await reload();
      setActiveFamilyId(fam.id);
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-6 mb-8 bg-rose-50/50">
      <h2 className="font-bold mb-4">Create a new family space</h2>
      <form onSubmit={handleCreate} className="space-y-3 max-w-sm">
        <div>
          <Label htmlFor="family-name">Family name</Label>
          <Input id="family-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Bijjala family" required />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading} className="bg-rose-600 hover:bg-rose-700">
            {loading ? "Creating…" : "Create Family"}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}

// ── Join by invite code panel ─────────────────────────────────────────────────

function JoinFamilyPanel({ onDone }: { onDone: () => void }) {
  const { reload, setActiveFamilyId } = useFamily();
  const [code, setCode]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    try {
      const result = await joinFamilyByCode(code.trim());
      await reload();
      const familyId = typeof result === "string" ? result : (result as any)?.id;
      if (familyId) setActiveFamilyId(familyId);
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-6 mb-8 bg-slate-50">
      <h2 className="font-bold mb-4">Join with invite code</h2>
      <form onSubmit={handleJoin} className="space-y-3 max-w-sm">
        <div>
          <Label htmlFor="invite-code">Invite code</Label>
          <Input id="invite-code" value={code} onChange={e => setCode(e.target.value)} placeholder="e.g. abc12345" required />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? "Joining…" : "Join Family"}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
