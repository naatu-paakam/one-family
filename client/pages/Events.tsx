import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEvent } from "@/contexts/EventContext";
import { useFamily } from "@/contexts/FamilyContext";
import {
  fetchUpdates,
  callEdgeFunction,
  fetchAllInvites,
  addInvite,
  updateInviteStatus,
  updateEvent,
} from "@/lib/supabase";
import { format } from "date-fns";

/* ── Types ──────────────────────────────────────────────────────────────────── */

type FamilyEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  started_at: string | null;
  closed_at: string | null;
  created_by: string;
  created_at: string;
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
  const { activeFamilyId } = useFamily();

  const [allEvents, setAllEvents] = useState<FamilyEvent[]>([]);
  const [eventPosts, setEventPosts] = useState<Record<string, Post[]>>({});
  const [invitesByEvent, setInvitesByEvent] = useState<Record<string, Invite[]>>({});
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
        const posts = await fetchUpdates({ limit: 200, familyId: activeFamilyId });
        const evMap: Record<string, FamilyEvent> = {};
        for (const p of posts ?? []) {
          if (p.events && !evMap[p.events.id]) {
            evMap[p.events.id] = p.events as unknown as FamilyEvent;
          }
        }
        for (const ev of activeEvents) {
          evMap[ev.id] = ev as unknown as FamilyEvent;
        }
        const evList = Object.values(evMap).sort(
          (a, b) =>
            new Date(b.created_at ?? b.started_at ?? 0).getTime() -
            new Date(a.created_at ?? a.started_at ?? 0).getTime(),
        );
        setAllEvents(evList);
        if (!selectedId && evList.length) setSelectedId(evList[0].id);

        const map: Record<string, Post[]> = {};
        for (const p of posts ?? []) {
          if (p.event_id) {
            if (!map[p.event_id]) map[p.event_id] = [];
            map[p.event_id].push(p as any);
          }
        }
        setEventPosts(map);

        // Load invites for all events
        const ids = evList.map((e) => e.id);
        if (ids.length > 0) {
          const allInvites = await fetchAllInvites(ids);
          const invMap: Record<string, Invite[]> = {};
          for (const inv of allInvites as Invite[]) {
            if (!invMap[inv.event_id]) invMap[inv.event_id] = [];
            invMap[inv.event_id].push(inv);
          }
          setInvitesByEvent(invMap);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeEvents, activeFamilyId]); // eslint-disable-line react-hooks/exhaustive-deps

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
        new Date(a.started_at ?? a.created_at).getTime() -
        new Date(b.started_at ?? b.created_at).getTime(),
      );
  }, [allEvents, tab, query]);

  const selected = useMemo(
    () => allEvents.find((e) => e.id === selectedId) ?? filtered[0] ?? null,
    [allEvents, selectedId, filtered],
  );

  async function handleAddInvite(eventId: string, full_name: string, email: string | null) {
    const inv = await addInvite(eventId, full_name, email) as Invite;
    setInvitesByEvent((prev) => ({
      ...prev,
      [eventId]: [...(prev[eventId] ?? []), inv],
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
              <div className="grid gap-5 md:grid-cols-2 items-center">
                <TabsList>
                  <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                  <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
                  <TabsTrigger value="past">Past</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
                <div className="flex md:justify-end">
                  <Button
                    onClick={session ? () => setMode("create") : openAuthModal}
                    className="h-10 w-10 rounded-full p-0"
                    aria-label="New Event"
                    title="New Event"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="sr-only">New Event</span>
                  </Button>
                </div>
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
                          active={selected?.id === ev.id}
                          onSelect={() => {
                            setSelectedId(ev.id);
                            setMode("none");
                          }}
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

        {/* Right — detail / create / edit */}
        <aside className="md:sticky md:top-20 h-max rounded-xl border bg-card p-5 shadow-sm">
          {mode === "create" ? (
            <div>
              <div className="text-sm text-muted-foreground">Create event</div>
              <CreateEventForm
                onCancel={() => setMode("none")}
                onSave={async ({ title, description, location }) => {
                  await startEvent({ title, description, location });
                  setMode("none");
                }}
              />
            </div>
          ) : mode === "edit" && selected ? (
            <div>
              <div className="text-sm text-muted-foreground">Modify event</div>
              <ModifyEventForm
                event={selected}
                onCancel={() => setMode("none")}
                onSave={(patch) => handleModifyEvent(selected.id, patch)}
              />
            </div>
          ) : selected ? (
            <EventDetail
              event={selected}
              invites={invitesByEvent[selected.id] ?? []}
              canClose={
                !!session &&
                !selected.closed_at &&
                activeEvents.some((e) => e.id === selected.id)
              }
              canModify={!!session}
              onClose={() => {
                if (confirm(`Close event "${selected.title}"?`)) endEvent(selected.id);
              }}
              onModify={() => setMode("edit")}
              onAddInvite={(name, email) => handleAddInvite(selected.id, name, email)}
              onUpdateStatus={(invId, status) =>
                handleUpdateInviteStatus(invId, selected.id, status)
              }
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              Select an event to manage invites.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── EventCard — going / pending / invited counts ───────────────────────────── */

function EventCard({
  ev,
  invites,
  active,
  onSelect,
}: {
  ev: FamilyEvent;
  invites: Invite[];
  active?: boolean;
  onSelect: () => void;
}) {
  const cat = categoryOf(ev);
  const going   = invites.filter((i) => i.status === "accepted").length;
  const pending = invites.filter((i) => i.status === "pending").length;
  const invited = invites.filter((i) => i.status === "invited").length;

  return (
    <button
      onClick={onSelect}
      className={`text-left rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md ${active ? "ring-2 ring-primary/30" : ""}`}
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
        <Badge variant="secondary">{cat}</Badge>
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
  onClose,
  onModify,
  onAddInvite,
  onUpdateStatus,
}: {
  event: FamilyEvent;
  invites: Invite[];
  canClose: boolean;
  canModify: boolean;
  onClose: () => void;
  onModify: () => void;
  onAddInvite: (name: string, email: string | null) => Promise<void>;
  onUpdateStatus: (invId: string, status: string) => Promise<void>;
}) {
  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const cat = categoryOf(event);

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      await onAddInvite(name.trim(), email.trim() || null);
      setName("");
      setEmail("");
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      <div className="text-sm text-muted-foreground">Selected event</div>
      <div className="mt-1 text-lg font-bold">{event.title}</div>
      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-1">
        <span>{fmtDate(event.started_at ?? event.created_at)}</span>
        {event.closed_at && <span>– {fmtDate(event.closed_at)}</span>}
        {event.location && <span>• {event.location}</span>}
        <span>•</span>
        <Badge variant="secondary">{cat}</Badge>
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
          {invites.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm gap-2"
            >
              <span className="font-medium truncate">{inv.full_name}</span>
              <select
                className="text-xs rounded border bg-background px-1 py-0.5 cursor-pointer"
                value={inv.status}
                onChange={(e) => onUpdateStatus(inv.id, e.target.value)}
                disabled={!canModify}
              >
                <option value="invited">invited</option>
                <option value="pending">pending</option>
                <option value="accepted">accepted</option>
                <option value="declined">declined</option>
              </select>
            </li>
          ))}
        </ul>
      )}

      {/* Add invite form */}
      {canModify && (
        <>
          <h4 className="mt-5 text-sm font-semibold">Add invite</h4>
          <div className="mt-2 grid gap-2">
            <Input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Input
              placeholder="Email (optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
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
      {canClose && (
        <div className="mt-4 pt-4 border-t">
          <Button
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={onClose}
          >
            Close Event
          </Button>
        </div>
      )}
    </div>
  );
}

/* ── ModifyEventForm ────────────────────────────────────────────────────────── */

function ModifyEventForm({
  event,
  onCancel,
  onSave,
}: {
  event: FamilyEvent;
  onCancel: () => void;
  onSave: (patch: Partial<FamilyEvent>) => Promise<void>;
}) {
  const [title, setTitle]       = useState(event.title);
  const [description, setDesc]  = useState(event.description ?? "");
  const [location, setLocation] = useState(event.location ?? "");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleSave() {
    if (!title.trim()) { setError("Title is required"); return; }
    setLoading(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
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

/* ── CreateEventForm ────────────────────────────────────────────────────────── */

function CreateEventForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (args: { title: string; description: string; location: string }) => Promise<void>;
}) {
  const [title, setTitle]       = useState("New Event");
  const [description, setDesc]  = useState("");
  const [location, setLocation] = useState("");
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
      await onSave({ title: title.trim(), description: description.trim(), location: location.trim() });
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
