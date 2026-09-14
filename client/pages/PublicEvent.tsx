/**
 * /events/:id — public-facing event page.
 * Accessible without authentication for open/public events (ADR-010).
 * Family-only events redirect to sign-in.
 */

import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, MapPin, LogIn, ArrowLeft, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import CommentThread from "@/components/CommentThread";
import { format } from "date-fns";

export default function PublicEvent() {
  const { id } = useParams<{ id: string }>();
  const { session, openAuthModal, loading: authLoading } = useAuth();
  const { isFamilyAdmin, activeFamilyId, enableVideoUpload } = useFamily();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [requiresSignIn, setRequiresSignIn] = useState(false);

  useEffect(() => {
    if (!id || authLoading) return; // wait for auth state to be known
    setLoading(true);
    setEvent(null);
    setNotFound(false);
    setRequiresSignIn(false);

    supabase
      .from("events")
      .select("*, profiles(full_name)")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          // RLS blocked — not a member or event doesn't exist
          if (!session) { setRequiresSignIn(true); }
          else { setNotFound(true); }
        } else if (data.visibility === "family") {
          if (!session) { setRequiresSignIn(true); }
          else { setEvent(data); } // RLS confirmed membership
        } else {
          setEvent(data);
        }
        setLoading(false);
      });
  }, [id, session, authLoading]); // re-run when auth state changes

  if (loading) return <div className="container py-20 text-center text-muted-foreground">Loading…</div>;

  if (requiresSignIn) {
    return (
      <div className="container py-20 flex flex-col items-center gap-5 text-center max-w-sm mx-auto">
        <div className="text-5xl">🔐</div>
        <h1 className="text-2xl font-extrabold">Sign in to view this event</h1>
        <p className="text-muted-foreground text-sm">
          This event is shared with family members. Sign in to your Family Vibes account to view it.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <Button className="flex-1 bg-rose-600 hover:bg-rose-700"
            onClick={() => openAuthModal({ defaultTab: "signup", redirectTo: `/events/${id}` })}>
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
        <h1 className="text-2xl font-extrabold">Event not found</h1>
        <p className="text-muted-foreground text-sm">
          This event is private, has ended, or the link is incorrect.
          {!session && " Sign in if you're a family member."}
        </p>
        {!session ? (
          <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => openAuthModal({ redirectTo: `/events/${id}` })}>
            <LogIn className="h-4 w-4 mr-2" /> Sign in
          </Button>
        ) : (
          <Button asChild variant="outline"><Link to="/events">Go to Events</Link></Button>
        )}
      </div>
    );
  }

  const isPast = !!event.closed_at;
  const canEdit = session && (isFamilyAdmin || event.created_by === session.user.id);

  const BANNER: Record<string, { icon: string; label: string; bg: string; text: string; border: string }> = {
    family: { icon: "❤️", label: "Family event — visible to family members",  bg: "bg-pink-50",    text: "text-pink-700",  border: "border-pink-200" },
    open:   { icon: "👥", label: "Open event — visible to registered users",   bg: "bg-blue-50",    text: "text-blue-700",  border: "border-blue-200" },
    public: { icon: "🌐", label: "Public event — visible to everyone",         bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  };
  const banner = BANNER[event.visibility] ?? BANNER.family;

  return (
    <div className="container py-10 max-w-2xl mx-auto">
      {/* Back link */}
      <button
        onClick={() => navigate("/events")}
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Events
      </button>

      {/* Visibility banner */}
      <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 mb-6 ${banner.bg} ${banner.text} border ${banner.border}`}>
        <span>{banner.icon}</span>
        <span>{banner.label}</span>
      </div>

      <div className="flex items-start gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight">{event.title}</h1>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
            {event.location && (
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{event.location}</span>
            )}
            {event.started_at && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-4 w-4" />
                {format(new Date(event.started_at), "MMM d, yyyy")}
              </span>
            )}
            <span>By {event.profiles?.full_name ?? "Family"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={isPast ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-700 border-amber-300"}>
            {isPast ? "Past" : "Live"}
          </Badge>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/events?edit=${id}`)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Modify Event
            </Button>
          )}
        </div>
      </div>

      {event.description && (
        <p className="text-muted-foreground leading-relaxed mb-8 whitespace-pre-wrap">{event.description}</p>
      )}

      {/* Comments for signed-in users */}
      {session && (
        <div className="mt-8 pt-8 border-t">
          <CommentThread
            parentId={event.id}
            parentType="event"
            familyId={activeFamilyId}
            session={session}
            enableVideoUpload={enableVideoUpload}
          />
        </div>
      )}

      {/* CTA for non-members */}
      {!session && (
        <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50 p-6 text-center mt-8">
          <p className="text-sm font-medium text-rose-800 mb-3">
            Want to RSVP or join this family space?
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button className="bg-rose-600 hover:bg-rose-700"
              onClick={() => openAuthModal({ defaultTab: "signup", redirectTo: `/events/${id}` })}>
              Create account & RSVP
            </Button>
            <Button variant="outline" onClick={() => openAuthModal({ redirectTo: `/events/${id}` })}>
              Sign in
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
