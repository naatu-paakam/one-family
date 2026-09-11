import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  BookOpen,
  CalendarDays,
  GitBranch,
  Sparkles,
  Users,
  ShieldCheck,
  Check,
  X,
  Minus,
  Newspaper,
  Radio,
} from "lucide-react";

const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "No algorithm, no ads, no selling your family's memories. Invite-only means only the people you choose can see your space.",
    color: "text-rose-500",
    bg: "bg-rose-50",
  },
  {
    icon: BookOpen,
    title: "Stories, not posts",
    body: "Long-form family blogs with sections, photos, and context — not a vanishing feed. Your stories are readable ten years from now.",
    color: "text-violet-500",
    bg: "bg-violet-50",
  },
  {
    icon: CalendarDays,
    title: "Events that close the loop",
    body: "Plan, invite, RSVP, and link stories to events. Track who's coming, who's pending, and let the event live on as a memory.",
    color: "text-amber-500",
    bg: "bg-amber-50",
  },
  {
    icon: GitBranch,
    title: "A living family tree",
    body: "Not a genealogy research tool — a collaborative tree your whole family edits together. Auto-saves as you type.",
    color: "text-emerald-500",
    bg: "bg-emerald-50",
  },
  {
    icon: Sparkles,
    title: "AI that works for you",
    body: "AI writes event descriptions and blog drafts from a single sentence. An AI snapshot greets you with live counts of what's happening.",
    color: "text-sky-500",
    bg: "bg-sky-50",
  },
  {
    icon: Users,
    title: "Multiple families, one login",
    body: "Belong to your nuclear family, in-laws, and extended network — switch between them in one click without signing out.",
    color: "text-pink-500",
    bg: "bg-pink-50",
  },
  {
    icon: Newspaper,
    title: "Stories become magazines",
    body: "Monthly stories can be compiled into a print-ready family magazine — a real keepsake to mail to elders who aren't on screens.",
    color: "text-orange-500",
    bg: "bg-orange-50",
  },
  {
    icon: Radio,
    title: "Live events, not just RSVPs",
    body: "Family members stream updates from their phones in real time — photos, moments, cheers — so everyone feels present, wherever they are.",
    color: "text-teal-500",
    bg: "bg-teal-50",
  },
];

type Mark = "yes" | "no" | "partial";

interface Competitor {
  name: string;
  emoji: string;
}

interface Row {
  feature: string;
  scores: Mark[];
}

const COMPETITORS: Competitor[] = [
  { name: "Facebook Groups", emoji: "👥" },
  { name: "WhatsApp", emoji: "💬" },
  { name: "Google Photos", emoji: "🖼️" },
  { name: "Ancestry", emoji: "🌳" },
  { name: "FamilyWall", emoji: "🏠" },
  { name: "Family Vibes", emoji: "❤️" },
];

// scores order matches COMPETITORS order above
const ROWS: Row[] = [
  { feature: "Private, no ads", scores: ["no", "yes", "yes", "partial", "yes", "yes"] },
  { feature: "Family stories / blogs", scores: ["no", "no", "no", "no", "partial", "yes"] },
  { feature: "Events with RSVP", scores: ["partial", "no", "no", "no", "partial", "yes"] },
  { feature: "Interactive family tree", scores: ["no", "no", "no", "yes", "partial", "yes"] },
  { feature: "AI-powered features", scores: ["no", "no", "partial", "no", "no", "yes"] },
  { feature: "Multiple families", scores: ["partial", "yes", "no", "no", "no", "yes"] },
  { feature: "No algorithm / feed", scores: ["no", "yes", "yes", "yes", "yes", "yes"] },
  { feature: "Free to use", scores: ["yes", "yes", "yes", "no", "partial", "yes"] },
  { feature: "Print-ready family magazine", scores: ["no", "no", "no", "no", "no", "yes"] },
  { feature: "Live event streaming", scores: ["partial", "partial", "no", "no", "no", "yes"] },
];

function MarkIcon({ mark }: { mark: Mark }) {
  if (mark === "yes")
    return <Check className="h-4 w-4 text-emerald-500 mx-auto" strokeWidth={2.5} />;
  if (mark === "no")
    return <X className="h-4 w-4 text-rose-400 mx-auto" strokeWidth={2.5} />;
  return <Minus className="h-4 w-4 text-amber-400 mx-auto" strokeWidth={2.5} />;
}

