/**
 * /join/:code — handles both group invite codes and personal invite tokens.
 * Group code: short 8-char hash (e.g. abc12345) → join_family_by_code RPC
 * Personal token: UUID format → join_family_by_token RPC
 * ADR-004
 *
 * Two-section design (no flicker):
 *   Section 1 — "You've been invited!" card, always visible
 *   Section 2 — Dynamic: sign-in form | joining spinner | success | error
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { joinFamilyByCode, joinFamilyByToken } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function JoinFamily() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { session, openAuthModal, loading: authLoading } = useAuth();
  const { reload, setActiveFamilyId } = useFamily();
  const [status, setStatus] = useState<"idle" | "joining" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const isTokenInvite = code ? UUID_RE.test(code) : false;

  // As soon as session is available and we haven't tried yet, join
  useEffect(() => {
    if (session && status === "idle") handleJoin();
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleJoin() {
    if (!code) return;
    setStatus("joining");
    try {
      const familyId = isTokenInvite
        ? await joinFamilyByToken(code)
        : await joinFamilyByCode(code);
      await reload();
      if (familyId) setActiveFamilyId(familyId as string);
      setStatus("done");
    } catch (err: any) {
      setError(err.message ?? "Could not join family.");
      setStatus("error");
    }
  }

  if (!code) {
    return (
      <div className="container py-24 text-center">
        <p className="text-muted-foreground">Invalid invite link.</p>
        <Button asChild className="mt-4"><Link to="/">Go home</Link></Button>
      </div>
    );
  }

  return (
    <div className="container py-16 max-w-sm mx-auto flex flex-col gap-6">

      {/* ── Section 1: Invitation card — always visible ─────────────────── */}
      <div className="text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="text-2xl font-extrabold">You've been invited!</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          {isTokenInvite
            ? "You've received a personal invitation to join a family space on Family Vibes."
            : "You've been invited to join a family space on Family Vibes."}
        </p>
      </div>

      <div className="border-t" />

      {/* ── Section 2: Dynamic — sign-in | joining | success | error ────── */}

      {/* Auth still loading — don't flash sign-in if session is about to arrive */}
      {authLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>

      ) : !session ? (
        /* Not signed in */
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            Sign in or create an account to join this family.
          </p>
          <Button
            className="w-full bg-rose-600 hover:bg-rose-700"
            onClick={() => openAuthModal({ redirectTo: `/join/${code}` })}
          >
            Sign in / Sign up
          </Button>
          <p className="text-xs text-muted-foreground">
            After signing in you'll be automatically added to the family.
          </p>
        </div>

      ) : status === "joining" ? (
        /* Joining in progress */
        <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Joining family…</span>
        </div>

      ) : status === "done" ? (
        /* Success */
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="font-medium text-emerald-700">✓ You've joined the family!</p>
            <p className="mt-1 text-sm text-emerald-600">
              Head to your family space to see stories, events, and the family tree.
            </p>
          </div>
          <Button
            className="w-full bg-rose-600 hover:bg-rose-700"
            onClick={() => navigate("/")}
          >
            Go to family space →
          </Button>
        </div>

      ) : status === "error" ? (
        /* Error */
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
            <p className="font-medium text-red-700">Invite not valid</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {isTokenInvite
                ? "This personal invite may have expired or already been used. Ask the admin to generate a new one."
                : "This group code may have been rotated. Ask a family member for the latest link."}
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Go home</Link>
          </Button>
        </div>

      ) : null /* idle + session = joining just started, spinner will appear */ }

    </div>
  );
}
