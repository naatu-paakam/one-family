import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Navigate, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Sparkles, Link2, Check, Trash2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEvent } from "@/contexts/EventContext";
import { useFamily } from "@/contexts/FamilyContext";
import {
  fetchUpdates,
  fetchAllEvents,
  fetchFamilyMembers,
  callEdgeFunction,
  fetchAllInvites,
  addInvite,
  deleteInvite,
  updateInviteStatus,
  updateEvent,
  deleteEvent,
  fetchCommentCounts,
} from "@/lib/supabase";
import CommentThread from "@/components/CommentThread";

import { format } from "date-fns";

/* ── Types ──────────────────────────────────────────────────────────────────── */

type FamilyEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  duration: string | null;
  started_at: string | null;
  closed_at: string | null;
  created_by: string;
  created_at: string;
  visibility?: "family" | "open" | "public";
};

type Post = {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  hashtags: string[];
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
};

type Invite = {
  id: string;
  event_id: string;
  full_name: string;
  email: string | null;
  invited_user_id: string | null;
  status: "invited" | "pending" | "accepted" | "declined";
  created_at: string;
};

// Map a Supabase event to the original UI tab categories:
//   upcoming = started_at in future, not closed
//   ongoing  = started_at in past (or null), not closed
//   past     = closed_at set
function categoryOf(ev: FamilyEvent): "upcoming" | "ongoing" | "past" {
  if (ev.closed_at) return "past";
  if (ev.started_at && new Date(ev.started_at).getTime() > Date.now()) return "upcoming";
  return "ongoing";
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return format(d, "MMM d h:mm a");
}

function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return format(d, "MMM d, h:mm a");
}

