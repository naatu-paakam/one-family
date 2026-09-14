import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Navigate, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Sparkles, Link2, Check, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEvent } from "@/contexts/EventContext";
import { useFamily } from "@/contexts/FamilyContext";
import {
  fetchUpdates,
  createUpdate,
  updateUpdate,
  deleteUpdate,
  uploadImage,
  callEdgeFunction,
  fetchStoryCommentCounts,
} from "@/lib/supabase";
import CommentThread from "@/components/CommentThread";
import { format } from "date-fns";

function isVideoUrl(url: string) {
  return /\.(mp4|mov|webm|ogg)(\?|$)/i.test(url);
}

function MediaPreview({ url, className }: { url: string; className: string }) {
  return isVideoUrl(url) ? (
    <video src={url} controls className={className} />
  ) : (
    <img src={url} alt="" className={className} />
  );
}

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Update = {
  id: string;
  title: string;
  content: string | null;
  image_url: string | null;
  hashtags: string[];
  author_id: string;
  ai_generated: boolean | null;
  event_id: string | null;
  comments_enabled: boolean;
  created_at: string;
  updated_at: string;
  visibility: "private" | "family" | "open" | "public";
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  events: { id: string; title: string; closed_at: string | null } | null;
};

type Mode = "none" | "edit" | "create";

// Original tab shape matching the repo's Blogs categories
type Tab = "all" | "published" | "draft";

function fmtDate(iso: string) {
  return format(new Date(iso), "MMM d, yyyy");
}

