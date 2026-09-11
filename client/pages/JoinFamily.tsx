/**
 * /join/:code — handles both group invite codes and personal invite tokens.
 * Group code: short 8-char hash (e.g. abc12345) → join_family_by_code RPC
 * Personal token: UUID format → join_family_by_token RPC
 * ADR-004
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFamily } from "@/contexts/FamilyContext";
import { joinFamilyByCode, joinFamilyByToken } from "@/lib/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function JoinFamily() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { session, openAuthModal } = useAuth();
  const { reload, setActiveFamilyId } = useFamily();
  const [status, setStatus] = useState<"idle" | "joining" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const isTokenInvite = code ? UUID_RE.test(code) : false;

  useEffect(() => {
    if (session && status === "idle") handleJoin();
  }, [session]);

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

  if (!session) {
    return (
      <div className="container py-24 flex flex-col items-center gap-6 text-center max-w-sm mx-auto">
        <h1 className="text-2xl font-extrabold">You've been invited!</h1>
        <p className="text-muted-foreground">Sign in or create an account to join this family space.</p>
        <Button className="w-full bg-rose-600 hover:bg-rose-700" onClick={() => openAuthModal()}>
          Sign in / Sign up
        </Button>
        <p className="text-xs text-muted-foreground">
          After signing in you'll be automatically added to the family.
        </p>
      </div>
    );
  }

  if (status === "joining") {
    return (
      <div className="container py-24 text-center text-muted-foreground">
        Joining family…
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="container py-24 flex flex-col items-center gap-6 text-center max-w-sm mx-auto">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-extrabold">You've joined the family!</h1>
        <p className="text-muted-foreground">Head to your family space to see stories, events, and the family tree.</p>
        <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => navigate("/")}>Go to family space →</Button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="container py-24 flex flex-col items-center gap-6 text-center max-w-sm mx-auto">
        <h1 className="text-2xl font-extrabold text-destructive">Invite not valid</h1>
        <p className="text-muted-foreground">{error}</p>
        <p className="text-sm text-muted-foreground">
          {isTokenInvite
            ? "This personal invite link may have expired or already been used. Ask the admin to generate a new one."
            : "This group invite code may have been rotated. Ask a family member for the latest link."}
        </p>
        <Button asChild variant="outline"><Link to="/">Go home</Link></Button>
      </div>
    );
  }

  return null;
}
