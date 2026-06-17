import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AISummary from "@/components/AISummary";
import FamilyTree from "@/components/FamilyTree";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus } from "lucide-react";
import { fetchUpdates, fetchFamilyTree } from "@/lib/supabase";
import { useMemo } from "react";
import { useEvent } from "@/contexts/EventContext";
import { useFamily } from "@/contexts/FamilyContext";
import { type Member } from "@/components/FamilyTree";
import { format } from "date-fns";

type Update = {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  hashtags: string[];
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  events: { id: string; title: string; closed_at: string | null } | null;
};

export default function Index() {
  const { activeEvents } = useEvent();
  const { activeFamilyId } = useFamily();
  const [recentPosts, setRecentPosts] = useState<Update[]>([]);
  const [treeData, setTreeData] = useState<Member | undefined>(undefined);

  useEffect(() => {
    fetchUpdates({ limit: 100, familyId: activeFamilyId }).then((data) => setRecentPosts(data ?? []));
  }, [activeFamilyId]);

  useEffect(() => {
    if (!activeFamilyId) { setTreeData(undefined); return; }
    fetchFamilyTree(activeFamilyId).then((data) => setTreeData(data as Member ?? undefined));
  }, [activeFamilyId]);

  const aiSnapshot = useMemo(() => {
    const photoCount = recentPosts.filter((p) => p.image_url).length;
    const storyCount = recentPosts.length;
    const eventCount = activeEvents.length;
    const hasTree = !!treeData;
    const parts: string[] = [];

    if (eventCount > 0)
      parts.push(`${eventCount} active event${eventCount > 1 ? "s" : ""} happening now.`);
    if (storyCount > 0)
      parts.push(`${storyCount} stor${storyCount > 1 ? "ies" : "y"} shared by your family.`);
    if (photoCount > 0)
      parts.push(`${photoCount} photo${photoCount > 1 ? "s" : ""} captured so far.`);
    if (hasTree)
      parts.push("Family tree is growing.");

    if (parts.length === 0)
      return "Your family space is ready! Start by adding a story, planning an event, or building your family tree — every memory begins with a first step. 🌱";

    return parts.join(" ");
  }, [recentPosts, activeEvents, treeData]);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,hsl(var(--primary)/0.15),transparent_60%)]" />
        <div className="container relative py-20 md:py-28">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
                Private by default • Invite only
              </div>
              <h1 className="mt-4 text-4xl md:text-6xl font-extrabold tracking-tight">
                Your family's home for stories and events together
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                Write blog posts together, plan gatherings, share photos, and
                explore an interactive family tree. An AI assistant summarizes
                highlights automatically.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/events?create=1">Plan for Event</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/blogs">Start a Blog</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/family-tree">Build Family Tree</Link>
                </Button>
              </div>
            </div>
            <div className="relative min-w-0">
              <div className="rounded-2xl border bg-card p-3 shadow-xl">
                <div className="rounded-xl bg-gradient-to-br from-rose-200/40 via-primary/10 to-teal-200/40 p-4">
                  <div className="grid gap-4">
                    {/* AI Snapshot */}
                    <div className="rounded-lg border bg-background/80 px-3 py-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        AI Snapshot
                      </div>
                      <p className="mt-0.5 text-sm leading-snug line-clamp-3">
                        {aiSnapshot}
                      </p>
                    </div>
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { t: "Stories", v: recentPosts.length > 0 ? `${recentPosts.length}` : "—" },
                        { t: "Events", v: activeEvents.length > 0 ? activeEvents.length.toString() : "—" },
                        { t: "Photos", v: recentPosts.filter((p) => p.image_url).length.toString() },
                      ].map((m) => (
                        <div key={m.t} className="rounded-lg border bg-background p-2.5">
                          <div className="text-xs text-muted-foreground">{m.t}</div>
                          <div className="text-lg font-bold">{m.v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Family Tree */}
                    <div className="rounded-xl border bg-background p-3 overflow-hidden">
                      <div className="text-xs text-muted-foreground mb-2">
                        Family Tree
                      </div>
                      <div className="max-h-44 overflow-hidden">
                        <FamilyTree data={treeData} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="container py-12 md:py-16">
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            title="Member Blogs"
            desc="Any family member can write, tag, and share posts. Keep memories in one place."
            link="/blogs"
          />
          <FeatureCard
            title="Events & Groups"
            desc="Plan events, invite members, and create event groups to chat and share media."
            link="/events"
          />
          <FeatureCard
            title="AI Summaries"
            desc="Automatic highlights from posts and events. See what's new at a glance."
            link="#ai"
          />
        </div>
      </section>

      {/* AI Summary + Upcoming Events */}
      <section id="ai" className="container pb-16">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Summary of family activity
            </h2>
            <p className="mt-2 text-muted-foreground">
              Auto-generated from your family's recent stories and events.
            </p>
            <div className="mt-6">
              <AISummary posts={recentPosts} eventCount={activeEvents.length} familyId={activeFamilyId} />
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="font-semibold">
              {activeEvents.length > 0 ? "Active Events" : "Events"}
            </h3>
            <div className="mt-4 grid gap-4">
              {activeEvents.length > 0 ? (
                activeEvents.map((ev) => (
                  <div key={ev.id} className="rounded-xl border bg-background p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{ev.title}</div>
                        <div className="text-xs text-muted-foreground">
                          Started {ev.started_at ? format(new Date(ev.started_at), "MMM d") : "recently"}
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">
                        Live
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                  <CalendarPlus className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">No active events yet.</p>
                  <p className="text-xs mt-1">Plan one for your family!</p>
                </div>
              )}
            </div>
            <Button asChild className="mt-6 w-full">
              <Link to="/events">Open Events</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ title, desc, link }: { title: string; desc: string; link: string }) {
  return (
    <Link
      to={link}
      className="group rounded-2xl border bg-card p-6 shadow-sm transition hover:shadow-md"
    >
      <div className="size-10 rounded-md bg-gradient-to-br from-primary to-rose-400" />
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-4 text-sm font-medium text-primary">Explore →</div>
    </Link>
  );
}