const TESTIMONIALS = [
  {
    quote: "We tried a Facebook Group but grandma's posts kept getting buried by ads. Family Vibes just works.",
    name: "Priya M.",
    tag: "NaatuPaakam family",
  },
  {
    quote: "The AI description saved me 20 minutes writing a Diwali event invite. I just typed the name and it did the rest.",
    name: "Rajan K.",
    tag: "Family admin",
  },
  {
    quote: "Finally a family tree that actually saves automatically. No more losing edits.",
    name: "Sunita V.",
    tag: "Family historian",
  },
];

export default function WhyFamilyVibes() {
  const { session, openAuthModal } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-rose-50 via-pink-50 to-violet-50 py-24 px-4">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-rose-100/60 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-violet-100/60 blur-3xl" />
        </div>
        <div className="relative container max-w-3xl mx-auto text-center">
          <Badge className="mb-4 bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100">
            ❤️ Why Family Vibes?
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6 leading-tight">
            Your family deserves better than a WhatsApp group and a Facebook feed
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Family Vibes is a private, invite-only space for your family's stories, events,
            and family tree — with AI that helps you capture memories, not just scroll past them.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {session ? (
              <Button asChild size="lg" className="bg-rose-600 hover:bg-rose-700 text-white">
                <Link to="/">Go to your family space →</Link>
              </Button>
            ) : (
              <Button size="lg" className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => openAuthModal()}>
                Join your family for free →
              </Button>
            )}
            <Button asChild size="lg" variant="outline">
              <Link to="/">See it live on the home page</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section className="py-16 px-4 bg-white">
        <div className="container max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-3 text-center">The problem with every other option</h2>
          <p className="text-muted-foreground text-center mb-10">
            You've probably tried these already. Here's why they fall short for a real family.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                tool: "Facebook Groups",
                pain: "Your family memories are the product. Ads, algorithmic noise, and privacy defaults that change without warning.",
              },
              {
                tool: "WhatsApp groups",
                pain: "Messages vanish in the scroll. No structure, no search, no RSVP, no tree. Great for quick chats, terrible for memories.",
              },
              {
                tool: "Google Photos",
                pain: "Photos only. No stories, no events, no tree. Not a shared space — just a synced camera roll.",
              },
              {
                tool: "Ancestry / MyHeritage",
                pain: "$40+/month for a research tool. Overkill for most families who just want to record who's related to whom.",
              },
              {
                tool: "FamilyWall",
                pain: "Closest competitor, but the UI is dated, AI is absent, and the tree editor hasn't kept up.",
              },
              {
                tool: "Shared iCloud / Drive folders",
                pain: "Not social. No context, no stories, no events. Files, not memories.",
              },
            ].map(({ tool, pain }) => (
              <div key={tool} className="rounded-xl border p-5 bg-slate-50">
                <p className="font-semibold text-sm mb-1">{tool}</p>
                <p className="text-sm text-muted-foreground">{pain}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Six pillars */}
      <section className="py-16 px-4 bg-gradient-to-b from-slate-50 to-white">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-2 text-center">What makes Family Vibes different</h2>
          <p className="text-muted-foreground text-center mb-10">Six things we care about that others don't.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {PILLARS.map(({ icon: Icon, title, body, color, bg }) => (
              <div key={title} className="rounded-xl border p-6 bg-white shadow-sm hover:shadow-md transition-shadow">
                <div className={`inline-flex p-2.5 rounded-lg ${bg} mb-4`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="py-16 px-4 bg-white">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-2 text-center">How we compare</h2>
          <p className="text-muted-foreground text-center mb-10">
            An honest look at what each tool actually does.
          </p>
          <div className="overflow-x-auto rounded-xl border shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="text-left py-3 px-4 font-semibold text-muted-foreground w-48">Feature</th>
                  {COMPETITORS.map((c, i) => (
                    <th
                      key={c.name}
                      className={`py-3 px-3 text-center font-semibold text-xs ${
                        i === COMPETITORS.length - 1
                          ? "bg-rose-50 text-rose-700 border-l-2 border-rose-200"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span className="block text-base mb-0.5">{c.emoji}</span>
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, ri) => (
                  <tr key={row.feature} className={`border-b ${ri % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                    <td className="py-3 px-4 font-medium text-foreground">{row.feature}</td>
                    {row.scores.map((mark, ci) => (
                      <td
                        key={ci}
                        className={`py-3 px-3 text-center ${
                          ci === row.scores.length - 1
                            ? "bg-rose-50/60 border-l-2 border-rose-200"
                            : ""
                        }`}
                      >
                        <MarkIcon mark={mark} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 bg-slate-50 border-t text-xs text-muted-foreground flex gap-4">
              <span><Check className="h-3 w-3 inline text-emerald-500 mr-1" />Full support</span>
              <span><Minus className="h-3 w-3 inline text-amber-400 mr-1" />Partial / limited</span>
              <span><X className="h-3 w-3 inline text-rose-400 mr-1" />Not supported</span>
            </div>
          </div>
        </div>
      </section>

      {/* For whom */}
      <section className="py-16 px-4 bg-gradient-to-b from-slate-50 to-white">
        <div className="container max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-2">Who is this for?</h2>
          <p className="text-muted-foreground mb-10">Family Vibes fits naturally into these situations.</p>
          <div className="grid sm:grid-cols-3 gap-4 text-left">
            {[
              {
                emoji: "🏡",
                who: "Nuclear families",
                what: "Keep a private journal of your family's year — events, stories, photos — all in one place.",
              },
              {
                emoji: "🌏",
                who: "Extended / diaspora families",
                what: "Stay connected across time zones. Share updates, plan reunions, preserve heritage stories.",
              },
              {
                emoji: "👴",
                who: "Families with elders",
                what: "Capture grandparents' stories before they're lost. Build a tree they can browse with their grandchildren.",
              },
            ].map(({ emoji, who, what }) => (
              <div key={who} className="rounded-xl border p-5 bg-white shadow-sm">
                <div className="text-3xl mb-3">{emoji}</div>
                <h3 className="font-semibold mb-1">{who}</h3>
                <p className="text-sm text-muted-foreground">{what}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4 bg-white">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-10 text-center">What families say</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ quote, name, tag }) => (
              <div key={name} className="rounded-xl border p-6 bg-slate-50">
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{quote}"</p>
                <p className="font-semibold text-sm">{name}</p>
                <p className="text-xs text-muted-foreground">{tag}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="py-16 px-4 bg-gradient-to-b from-slate-50 to-white">
        <div className="container max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-teal-100 text-teal-700 border-teal-200 hover:bg-teal-100">🚀 What's coming</Badge>
          <h2 className="text-2xl font-bold mb-2">One platform. Every family moment.</h2>
          <p className="text-muted-foreground mb-10 max-w-xl mx-auto">
            Family Vibes is growing into a full family event platform — not just a place to plan, but to experience events together in real time.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 text-left">
            {[
              {
                emoji: "📰",
                title: "Monthly family magazine",
                status: "In design",
                statusColor: "bg-amber-100 text-amber-700",
                body: "Automatically compile your month's stories into a beautifully formatted PDF magazine. Print it, mail it, or share it — a keepsake for grandparents who aren't online.",
              },
              {
                emoji: "📡",
                title: "Live event streaming",
                status: "Coming soon",
                statusColor: "bg-teal-100 text-teal-700",
                body: "Family members stream moments from their phones during a wedding, naming ceremony, or reunion. Everyone sees updates live — near or far — and reacts in real time.",
              },
              {
                emoji: "🎮",
                title: "Event games & polls",
                status: "On the roadmap",
                statusColor: "bg-violet-100 text-violet-700",
                body: "Run live polls, trivia, and family games during events. Vote on the best dish at the potluck, guess the baby name, pick the reunion location — all from the event page.",
              },
            ].map(({ emoji, title, status, statusColor, body }) => (
              <div key={title} className="rounded-xl border p-6 bg-white shadow-sm">
                <div className="text-3xl mb-3">{emoji}</div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">{title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{status}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-rose-50 via-pink-50 to-violet-50">
        <div className="container max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold mb-4 tracking-tight">
            Your family's stories deserve a real home
          </h2>
          <p className="text-muted-foreground mb-8">
            Free to start. No credit card. No ads. Just your family.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {session ? (
              <Button asChild size="lg" className="bg-rose-600 hover:bg-rose-700 text-white">
                <Link to="/">Go to your family space →</Link>
              </Button>
            ) : (
              <Button size="lg" className="bg-rose-600 hover:bg-rose-700 text-white" onClick={() => openAuthModal()}>
                Join your family for free →
              </Button>
            )}
            <Button asChild size="lg" variant="outline">
              <Link to="/family-tree">Explore the family tree →</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