type Tab = "upcoming" | "ongoing" | "past" | "all";
type Mode = "none" | "create" | "edit";

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function Events() {
  const { session, openAuthModal } = useAuth();
  const { activeEvents, startEvent, endEvent } = useEvent();
  const { activeFamilyId, isFamilyAdmin, enableVideoUpload, families, loading: familiesLoading } = useFamily();
  const navigate = useNavigate();

  const [allEvents, setAllEvents] = useState<FamilyEvent[]>([]);
  const [eventPosts, setEventPosts] = useState<Record<string, Post[]>>({});
  const [invitesByEvent, setInvitesByEvent] = useState<Record<string, Invite[]>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("ongoing");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("none");
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open create form when ?create=1 is in the URL (e.g. from "Plan for Event" CTA)
  useEffect(() => {
    if (searchParams.get("create") === "1" && session) {
      setMode("create");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, session]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Load events directly from event_families — avoids orphaned-story bleed.
        // Story posts are loaded separately and used only for the detail panel.
        const [posts, directEvents] = await Promise.all([
          fetchUpdates({ limit: 200, familyId: activeFamilyId }),
          fetchAllEvents(activeFamilyId),
        ]);

        const evMap: Record<string, FamilyEvent> = {};
        for (const ev of directEvents) {
          evMap[ev.id] = ev as unknown as FamilyEvent;
        }
        // activeEvents (from context) adds events created this session not yet in DB fetch
        for (const ev of activeEvents) {
          evMap[ev.id] = ev as unknown as FamilyEvent;
        }
        const evList = Object.values(evMap).sort(
          (a, b) =>
            new Date(b.created_at ?? b.started_at ?? 0).getTime() -
            new Date(a.created_at ?? a.started_at ?? 0).getTime(),
        );
        setAllEvents(evList);

        const map: Record<string, Post[]> = {};
        for (const p of posts ?? []) {
          if (p.event_id) {
            if (!map[p.event_id]) map[p.event_id] = [];
            map[p.event_id].push(p as any);
          }
        }
        setEventPosts(map);

        // Load invites and comment counts for all events
        const ids = evList.map((e) => e.id);
        if (ids.length > 0) {
          const [allInvites, counts] = await Promise.all([
            fetchAllInvites(ids),
            fetchCommentCounts(ids),
          ]);
          const invMap: Record<string, Invite[]> = {};
          for (const inv of allInvites as Invite[]) {
            if (!invMap[inv.event_id]) invMap[inv.event_id] = [];
            invMap[inv.event_id].push(inv);
          }
          setInvitesByEvent(invMap);
          setCommentCounts(counts);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeEvents, activeFamilyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open edit form when ?edit=<id> is in URL (linked from event page)
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && allEvents.length > 0) {
      const ev = allEvents.find((e) => e.id === editId);
      if (ev) {
        setSelectedId(editId);
        setMode("edit");
        setSearchParams({}, { replace: true });
      }
    }
  }, [allEvents, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return allEvents
      .filter((ev) => {
        if (tab !== "all" && categoryOf(ev) !== tab) return false;
        if (q && !ev.title.toLowerCase().includes(q) && !(ev.description ?? "").toLowerCase().includes(q))
          return false;
        return true;
      })
      .sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [allEvents, tab, query]);

  const selected = useMemo(
    () => allEvents.find((e) => e.id === selectedId) ?? null,
    [allEvents, selectedId],
  );

  async function handleAddInvite(eventId: string, full_name: string, email: string | null, invitedUserId?: string | null) {
    const inv = await addInvite(eventId, full_name, email, invitedUserId) as Invite;
    setInvitesByEvent((prev) => ({
      ...prev,
      [eventId]: [...(prev[eventId] ?? []), inv],
    }));
  }

  async function handleDeleteInvite(invId: string, eventId: string) {
    await deleteInvite(invId);
    setInvitesByEvent((prev) => ({
      ...prev,
      [eventId]: (prev[eventId] ?? []).filter((i) => i.id !== invId),
    }));
  }

  async function handleUpdateInviteStatus(invId: string, eventId: string, status: string) {
    const updated = await updateInviteStatus(invId, status) as Invite;
    setInvitesByEvent((prev) => ({
      ...prev,
      [eventId]: (prev[eventId] ?? []).map((i) => (i.id === invId ? updated : i)),
    }));
  }

  async function handleModifyEvent(eventId: string, patch: Partial<FamilyEvent>) {
    const updated = await updateEvent(eventId, patch) as FamilyEvent;
    setAllEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, ...updated } : e)));
    setMode("none");
  }

  // No-family guard (ADR-006)
  if (session && !familiesLoading && families.length === 0) {
    return <Navigate to="/" replace />;
  }

  // Full-width create form
  if (mode === "create") {
    const defaultStart = tab === "upcoming" ? (() => {
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0);
      return d.toISOString().slice(0, 16);
    })() : "";
    return (
      <div className="container py-8 max-w-2xl mx-auto">
        <button
          onClick={() => setMode("none")}
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Events
        </button>
        <h1 className="text-2xl font-bold mb-4">Create Event</h1>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <CreateEventForm
            defaultStartedAt={defaultStart}
            onCancel={() => setMode("none")}
            onSave={async ({ title, description, location, duration, visibility, started_at }) => {
              await startEvent({ title, description, location, duration: duration || null, visibility, started_at: started_at || null });
              setMode("none");
            }}
          />
        </div>
      </div>
    );
  }

  // Full-width edit form — shown instead of list when editing
  if (mode === "edit" && selected) {
    return (
      <div className="container py-8 max-w-2xl mx-auto">
        <button
          onClick={() => { setMode("none"); navigate(`/events/${selected.id}`); }}
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to event
        </button>
        <h1 className="text-2xl font-bold mb-1">Modify Event</h1>
        <p className="text-sm text-muted-foreground mb-4">{selected.title}</p>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <ModifyEventForm
            event={selected}
            canDelete={isFamilyAdmin || selected.created_by === session?.user?.id}
            onCancel={() => { setMode("none"); navigate(`/events/${selected.id}`); }}
            onSave={async (patch) => { await handleModifyEvent(selected.id, patch); navigate(`/events/${selected.id}`); }}
            onDelete={async () => {
              await deleteEvent(selected.id);
              setAllEvents((prev) => prev.filter((e) => e.id !== selected.id));
              setSelectedId(null);
              setMode("none");
              navigate("/events");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col gap-8 md:grid md:grid-cols-[1fr_360px]">
        {/* Left — list */}
        <div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Events
              </h1>
              <p className="mt-1 text-muted-foreground">
                Browse upcoming, ongoing, and past gatherings. Filter and manage invites.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Search by title or location"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="sm:w-72 rounded-[10px]"
              />
            </div>
          </div>

          <div className="mt-5">
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <div className="flex items-center gap-3">
                <TabsList className="flex-1">
                  <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                  <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
                  <TabsTrigger value="past">Past</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
                <Button
                  onClick={session ? () => setMode("create") : () => openAuthModal()}
                  className="h-10 w-10 rounded-full p-0 shrink-0"
                  aria-label="New Event"
                  title="New Event"
                >
                  <Plus className="h-5 w-5" />
                  <span className="sr-only">New Event</span>
                </Button>
              </div>

              {(["upcoming", "ongoing", "past", "all"] as const).map((key) => (
                <TabsContent key={key} value={key}>
                  {loading ? (
                    <div className="flex justify-center py-20">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {filtered.map((ev) => (
                        <EventCard
                          key={ev.id}
                          ev={ev}
                          invites={invitesByEvent[ev.id] ?? []}
                          commentCount={commentCounts[ev.id] ?? 0}
                          onSelect={() => navigate(`/events/${ev.id}`)}
                        />
                      ))}
                      {filtered.length === 0 && (
                        <div className="col-span-full rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                          No events match.
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── EventCopyLinkButton ─────────────────────────────────────────────────────── */

function EventCopyLinkButton({ eventId, visibility }: { eventId: string; visibility: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/events/${eventId}`;

  const tooltip = visibility === "family"
    ? "Copy link (family members need to sign in)"
    : visibility === "open"
    ? "Copy link (registered users can view)"
    : "Copy public link";

  // Show for all non-private events (events have no 'private' tier)
  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title={tooltip}
      className={`rounded-full p-1.5 transition-colors ${
        copied
          ? "text-emerald-500 bg-emerald-50"
          : visibility === "family"
          ? "text-muted-foreground/40 hover:text-muted-foreground hover:bg-slate-100"
          : "text-muted-foreground hover:text-foreground hover:bg-slate-100"
      }`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
    </button>
  );
}

/* ── EventCard — going / pending / invited counts ───────────────────────────── */

function EventCard({
  ev,
  invites,
  commentCount,
  onSelect,
}: {
  ev: FamilyEvent;
  invites: Invite[];
  commentCount: number;
  onSelect: () => void;
}) {
  const cat = categoryOf(ev);
  const going   = invites.filter((i) => i.status === "accepted").length;
  const pending = invites.filter((i) => i.status === "pending").length;
  const invited = invites.filter((i) => i.status === "invited").length;

  return (
    <button
      onClick={onSelect}
      className="text-left rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md hover:ring-2 hover:ring-primary/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{ev.title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {fmtDateShort(ev.started_at ?? ev.created_at)}
            {ev.closed_at ? ` – ${fmtDateShort(ev.closed_at)}` : ""}
            {ev.location ? ` • ${ev.location}` : ""}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant="secondary" className="whitespace-nowrap">{cat}</Badge>
          {ev.visibility && (
            <Badge variant="outline" className="whitespace-nowrap">
              {ev.visibility === "family" ? "❤️ Family" : ev.visibility === "open" ? "👥 Open" : "🌐 Public"}
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs flex-wrap">
        {going > 0 && (
          <Badge variant="default">{going} going</Badge>
        )}
        {pending > 0 && (
          <Badge variant="secondary">{pending} pending</Badge>
        )}
        {invited > 0 && (
          <Badge variant="outline">{invited} invited</Badge>
        )}
        {going === 0 && pending === 0 && invited === 0 && (
          <Badge variant="outline" className="text-muted-foreground">No invites yet</Badge>
        )}
        {commentCount > 0 && (
          <Badge variant="outline" className="text-muted-foreground ml-auto">
            💬 {commentCount}
          </Badge>
        )}
      </div>

      {ev.description && (
        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{ev.description}</p>
      )}
    </button>
  );
}

/* ── EventDetail — invites list + add invite + modify/close ─────────────────── */

function EventDetail({
  event,
  invites,
  canClose,
  canModify,
  session,
  familyId,
  enableVideoUpload,
  onClose,
  onModify,
  onAddInvite,
  onDeleteInvite,
  onUpdateStatus,
  onCommentCountChange,
}: {
  event: FamilyEvent;
  invites: Invite[];
  canClose: boolean;
  canModify: boolean;
  session: any;
  familyId: string | null;
  enableVideoUpload: boolean;
  onClose: () => void;
  onModify: () => void;
  onAddInvite: (name: string, email: string | null, invitedUserId?: string | null) => Promise<void>;
  onDeleteInvite: (invId: string) => Promise<void>;
  onUpdateStatus: (invId: string, status: string) => Promise<void>;
  onCommentCountChange?: (eventId: string, delta: number) => void;
}) {
  const [name, setName]   = useState("");
  const [selectedMemberUserId, setSelectedMemberUserId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [members, setMembers] = useState<{ user_id: string; profiles: { full_name: string | null; avatar_url: string | null } | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const cat = categoryOf(event);

  // Load family members for typeahead
  useEffect(() => {
    if (!familyId) return;
    fetchFamilyMembers(familyId).then((data) => setMembers(data as any)).catch(() => {});
  }, [familyId]);

  const suggestions = name.trim().length > 0
    ? members.filter((m) =>
        (m.profiles?.full_name ?? "").toLowerCase().includes(name.toLowerCase()) &&
        !invites.some((inv) => inv.full_name === m.profiles?.full_name)
      )
    : [];

  function selectMember(fullName: string, userId: string) {
    setName(fullName);
    setSelectedMemberUserId(userId);
    setShowSuggestions(false);
  }

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      await onAddInvite(name.trim(), null, selectedMemberUserId);
      setName("");
      setSelectedMemberUserId(null);
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Selected event</div>
        {/* Copy link — not shown for private (family-only) events that require membership */}
        <EventCopyLinkButton eventId={event.id} visibility={event.visibility ?? "family"} />
      </div>
      <div className="mt-1 text-lg font-bold">{event.title}</div>
      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-1">
        <span>{fmtDate(event.started_at ?? event.created_at)}</span>
        {event.closed_at && <span>– {fmtDate(event.closed_at)}</span>}
        {event.location && <span>• {event.location}</span>}
        <span>•</span>
        <Badge variant="secondary">{cat}</Badge>
        {event.visibility && event.visibility !== "family" && (
          <Badge variant="outline" className="text-[10px] px-1.5">
            {event.visibility === "open" ? "👥 Open" : "🌐 Public"}
          </Badge>
        )}
      </div>

      {event.description && (
        <p className="mt-3 text-sm text-muted-foreground">{event.description}</p>
      )}

      {canModify && (
        <Button className="mt-4 w-full" onClick={onModify}>
          Modify Event
        </Button>
      )}

      {/* Invites list */}
      <h4 className="mt-5 text-sm font-semibold">Invites</h4>
      {invites.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground italic">No invites yet.</p>
      ) : (
        <ul className="mt-2 space-y-2 max-h-60 overflow-y-auto pr-1">
          {invites.map((inv) => {
            const isOwnInvite = session?.user?.id && inv.invited_user_id === session.user.id;
            const canEditStatus = canModify || isOwnInvite;
            return (
              <li
                key={inv.id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm gap-2 ${isOwnInvite ? "bg-pink-50 border-pink-200" : "bg-background"}`}
              >
                <span className="font-medium truncate flex items-center gap-1">
                  {isOwnInvite && <span className="text-pink-500 text-[10px] font-semibold uppercase tracking-wide mr-0.5">You</span>}
                  {inv.full_name}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    className="text-xs rounded border bg-background px-1 py-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    value={inv.status}
                    onChange={(e) => onUpdateStatus(inv.id, e.target.value)}
                    disabled={!canEditStatus}
                  >
                    <option value="invited">invited</option>
                    <option value="pending">pending</option>
                    <option value="accepted">accepted</option>
                    <option value="declined">declined</option>
                  </select>
                  {canModify && (
                    <button
                      title="Remove invite"
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => onDeleteInvite(inv.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add invite form */}
      {canModify && (
        <>
          <h4 className="mt-5 text-sm font-semibold">Add invite</h4>
          <div className="mt-2 grid gap-2">
            <div className="relative">
              <Input
                placeholder="Type a family member's name…"
                value={name}
                onChange={(e) => { setName(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md text-sm overflow-hidden">
                  {suggestions.map((m) => (
                    <li
                      key={m.user_id}
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent"
                      onMouseDown={() => selectMember(m.profiles?.full_name ?? "", m.user_id)}
                    >
                      {m.profiles?.avatar_url
                        ? <img src={m.profiles.avatar_url} className="h-5 w-5 rounded-full object-cover" alt="" />
                        : <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px]">
                            {(m.profiles?.full_name ?? "?")[0].toUpperCase()}
                          </span>
                      }
                      {m.profiles?.full_name ?? "—"}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {addError && <p className="text-xs text-destructive">{addError}</p>}
            <Button
              className="w-full"
              onClick={handleAdd}
              disabled={adding || !name.trim()}
            >
              {adding && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Add Invite
            </Button>
          </div>
        </>
      )}

      {/* Close Event */}
      {canClose && !showCloseConfirm && (
        <div className="mt-4 pt-4 border-t">
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={() => setShowCloseConfirm(true)}
          >
            Close Event
          </Button>
        </div>
      )}
      {canClose && showCloseConfirm && (
        <div className="mt-4 pt-4 border-t rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <p className="text-red-800 font-medium mb-2">
            Close "{event.title}"? This marks the event as past.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => { setShowCloseConfirm(false); onClose(); }}>Close Event</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCloseConfirm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Comment Thread */}
      <div className="mt-5 pt-5 border-t">
        <CommentThread
          parentId={event.id}
          parentType="event"
          familyId={familyId}
          session={session}
          enableVideoUpload={enableVideoUpload}
          onCommentCountChange={onCommentCountChange ? (delta) => onCommentCountChange(event.id, delta) : undefined}
        />
      </div>
    </div>
  );
}

/* ── ModifyEventForm ────────────────────────────────────────────────────────── */

function ModifyEventForm({
  event,
  canDelete,
  onCancel,
  onSave,
  onDelete,
}: {
  event: FamilyEvent;
  canDelete?: boolean;
  onCancel: () => void;
  onSave: (patch: Partial<FamilyEvent>) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle]       = useState(event.title);
  const [description, setDesc]  = useState(event.description ?? "");
  const [location, setLocation] = useState(event.location ?? "");
  const [duration, setDuration] = useState(event.duration ?? "");
  const initStarted = event.started_at ? new Date(event.started_at).toISOString().slice(0, 16) : "";
  const initMode = event.started_at && new Date(event.started_at).getTime() > Date.now() ? "upcoming" : "live";
  const [statusMode, setStatusMode] = useState<"live" | "upcoming">(initMode);
  const [startedAt, setStartedAt] = useState(initStarted);
  const [visibility, setVisibility] = useState<"family" | "open" | "public">(event.visibility ?? "family");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleSave() {
    if (!title.trim()) { setError("Title is required"); return; }
    setLoading(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        duration: duration.trim() || null,
        started_at: startedAt ? new Date(startedAt).toISOString() : null,
        visibility,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 grid gap-2">
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Title</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Event status</p>
        <div className="flex gap-2">
          {([
            { value: "live",     label: "🔴 Live now",  desc: "Event is happening now" },
            { value: "upcoming", label: "📅 Upcoming",   desc: "Schedule for a future date" },
          ] as const).map(({ value, label, desc }) => (
            <button key={value} type="button" title={desc}
              onClick={() => {
                setStatusMode(value);
                if (value === "live") { setStartedAt(""); }
                else if (!startedAt) {
                  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0);
                  setStartedAt(d.toISOString().slice(0, 16));
                }
              }}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusMode === value ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {statusMode === "upcoming" && (
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Start date &amp; time</span>
          <input
            type="datetime-local"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
      )}
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Duration <span className="font-normal opacity-60">(e.g. 2 hours, all day)</span></span>
        <Input placeholder="e.g. 2 hours, all day, 30 min" value={duration} onChange={(e) => setDuration(e.target.value)} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Location</span>
        <Input
          placeholder="e.g. Maple Park, Shelter 3"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Description</span>
        <Textarea
          rows={4}
          value={description}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="What's this gathering about?"
        />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Visibility picker — compact chips, ADR-010 */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Who can see this?</p>
        <div className="flex flex-wrap gap-1.5">
          {([
            { value: "family",  icon: "❤️", short: "Family",   desc: "Visible to family members only" },
            { value: "open",    icon: "👥", short: "All users",    desc: "Any registered user can read and RSVP" },
            { value: "public",  icon: "🌐", short: "Public",       desc: "Anyone — shareable link, no login needed" },
          ] as const).map(({ value, icon, short, desc }) => (
            <button key={value} type="button" title={desc} onClick={() => setVisibility(value)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                visibility === value
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}>
              <span>{icon}</span><span>{short}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Save
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
      {canDelete && onDelete && !showDeleteConfirm && (
        <Button
          variant="destructive"
          className="w-full mt-1"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Delete Event
        </Button>
      )}
      {canDelete && onDelete && showDeleteConfirm && (
        <div className="mt-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <p className="text-red-800 font-medium mb-2">
            Delete "{event.title}"? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={onDelete} disabled={loading}>Delete</Button>
            <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── CreateEventForm ────────────────────────────────────────────────────────── */

function CreateEventForm({
  defaultStartedAt = "",
  onCancel,
  onSave,
}: {
  defaultStartedAt?: string;
  onCancel: () => void;
  onSave: (args: { title: string; description: string; location: string; duration: string; visibility: "family" | "open" | "public"; started_at: string }) => Promise<void>;
}) {
  const [title, setTitle]       = useState("New Event");
  const [description, setDesc]  = useState("");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("");
  const [statusMode, setStatusMode] = useState<"live" | "upcoming">(defaultStartedAt ? "upcoming" : "live");
  const [startedAt, setStartedAt] = useState(defaultStartedAt);
  const [visibility, setVisibility] = useState<"family" | "open" | "public">("family");
  const [loading, setLoading]   = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError]       = useState("");

  async function handleGenerate() {
    if (!title.trim()) { setError("Add a title first"); return; }
    setGenerating(true);
    setError("");
    try {
      const { description: generated } = await callEdgeFunction("generate-description", {
        title,
        hashtags: [],
      });
      setDesc(generated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!title.trim()) { setError("Title is required"); return; }
    setLoading(true);
    try {
      await onSave({ title: title.trim(), description: description.trim(), location: location.trim(), duration: duration.trim(), visibility, started_at: startedAt });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 grid gap-2">
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Title</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Event status</p>
        <div className="flex gap-2">
          {([
            { value: "live",     label: "🔴 Live now",  desc: "Event is happening now" },
            { value: "upcoming", label: "📅 Upcoming",   desc: "Schedule for a future date" },
          ] as const).map(({ value, label, desc }) => (
            <button key={value} type="button" title={desc}
              onClick={() => {
                setStatusMode(value);
                if (value === "live") { setStartedAt(""); }
                else if (!startedAt) {
                  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0);
                  setStartedAt(d.toISOString().slice(0, 16));
                }
              }}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusMode === value ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {statusMode === "upcoming" && (
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Start date &amp; time</span>
          <input
            type="datetime-local"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </label>
      )}
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Duration <span className="font-normal opacity-60">(e.g. 2 hours, all day)</span></span>
        <Input placeholder="e.g. 2 hours, all day, 30 min" value={duration} onChange={(e) => setDuration(e.target.value)} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Location</span>
        <Input
          placeholder="e.g. Maple Park, Shelter 3"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground flex items-center justify-between">
          Description
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium"
          >
            {generating
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <Sparkles className="h-3 w-3" />}
            {generating ? "Generating…" : "✨ Generate with AI"}
          </button>
        </span>
        <Textarea
          rows={4}
          value={description}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="What's this gathering about?"
        />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Visibility picker — compact chips, ADR-010 */}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Who can see this?</p>
        <div className="flex flex-wrap gap-1.5">
          {([
            { value: "family",  icon: "❤️", short: "Family",   desc: "Visible to family members only" },
            { value: "open",    icon: "👥", short: "All users",    desc: "Any registered user can read and RSVP" },
            { value: "public",  icon: "🌐", short: "Public",       desc: "Anyone — shareable link, no login needed" },
          ] as const).map(({ value, icon, short, desc }) => (
            <button key={value} type="button" title={desc} onClick={() => setVisibility(value)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                visibility === value
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}>
              <span>{icon}</span><span>{short}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          Save
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
