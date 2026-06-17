import { useMemo } from "react";

type Post = {
  title: string;
  content: string | null;
  profiles: { full_name: string | null } | null;
};

function summarize(posts: Post[], eventCount: number) {
  if (posts.length === 0 && eventCount === 0) return null;

  const sentences: string[] = [];

  const authors = [
    ...new Set(posts.map((p) => p.profiles?.full_name).filter(Boolean)),
  ] as string[];

  if (eventCount > 0 && posts.length > 0) {
    const names = authors.slice(0, 2).join(" and ");
    sentences.push(
      `Your family is buzzing! ${names ? `${names} ${authors.length > 1 ? "have" : "has"} been sharing stories` : "Stories are being shared"} and ${eventCount > 1 ? `${eventCount} events are` : "an event is"} bringing everyone together. 🎉`,
    );
  } else if (eventCount > 0) {
    sentences.push(
      `Something exciting is happening — ${eventCount > 1 ? `${eventCount} events are` : "an event is"} bringing your family together right now. Don't miss it! 🎊`,
    );
  } else if (posts.length > 0) {
    const names = authors.slice(0, 2).join(" and ");
    sentences.push(
      `${names ? `${names} ${authors.length > 1 ? "have" : "has"} been adding to` : "Your family is building"} your family's story — keep the memories coming! 📖`,
    );
    if (posts.length >= 3)
      sentences.push(`With ${posts.length} stories shared, your family archive is growing beautifully.`);
  }

  return { sentences };
}

export default function AISummary({
  posts = [],
  eventCount = 0,
}: {
  posts?: Post[];
  eventCount?: number;
}) {
  const result = useMemo(() => summarize(posts, eventCount), [posts, eventCount]);

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="font-semibold">Family Activity Summary</h3>
      {result ? (
        <div className="mt-3 text-sm space-y-2">
          {result.sentences.map((s, i) => (
            <p key={i} className="text-foreground leading-relaxed">{s}</p>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground leading-snug">
          No activity yet — once your family adds stories or starts events, highlights will appear here automatically.
        </p>
      )}
    </div>
  );
}
