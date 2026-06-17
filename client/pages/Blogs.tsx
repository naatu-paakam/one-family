import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Sparkles } from "lucide-react";
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
} from "@/lib/supabase";
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
  created_at: string;
  updated_at: string;
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

// Map Supabase posts to the tab categories:
// "published" = posts with content, "draft" = posts without content
function tabOf(p: Update): "published" | "draft" {
  return p.content?.trim() ? "published" : "draft";
}

export default function Blogs() {
  const { session, isAdmin, openAuthModal } = useAuth();
  const { activeEvents } = useEvent();
  const { activeFamilyId, enableVideoUpload } = useFamily();

  const [posts, setPosts] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("none");

  async function loadPosts() {
    setLoading(true);
    try {
      const data = await fetchUpdates({ limit: 100, familyId: activeFamilyId });
      setPosts(data ?? []);
      if (!selectedId && data?.length) setSelectedId(data[0].id);
    } finally {
      setLoading(false);
    }
  }

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
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [posts, tab, query]);

  const selected = useMemo(
    () => posts.find((p) => p.id === selectedId) || filtered[0] || posts[0],
    [posts, selectedId, filtered],
  );

  const canEdit =
    selected && (isAdmin || selected.author_id === session?.user?.id);

  const startCreate = () => setMode("create");
  const startEdit = () => setMode("edit");
  const cancel = () => setMode("none");

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
              <div className="grid gap-5 md:grid-cols-2 items-center">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="published">Published</TabsTrigger>
                  <TabsTrigger value="draft">Drafts</TabsTrigger>
                </TabsList>
                <div className="flex md:justify-end">
                  <Button
                    onClick={session ? startCreate : openAuthModal}
                    className="h-10 w-10 rounded-full p-0"
                    aria-label="New Post"
                    title="New Post"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="sr-only">New Post</span>
                  </Button>
                </div>
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
                          active={selected?.id === p.id}
                          onSelect={() => {
                            setSelectedId(p.id);
                            setMode("none");
                          }}
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

        {/* Right — detail / form */}
        <aside className="md:sticky md:top-20 h-max rounded-xl border bg-card p-5 shadow-sm">
          {mode === "create" ? (
            <div>
              <div className="text-sm text-muted-foreground">Create post</div>
              <PostForm
                activeEvents={activeEvents}
                authorId={session!.user.id}
                familyId={activeFamilyId}
                enableVideoUpload={enableVideoUpload}
                onCancel={cancel}
                onSave={async (payload) => {
                  const created = await createUpdate(payload);
                  setPosts((prev) => [created, ...prev]);
                  setSelectedId(created.id);
                  setMode("none");
                }}
              />
            </div>
          ) : mode === "edit" && selected && canEdit ? (
            <div>
              <div className="text-sm text-muted-foreground">Edit post</div>
              <PostForm
                post={selected}
                activeEvents={activeEvents}
                authorId={session!.user.id}
                familyId={activeFamilyId}
                enableVideoUpload={enableVideoUpload}
                onCancel={cancel}
                onSave={async (payload) => {
                  const updated = await updateUpdate(selected.id, payload);
                  setPosts((prev) =>
                    prev.map((p) => (p.id === selected.id ? { ...p, ...updated } : p)),
                  );
                  setMode("none");
                }}
                onDelete={async () => {
                  await deleteUpdate(selected.id);
                  setPosts((prev) => prev.filter((p) => p.id !== selected.id));
                  setSelectedId(null);
                  setMode("none");
                }}
              />
            </div>
          ) : selected ? (
            <div>
              <div className="text-sm text-muted-foreground">Selected post</div>
              <div className="mt-1 text-lg font-semibold">{selected.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                By {selected.profiles?.full_name ?? "Family Member"} •{" "}
                {fmtDate(selected.created_at)} •{" "}
                <Badge variant="secondary">{tabOf(selected)}</Badge>
              </div>
              {selected.events && (
                <Badge variant="outline" className="mt-2 text-amber-700 border-amber-300 bg-amber-50 text-xs">
                  🎉 {selected.events.title}
                </Badge>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.hashtags.map((t) => (
                  <Badge key={t} variant="outline">#{t}</Badge>
                ))}
              </div>
              {selected.image_url && (
                <MediaPreview url={selected.image_url} className="mt-3 w-full rounded-lg object-cover max-h-40" />
              )}
              <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">
                {selected.content}
              </p>
              {canEdit && (
                <div className="mt-3">
                  <Button size="sm" onClick={startEdit}>
                    Modify Post
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Select a post to see details.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── PostCard — matches original style exactly ─────────────────────────────── */

function PostCard({
  post,
  active,
  onSelect,
}: {
  post: Update;
  active?: boolean;
  onSelect: () => void;
}) {
  const author = post.profiles?.full_name ?? "Family Member";
  const status = tabOf(post);
  return (
    <button
      onClick={onSelect}
      className={`text-left rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md ${active ? "ring-2 ring-primary/30" : ""}`}
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
        <Badge variant={status === "published" ? "secondary" : "outline"}>
          {status}
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

      <div className="mt-2 flex gap-2">
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Save
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
      {onDelete && (
        <Button
          variant="destructive"
          className="w-full mt-1"
          onClick={async () => {
            if (confirm("Delete this post?")) await onDelete();
          }}
        >
          Delete Post
        </Button>
      )}
    </div>
  );
}
