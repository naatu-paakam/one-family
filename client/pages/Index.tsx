import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AISummary from "@/components/AISummary";
import FamilyTree from "@/components/FamilyTree";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus, Users, MailCheck } from "lucide-react";
import { fetchUpdates, fetchFamilyTree } from "@/lib/supabase";
import { useEvent } from "@/contexts/EventContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useAuth } from "@/contexts/AuthContext";
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
  const { session, openAuthModal } = useAuth();
  const { activeEvents, loading: eventsLoading } = useEvent();
  const { activeFamilyId, activeFamily, families, loading: familiesLoading, isFamilyAdmin } = useFamily();
  const [recentPosts, setRecentPosts] = useState<Update[]>([]);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [treeData, setTreeData] = useState<Member | undefined>(undefined);

  useEffect(() => {
    setPostsLoaded(false);
    fetchUpdates({ limit: 100, familyId: activeFamilyId })
      .then((data) => setRecentPosts(data ?? []))
      .finally(() => setPostsLoaded(true));
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

  // Empty-family state: signed in but belongs to no family yet (ADR-006)
  if (session && !familiesLoading && families.length === 0) {
    const emailVerified = !!session.user.email_confirmed_at;

    // Not verified — prompt email confirmation first
    if (!emailVerified) {
      return (
        <div className="container py-24 flex flex-col items-center gap-6 text-center max-w-md mx-auto">
          <div className="h-16 w-16 rounded-2xl bg-amber-100 flex items-center justify-center">
            <MailCheck className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Check your inbox</h1>
          <p className="text-muted-foreground">
            We've sent a verification link to{" "}
            <span className="font-medium text-foreground">{session.user.email}</span>.
            Click the link in the email to activate your account — then come back here to set up your family space.
          </p>
          <p className="text-sm text-muted-foreground">
            Didn't receive it? Check your spam folder, or{" "}
            <button
              className="text-rose-600 underline underline-offset-2 hover:text-rose-700"
              onClick={async () => {
                const { supabase } = await import("@/lib/supabase");
                await supabase.auth.resend({ type: "signup", email: session.user.email! });
                alert("Verification email resent — check your inbox.");
              }}
            >
              resend the email
            </button>.
          </p>
        </div>
      );
    }

    // Verified — show create/join family options
    return (
      <div className="container py-24 flex flex-col items-center gap-6 text-center max-w-md mx-auto">
        <div className="h-16 w-16 rounded-2xl bg-rose-100 flex items-center justify-center">
          <Users className="h-8 w-8 text-rose-500" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">You're all set!</h1>
        <p className="text-muted-foreground">
          Your account is ready. Start by creating your family space, or join an existing one using an invite link shared by a family member.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Button asChild className="flex-1 bg-rose-600 hover:bg-rose-700">
            <Link to="/family-settings?create=1">Create a Family</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link to="/family-settings?join=1">Join with Invite Code</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Family bio — shown below hero when admin has written one (ADR-003) */}
      {activeFamily?.bio && (
        <div className="border-b bg-rose-50/60">
          <div className="container py-3 flex items-start gap-2">
            <p className="text-sm text-rose-800 flex-1">{activeFamily.bio}</p>
            {/* [ROLE: family-admin] */}
            {isFamilyAdmin && (
              <Link to="/family-settings" className="text-xs text-rose-600 hover:underline shrink-0">Edit</Link>
            )}
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,hsl(var(--primary)/0.15),transparent_60%)]" />
        <div className="container relative py-12 md:py-16">
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
                {/* Logged-out CTA: start your family space */}
                {!session && (
                  <Button size="lg" className="bg-rose-600 hover:bg-rose-700 text-white"
                    onClick={() => openAuthModal({ defaultTab: 'signup', redirectTo: '/family-settings?create=1' })}>
                    Start your family space →
                  </Button>
                )}
                <Button asChild size="lg" variant={session ? "default" : "outline"}>
                  <Link to="/events?create=1">Plan for Event</Link>
                </Button>
                {session && (
                  <>
                    <Button asChild size="lg" variant="outline">
                      <Link to="/stories">Start a Story</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline">
                      <Link to="/family-tree">Build Family Tree</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="relative min-w-0">
              <div className="rounded-2xl border bg-card p-3 shadow-xl">
                <div className="rounded-xl bg-gradient-to-br from-rose-200/40 via-primary/10 to-teal-200/40 p-4">
                  <div className="grid gap-4">
                    {/* Family Tree — top of hero card */}
                    <div className="rounded-xl border bg-background p-3 overflow-hidden">
                      <div className="text-xs text-muted-foreground mb-2">Family Tree</div>
                      <div className="max-h-44 overflow-hidden">
                        <FamilyTree data={treeData} />
                      </div>
                    </div>
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { t: "Stories", v: postsLoaded ? `${recentPosts.length}` : "—" },
                        { t: "Events", v: !eventsLoading ? `${activeEvents.length}` : "—" },
                        { t: "Photos", v: postsLoaded ? `${recentPosts.filter((p) => p.image_url).length}` : "—" },
                      ].map((m) => (
                        <div key={m.t} className="rounded-lg border bg-background p-2.5">
                          <div className="text-xs text-muted-foreground">{m.t}</div>
                          <div className="text-lg font-bold">{m.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Summary + Upcoming Events */}
      <section id="ai" className="container pt-6 pb-12 md:pb-16">
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

      {/* Feature cards */}
      <section className="container pb-16">
        <div className="grid gap-6 md:grid-cols-3">
          <FeatureCard
            title="Member Stories"
            desc="Any family member can write, tag, and share posts. Keep memories in one place."
            link="/stories"
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
    </div>
  );
}

function FeatureCard({ title, desc, link }: { title: string; desc: string; link: string }) {
  const cls = "group rounded-2xl border bg-card p-6 shadow-sm transition hover:shadow-md";
  const content = (
    <>
      <div className="size-10 rounded-md bg-gradient-to-br from-primary to-rose-400" />
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-4 text-sm font-medium text-primary">Explore →</div>
    </>
  );
  // Hash links (#section) must use <a> — React Router <Link> treats them as routes and won't scroll
  if (link.startsWith("#")) {
    return (
      <a href={link} className={cls}
        onClick={e => {
          e.preventDefault();
          document.getElementById(link.slice(1))?.scrollIntoView({ behavior: "smooth" });
        }}>
        {content}
      </a>
    );
  }
  return <Link to={link} className={cls}>{content}</Link>;
}
