/**
 * /stories/:id — public-facing story page.
 * Accessible without authentication for open/public stories (ADR-010).
 * Private/family stories redirect to sign-in.
 */

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

export default function PublicStory() {
  const { id } = useParams<{ id: string }>();
  const { session, openAuthModal } = useAuth();
  const [story, setStory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [requiresSignIn, setRequiresSignIn] = useState(false);

  // Wait for auth to finish loading before fetching — prevents false requiresSignIn
  const { loading: authLoading } = useAuth();

  useEffect(() => {
    if (!id || authLoading) return; // wait until auth state is known
    // Reset state on every re-run (session changes after sign-in trigger this)
    setLoading(true);
    setStory(null);
    setNotFound(false);
    setRequiresSignIn(false);

    supabase
      .from("updates")
      .select("*, profiles(full_name, avatar_url)")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          // RLS blocked the read — either not a member (family) or not authenticated
          if (!session) { setRequiresSignIn(true); }
          else { setNotFound(true); }
        } else if (data.visibility === "private") {
          // Private = author only; non-authors get not-found even if signed in
          if (session && data.author_id === session.user.id) { setStory(data); }
          else if (!session) { setRequiresSignIn(true); }
          else { setNotFound(true); }
        } else if (data.visibility === "family") {
          // Family member can read; non-member signed-in gets not-found
          if (!session) { setRequiresSignIn(true); }
          else { setStory(data); } // RLS already confirmed membership
        } else {
          setStory(data);
        }
        setLoading(false);
      });
  }, [id, session, authLoading]); // re-run when auth state is known or session changes

  if (loading) return <div className="container py-20 text-center text-muted-foreground">Loading…</div>;

  if (requiresSignIn) {
    return (
      <div className="container py-20 flex flex-col items-center gap-5 text-center max-w-sm mx-auto">
        <div className="text-5xl">🔐</div>
        <h1 className="text-2xl font-extrabold">Sign in to read this story</h1>
        <p className="text-muted-foreground text-sm">
          This story is shared with family members. Sign in to your Family Vibes account to view it.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Button className="flex-1 bg-rose-600 hover:bg-rose-700"
            onClick={() => openAuthModal({ redirectTo: `/stories/${id}` })}>
            <LogIn className="h-4 w-4 mr-2" /> Sign in
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link to="/">Go to home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="container py-20 flex flex-col items-center gap-5 text-center max-w-sm mx-auto">
        <div className="text-5xl">🔒</div>
        <h1 className="text-2xl font-extrabold">Story not available</h1>
        <p className="text-muted-foreground text-sm">
          This story is private or you don't have access as a member of that family.
        </p>
        <Button asChild variant="outline"><Link to="/stories">Go to Stories</Link></Button>
      </div>
    );
  }

  const BANNER: Record<string, { icon: string; label: string; bg: string; text: string; border: string }> = {
    family: { icon: "❤️", label: "Family story — visible to family members",  bg: "bg-pink-50",    text: "text-pink-700",  border: "border-pink-200" },
    open:   { icon: "👥", label: "Open story — visible to registered users",   bg: "bg-blue-50",    text: "text-blue-700",  border: "border-blue-200" },
    public: { icon: "🌐", label: "Public story — visible to everyone",         bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  };
  const banner = BANNER[story.visibility] ?? BANNER.public;

  return (
    <div className="container py-10 max-w-2xl mx-auto">
      {/* Visibility banner */}
      <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 mb-6 ${banner.bg} ${banner.text} border ${banner.border}`}>
        <span>{banner.icon}</span>
        <span>{banner.label}</span>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight mb-2">{story.title}</h1>

      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <span>By {story.profiles?.full_name ?? "Family Member"}</span>
        <span>·</span>
        <span>{format(new Date(story.created_at), "MMM d, yyyy")}</span>
        {story.hashtags?.length > 0 && (
          <div className="flex gap-1 ml-2 flex-wrap">
            {story.hashtags.map((t: string) => (
              <Badge key={t} variant="outline" className="text-xs">#{t}</Badge>
            ))}
          </div>
        )}
      </div>

      {story.image_url && (
        <img src={story.image_url} alt="" className="w-full rounded-xl object-cover max-h-80 mb-6" />
      )}

      <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap leading-relaxed">
        {story.content}
      </div>

      {/* CTA for non-members */}
      {!session && (
        <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50 p-6 text-center mt-10">
          <p className="text-sm font-medium text-rose-800 mb-3">
            Want to read more family stories and create your own space?
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button className="bg-rose-600 hover:bg-rose-700"
              onClick={() => openAuthModal({ defaultTab: "signup", redirectTo: `/stories/${id}` })}>
              Start your family space →
            </Button>
            <Button variant="outline" onClick={() => openAuthModal({ redirectTo: `/stories/${id}` })}>
              Sign in
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
