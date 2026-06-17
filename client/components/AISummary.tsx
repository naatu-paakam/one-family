import { useMemo } from "react";

type Post = {
  title: string;
  content: string | null;
  profiles: { full_name: string | null } | null;
};

function summarize(posts: Post[], eventCount: number) {
  if (posts.length === 0 && eventCount === 0) return null;

  const sentences: string[] = [];

  if (eventCount > 0)
    sentences.push(
      `There ${eventCount === 1 ? "is" : "are"} ${eventCount} active event${eventCount > 1 ? "s" : ""} happening right now.`,
    );

  const authors = [
    ...new Set(posts.map((p) => p.profiles?.full_name).filter(Boolean)),
  ] as string[];
  if (authors.length > 0)
    sentences.push(
      `Recent posts from ${authors.slice(0, 3).join(", ")}${authors.length > 3 ? " and others" : ""}.`,
    );

  const allText = posts
    .map((p) => [p.title, p.content].filter(Boolean).join(" "))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const stop = new Set([
    "the","a","an","and","or","but","to","of","in","on","for","with",
    "at","by","from","is","it","that","we","our","are","was","has","have",
    "this","their","they","been","be","as","an","so","no","if","its",
  ]);
  const words = allText.toLowerCase().match(/[a-z']{3,}/g) || [];
  const freq = new Map<string, number>();
  for (const w of words)
    if (!stop.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
  const keywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);

  return { sentences, keywords };
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
        <>
          <div className="mt-3 text-sm space-y-1">
            {result.sentences.map((s, i) => (
              <p key={i} className="text-foreground leading-snug">{s}</p>
            ))}
          </div>
          {result.keywords.length > 0 && (
            <div className="mt-4 text-sm">
              <div className="text-muted-foreground mb-2">Top topics</div>
              <div className="flex flex-wrap gap-2">
                {result.keywords.map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground capitalize"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground leading-snug">
          No activity yet — once your family adds stories or starts events, highlights will appear here automatically.
        </p>
      )}
    </div>
  );
}
