import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useEvent } from "@/contexts/EventContext";
import { LogOut, PenSquare, CalendarPlus } from "lucide-react"; // PenSquare/CalendarPlus used in dropdown

function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signInWithGoogle, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in to Family Vibes</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-2">
          <Button variant="outline" className="w-full" onClick={signInWithGoogle}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>
          <form onSubmit={handleEmail} className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateEventModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { startEvent } = useEvent();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      await startEvent({ title: title.trim(), description: description.trim() });
      setTitle(""); setDescription("");
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>🎉 Create Event</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <div>
            <Label htmlFor="event-title">Event name</Label>
            <Input id="event-title" placeholder="e.g. Diwali 2026, Family Reunion" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="event-desc">Description (optional)</Label>
            <Input id="event-desc" placeholder="Short description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Starting…" : "Start Event"}</Button>
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SiteHeader() {
  const location = useLocation();
  const { session, profile, signOut, authModalOpen, openAuthModal, closeAuthModal } = useAuth();
  const { activeEvents, endEvent } = useEvent();
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  const avatar = profile?.avatar_url || session?.user?.user_metadata?.picture || session?.user?.user_metadata?.avatar_url;
  const displayName = profile?.full_name || session?.user?.email || "Family Member";
  const initials = displayName[0]?.toUpperCase() ?? "?";

  const nav = [
    { to: "/", label: "Home" },
    { to: "/blogs", label: "Stories" },
    { to: "/events", label: "Events" },
    { to: "/family-tree", label: "Family Tree" },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-1.5">
            <img src="/logo.svg" alt="Family Vibes" className="h-10 w-10 rounded-lg" />
            <span className="font-extrabold tracking-tight text-xl">Family Vibes</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {nav.map((item) => (
              <NavLink key={item.to} to={item.to}
                className={({ isActive }) => cn(
                  "text-sm font-medium transition-colors hover:text-foreground/90",
                  isActive || location.pathname === item.to ? "text-foreground" : "text-foreground/60",
                )}
              >{item.label}</NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* "Plan for Event" — always visible, opens create form on Events page */}
            <Button asChild variant="outline" size="sm" aria-label="Plan for Event">
              <Link to="/events?create=1">Plan for Event</Link>
            </Button>

            {session ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={avatar ?? undefined} alt={displayName} />
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <div className="px-2 py-1.5 text-sm font-medium truncate">{displayName}</div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/blogs" className="gap-2"><PenSquare className="h-4 w-4" /> New Post</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 sm:hidden" onClick={() => setShowCreateEvent(true)}>
                      <CalendarPlus className="h-4 w-4" /> Create Event
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={signOut}>
                      <LogOut className="h-4 w-4" /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              /* "Join Family" = Sign In when logged out — matches original button position */
              <Button size="sm" aria-label="Join Family" onClick={openAuthModal}>
                Join Family
              </Button>
            )}
          </div>
        </div>

        {activeEvents.length > 0 && (
          <div className="border-t bg-amber-50 px-4 py-1.5 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-amber-700 font-medium">Live events:</span>
            {activeEvents.map((ev) => (
              <Badge key={ev.id} variant="outline" className="gap-1 bg-amber-100 border-amber-300 text-amber-800 text-xs">
                🎉 {ev.title}
                {session && (
                  <button onClick={() => { if (confirm(`Close event "${ev.title}"?`)) endEvent(ev.id); }}
                    className="ml-0.5 opacity-60 hover:opacity-100 transition" title="Close event">✕</button>
                )}
              </Badge>
            ))}
          </div>
        )}
      </header>

      <AuthModal open={authModalOpen} onClose={closeAuthModal} />
      <CreateEventModal open={showCreateEvent} onClose={() => setShowCreateEvent(false)} />
    </>
  );
}