function parseTags(raw: string) {
  return raw
    .split(/[,\s#]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

// Map visibility to tab: private = draft, anything else = published (ADR-010)
function tabOf(p: Update): "published" | "draft" {
  return p.visibility === "private" ? "draft" : "published";
}

const VISIBILITY_LABELS: Record<string, { label: string; short: string; icon: string; description: string }> = {
  private: { label: "Private",  short: "Private to you", icon: "🔒", description: "Only you can see this — saved as draft" },
  family:  { label: "Family",   short: "Family",      icon: "❤️", description: "Visible to family members only" },
  open:    { label: "Open",     short: "All users",      icon: "👥", description: "Any registered user can read" },
  public:  { label: "Public",   short: "Public",         icon: "🌐", description: "Anyone can read — no sign-in required" },
};

function CopyLinkButton({ storyId, dim, tooltip }: { storyId: string; dim?: boolean; tooltip?: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/stories/${storyId}`;
  tooltip = tooltip ?? "Copy shareable link";

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title={tooltip}
      className={`shrink-0 rounded-full p-1.5 transition-colors ${
        copied
          ? "text-emerald-500 bg-emerald-50"
          : dim
          ? "text-muted-foreground/40 hover:text-muted-foreground hover:bg-slate-100"
          : "text-muted-foreground hover:text-foreground hover:bg-slate-100"
      }`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function Blogs() {
  const { session, openAuthModal } = useAuth();
  const { isFamilyAdmin, families, loading: familiesLoading } = useFamily();
  const { activeEvents } = useEvent();
  const { activeFamilyId, enableVideoUpload } = useFamily();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("none");
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open new story form when ?new=1 is in the URL
  useEffect(() => {
    if (searchParams.get("new") === "1" && session) {
      setMode("create");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, session]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadPosts() {
    setLoading(true);
    try {
      const data = await fetchUpdates({ limit: 100, familyId: activeFamilyId });
      setPosts(data ?? []);
      // Fetch comment counts for stories that have comments enabled
      if (data?.length) {
        const enabledIds = (data as Update[])
          .filter((p) => p.comments_enabled)
          .map((p) => p.id);
        if (enabledIds.length > 0) {
          const counts = await fetchStoryCommentCounts(enabledIds);
          setCommentCounts(counts);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  // Open edit form when ?edit=<id> is in URL (linked from story page)
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (editId && posts.length > 0) {
      const post = posts.find((p) => p.id === editId);
      if (post) {
        setSelectedId(editId);
        setMode("edit");
        setSearchParams({}, { replace: true });
      }
    }
  }, [posts, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadPosts(); }, [activeFamilyId]); // eslint-disable-line

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return posts
      .filter((p) => {
        if (tab !== "all" && tabOf(p) !== tab) return false;
        if (
          q &&
          !p.title.toLowerCase().includes(q) &&
          !(p.profiles?.full_name ?? "").toLowerCase().includes(q) &&
          !p.hashtags.join(" ").includes(q)
        )
          return false;
        return true;
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [posts, tab, query]);

  const selected = useMemo(
    () => posts.find((p) => p.id === selectedId) ?? null,
    [posts, selectedId],
  );

  const canEdit =
    selected && (isFamilyAdmin || selected.author_id === session?.user?.id);

  const startCreate = () => setMode("create");
  const cancel = () => setMode("none");

  // No-family guard: redirect to home which shows Create/Join prompts (ADR-006)
  if (session && !familiesLoading && families.length === 0) {
    return <Navigate to="/" replace />;
  }

  // Full-width create form
  if (mode === "create") {
    return (
      <div className="container py-8 max-w-2xl mx-auto">
        <button
          onClick={cancel}
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Stories
        </button>
        <h1 className="text-2xl font-bold mb-4">New Story</h1>
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <PostForm
            activeEvents={activeEvents}
            authorId={session!.user.id}
            familyId={activeFamilyId}
            enableVideoUpload={enableVideoUpload}
            onCancel={cancel}
            onSave={async (payload) => {
              const { familyId: fid, ...rest } = payload;
              const created = await createUpdate({ ...rest, familyId: fid ?? activeFamilyId });
              setPosts((prev) => [created, ...prev]);
              navigate(`/stories/${created.id}`);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col gap-8 md:grid md:grid-cols-[1fr_360px]">
        {/* Left — list */}
        <div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Family Stories
              </h1>
              <p className="mt-1 text-muted-foreground">
                Write and share stories together. Create new posts, edit drafts,
                and browse published memories.
              </p>
            </div>
            <Input
              placeholder="Search title, author, or tag"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:w-72 rounded-[10px]"
            />
          </div>

          <div className="mt-5">
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <div className="flex items-center gap-3">
                <TabsList className="flex-1">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="published">Published</TabsTrigger>
                  <TabsTrigger value="draft">Drafts</TabsTrigger>
                </TabsList>
                <Button
                  onClick={session ? startCreate : () => openAuthModal()}
                  className="h-10 w-10 rounded-full p-0 shrink-0"
                  aria-label="New Post"
                  title="New Post"
                >
                  <Plus className="h-5 w-5" />
                  <span className="sr-only">New Post</span>
                </Button>
              </div>

              {(["all", "published", "draft"] as const).map((key) => (
                <TabsContent key={key} value={key}>
                  {loading ? (
                    <div className="flex justify-center py-16">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {filtered.map((p) => (
                        <PostCard
                          key={p.id}
                          post={p}
                          commentCount={commentCounts[p.id]}
                          onSelect={() => navigate(`/stories/${p.id}`)}
                        />
                      ))}
                      {filtered.length === 0 && (
                        <div className="col-span-full rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                          No posts match.
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>

        {/* Right — edit form */}
        {mode === "edit" && (
          <aside className="md:sticky md:top-20 h-max rounded-xl border bg-card p-5 shadow-sm">
            {mode === "edit" && selected && canEdit ? (
              <div>
                <div className="text-sm text-muted-foreground">Edit post</div>
                <PostForm
                  post={selected}
                  activeEvents={activeEvents}
                  authorId={session!.user.id}
                  familyId={activeFamilyId}
                  enableVideoUpload={enableVideoUpload}
                  onCancel={() => { cancel(); navigate(`/stories/${selected.id}`); }}
                  onSave={async (payload) => {
                    const { familyId: _fid, ...rest } = payload;
                    const updated = await updateUpdate(selected.id, rest);
                    setPosts((prev) =>
                      prev.map((p) => (p.id === selected.id ? { ...p, ...updated } : p)),
                    );
                    navigate(`/stories/${selected.id}`);
                  }}
                  onDelete={async () => {
                    await deleteUpdate(selected.id);
                    setPosts((prev) => prev.filter((p) => p.id !== selected.id));
                    setSelectedId(null);
                    cancel();
                  }}
                />
              </div>
            ) : null}
          </aside>
        )}
      </div>
    </div>
  );
}

/* ── PostCard — matches original style exactly ─────────────────────────────── */

function PostCard({
  post,
  commentCount,
  onSelect,
}: {
  post: Update;
  commentCount?: number;
  onSelect: () => void;
}) {
  const author = post.profiles?.full_name ?? "Family Member";
  return (
    <button
      onClick={onSelect}
      className="text-left rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md hover:ring-2 hover:ring-primary/20"
    >
      {post.image_url && (
        <MediaPreview url={post.image_url} className="w-full h-28 object-cover rounded-lg mb-3" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold line-clamp-2">{post.title}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            By {author} • {fmtDate(post.created_at)}
          </div>
        </div>
        <Badge variant={post.visibility === "private" ? "outline" : "secondary"} className="shrink-0 whitespace-nowrap">
          {VISIBILITY_LABELS[post.visibility]?.icon} {VISIBILITY_LABELS[post.visibility]?.label ?? post.visibility}
        </Badge>
      </div>
      {post.events && (
        <Badge variant="outline" className="mt-1 text-amber-700 border-amber-300 bg-amber-50 text-[10px]">
          🎉 {post.events.title}
        </Badge>
      )}
      {post.hashtags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 text-xs">
          {post.hashtags.map((t) => (
            <Badge key={t} variant="outline">#{t}</Badge>
          ))}
        </div>
      )}
      <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
        {post.content}
      </p>
      {post.comments_enabled && commentCount != null && commentCount > 0 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <span>💬</span>
          <span>{commentCount} comment{commentCount !== 1 ? "s" : ""}</span>
        </div>
      )}
    </button>
  );
}

/* ── PostForm ──────────────────────────────────────────────────────────────── */

type FormPayload = {
  title: string;
  content: string | null;
  image_url: string | null;
  hashtags: string[];
  author_id: string;
  event_id: string | null;
  comments_enabled: boolean;
  visibility: "private" | "family" | "open" | "public";
  familyId?: string | null;
};

function PostForm({
  post,
  activeEvents,
  authorId,
  familyId,
  enableVideoUpload,
  onCancel,
  onSave,
  onDelete,
}: {
  post?: Update;
  activeEvents: { id: string; title: string }[];
  authorId: string;
  familyId: string | null;
  enableVideoUpload: boolean;
  onCancel: () => void;
  onSave: (p: FormPayload) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [title, setTitle] = useState(post?.title ?? "New Post");
  const [visibility, setVisibility] = useState<"private" | "family" | "open" | "public">(post?.visibility ?? "private");
  const [commentsEnabled, setCommentsEnabled] = useState(post?.comments_enabled ?? false);
  // Multi-section content: existing posts split on double-newline, new posts start with one section
  const [sections, setSections] = useState<string[]>(
    post?.content ? post.content.split(/\n\n+/) : [""]
  );
  const [generatingIdx, setGeneratingIdx] = useState<number | null>(null);
  const [tags, setTags] = useState((post?.hashtags ?? []).join(", "));
  const [selectedEventId, setSelectedEventId] = useState(post?.event_id ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(post?.image_url ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function updateSection(idx: number, val: string) {
    setSections((prev) => prev.map((s, i) => i === idx ? val : s));
  }

  function addSectionAfter(idx: number) {
    setSections((prev) => [...prev.slice(0, idx + 1), "", ...prev.slice(idx + 1)]);
  }

  function removeSection(idx: number) {
    setSections((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type.startsWith("video/") && !enableVideoUpload) {
      setError("Video uploads require a subscription plan.");
      e.target.value = "";
      return;
    }
    const maxMB = file.type.startsWith("video/") ? 40 : 10;
    if (file.size > maxMB * 1024 * 1024) {
      setError(`File too large — max ${maxMB}MB for ${file.type.startsWith("video/") ? "videos" : "images"}. Try compressing it first.`);
      e.target.value = "";
      return;
    }
    setError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleGenerate(idx: number) {
    if (!title.trim()) { setError("Add a title first"); return; }
    setGeneratingIdx(idx);
    setError("");
    try {
      let uploadedUrl: string | null = null;
      if (imageFile && !imageFile.type.startsWith("video/")) {
        uploadedUrl = await uploadImage(imageFile, familyId);
        setImagePreview(uploadedUrl);
        setImageFile(null);
      }
      const { description } = await callEdgeFunction("generate-description", {
        title,
        content: sections[idx].trim() || null,
        imageUrl: uploadedUrl,
        hashtags: parseTags(tags),
        eventId: selectedEventId || null,
        authorId,
        familyId,
      });
      updateSection(idx, description);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGeneratingIdx(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError("");
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, familyId);
      } else if (imagePreview?.startsWith("http")) {
        imageUrl = imagePreview;
      }
      const combined = sections.map((s) => s.trim()).filter(Boolean).join("\n\n") || null;
      await onSave({
        title: title.trim(),
        content: combined,
        image_url: imageUrl,
        hashtags: parseTags(tags),
        author_id: authorId,
        event_id: selectedEventId || null,
        comments_enabled: commentsEnabled,
        visibility,
        familyId,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 grid gap-2">
      {/* Event selector */}
      {activeEvents.length > 0 && (
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Attach to event</span>
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger>
              <SelectValue placeholder="— Main timeline —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— Main timeline —</SelectItem>
              {activeEvents.map((ev) => (
                <SelectItem key={ev.id} value={ev.id}>🎉 {ev.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      )}

      {/* Photo / Video */}
      <div className="grid gap-1">
        <span className="text-xs text-muted-foreground">Photo or Video (optional)</span>
        <label className="block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition">
          {imagePreview ? (
            imageFile?.type.startsWith("video/") || isVideoUrl(imagePreview) ? (
              <video src={imagePreview} className="max-h-28 mx-auto rounded-md pointer-events-none" />
            ) : (
              <img src={imagePreview} alt="" className="max-h-28 mx-auto rounded-md object-contain" />
            )
          ) : (
            <span className="text-xs text-muted-foreground">{enableVideoUpload ? "Click to upload a photo or video" : "Click to upload a photo"}</span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={enableVideoUpload ? "image/*,video/*" : "image/*"}
            className="sr-only"
            onChange={handleFile}
          />
        </label>
        {imagePreview && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-destructive text-right"
            onClick={() => { setImagePreview(""); setImageFile(null); }}
          >
            Remove
          </button>
        )}
      </div>

      {/* Title */}
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Title</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      {/* Tags */}
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Tags (comma or # separated)</span>
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="#family #birthday"
        />
      </label>

      {/* Multi-section content */}
      <div className="grid gap-1">
        <span className="text-xs text-muted-foreground">Content</span>
        {sections.map((sec, idx) => (
          <div key={idx} className="grid gap-1">
            <span className="text-xs text-muted-foreground flex items-center justify-between">
              {sections.length > 1 && (
                <span className="text-muted-foreground/60">Section {idx + 1}</span>
              )}
              <span className="ml-auto flex items-center gap-2">
                {sections.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSection(idx)}
                    className="text-muted-foreground/50 hover:text-destructive text-xs"
                  >
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleGenerate(idx)}
                  disabled={generatingIdx !== null}
                  className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium"
                >
                  {generatingIdx === idx
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Sparkles className="h-3 w-3" />}
                  {generatingIdx === idx ? "Generating…" : "✨ Generate with AI"}
                </button>
              </span>
            </span>
            <Textarea
              rows={5}
              value={sec}
              onChange={(e) => updateSection(idx, e.target.value)}
              placeholder="Add a description or let AI generate one…"
            />
            <button
              type="button"
              onClick={() => addSectionAfter(idx)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mx-auto mt-1"
            >
              <Plus className="h-3 w-3" /> Add section
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Visibility picker — compact chips, ADR-010 */}
      <div className="mt-3">
        <p className="text-xs text-muted-foreground mb-1.5">Who can see this?</p>
        <div className="flex flex-wrap gap-1.5">
          {(["private", "family", "open", "public"] as const).map((v) => {
            const meta = VISIBILITY_LABELS[v];
            const selected = visibility === v;
            return (
              <button
                key={v}
                type="button"
                title={meta.description}
                onClick={() => setVisibility(v)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "bg-slate-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Comments toggle — only relevant for published posts */}
      {post && (
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={commentsEnabled}
            onChange={(e) => setCommentsEnabled(e.target.checked)}
            className="h-3.5 w-3.5 rounded"
          />
          Allow comments
        </label>
      )}

      <div className="mt-2 flex gap-2">
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          {visibility === "private" ? "Save draft" : "Save"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
      {onDelete && !showDeleteConfirm && (
        <Button
          variant="destructive"
          className="w-full mt-1"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Delete Post
        </Button>
      )}
      {onDelete && showDeleteConfirm && (
        <div className="mt-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <p className="text-red-800 font-medium mb-2">Delete this post? This cannot be undone.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={onDelete} disabled={saving}>Delete</Button>
            <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
