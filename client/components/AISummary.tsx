import { useEffect, useState } from "react";
import { callEdgeFunction } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

type Post = {
  title: string;
  content: string | null;
  profiles: { full_name: string | null } | null;
};

function fallbackSummary(posts: Post[], eventCount: number): string | null {
  if (posts.length === 0 && eventCount === 0) return null;
  const authors = [
    ...new Set(posts.map((p) => p.profiles?.full_name).filter(Boolean)),
  ] as string[];
  const names = authors.slice(0, 2).join(" and ");

  if (eventCount > 0 && posts.length > 0)
    return `Your family is buzzing! ${names ? `${names} ${authors.length > 1 ? "have" : "has"} been sharing stories` : "Stories are being shared"} and ${eventCount > 1 ? `${eventCount} events are` : "an event is"} bringing everyone together. 🎉`;
  if (eventCount > 0)
    return `Something exciting is happening — ${eventCount > 1 ? `${eventCount} events are` : "an event is"} bringing your family together right now. Don't miss it! 🎊`;
  if (posts.length > 0) {
    const line = `${names ? `${names} ${authors.length > 1 ? "have" : "has"} been adding to` : "Your family is building"} your family's story — keep the memories coming! 📖`;
    return posts.length >= 3
      ? `${line} With ${posts.length} stories shared, your family archive is growing beautifully.`
      : line;
  }
  return null;
}

export default function AISummary({
  posts = [],
  eventCount = 0,
  familyId,
}: {
  posts?: Post[];
  eventCount?: number;
  familyId?: string | null;
}) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!familyId || (posts.length === 0 && eventCount === 0)) {
      setAiText(null);
      return;
    }
    setLoading(true);
    setAiText(null);
    callEdgeFunction("generate-summary", { familyId })
      .then((res) => setAiText(res?.summary ?? null))
      .catch(() => setAiText(null))
      .finally(() => setLoading(false));
  }, [familyId, posts.length, eventCount]);

  const text = aiText ?? fallbackSummary(posts, eventCount);

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Family Activity Summary</h3>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>
      {loading && !text ? (
        <p className="mt-3 text-sm text-muted-foreground animate-pulse">
          Generating your family's highlight…
        </p>
      ) : text ? (
        <p className="mt-3 text-sm text-foreground leading-relaxed">{text}</p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground leading-snug">
          No activity yet — once your family adds stories or starts events, highlights will appear here automatically.
        </p>
      )}
    </div>
  );
}
