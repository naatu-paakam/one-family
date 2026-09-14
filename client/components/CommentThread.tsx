import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Loader2, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  fetchComments,
  createComment,
  deleteComment,
  toggleReaction,
  uploadImage,
  callEdgeFunction,
} from "@/lib/supabase";

/* ── Types ──────────────────────────────────────────────────────────────────── */

export type Reaction = { comment_id: string; user_id: string; emoji: string };

export type Comment = {
  id: string;
  event_id: string | null;
  story_id: string | null;
  author_id: string | null;
  content: string | null;
  image_url: string | null;
  parent_id: string | null;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  comment_reactions: Reaction[];
};

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

const EMOJIS = ["❤️", "😂", "😮", "👍", "🙌"];

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

/* ── CommentBubble ───────────────────────────────────────────────────────────── */

function CommentBubble({
  comment,
  session,
  onDelete,
  onReact,
  onReply,
  replyCount,
}: {
  comment: Comment;
  session: any;
  onDelete: () => void;
  onReact: (emoji: string, added: boolean) => void;
  onReply: (() => void) | null;
  replyCount: number;
}) {
  const [showEmojis, setShowEmojis] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isOwn = session?.user?.id === comment.author_id;

  const reactionGroups = EMOJIS.map((emoji) => {
    const count = comment.comment_reactions.filter((r) => r.emoji === emoji).length;
    const reacted = comment.comment_reactions.some(
      (r) => r.emoji === emoji && r.user_id === session?.user?.id,
    );
    return { emoji, count, reacted };
  }).filter((g) => g.count > 0);

  async function handleEmoji(emoji: string) {
    if (!session) return;
    setShowEmojis(false);
    try {
      const added = await toggleReaction(comment.id, session.user.id, emoji);
      onReact(emoji, added);
    } catch { /* silent */ }
  }

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-xs">
          {comment.profiles?.full_name ?? "Family Member"}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {format(new Date(comment.created_at), "MMM d, h:mm a")}
        </span>
      </div>

      {comment.image_url && (
        <MediaPreview url={comment.image_url} className="mt-2 max-h-40 w-full rounded-md object-cover" />
      )}
      {comment.content && (
        <p className="mt-1 text-sm whitespace-pre-wrap">{comment.content}</p>
      )}

      {/* Reactions bar */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {reactionGroups.map(({ emoji, count, reacted }) => (
          <button
            key={emoji}
            onClick={() => handleEmoji(emoji)}
            className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition ${
              reacted ? "border-primary bg-primary/10" : "border-muted hover:border-primary/40"
            }`}
          >
            {emoji} {count}
          </button>
        ))}

        {/* Add reaction */}
        <div className="relative">
          <button
            onClick={() => setShowEmojis((v) => !v)}
            className="rounded-full border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground hover:border-primary/40"
          >
            +
          </button>
          {showEmojis && (
            <div className="absolute bottom-6 left-0 z-10 flex gap-1 rounded-lg border bg-background p-1 shadow-md">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => handleEmoji(e)}
                  className="rounded px-1 py-0.5 hover:bg-muted text-base"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {onReply && (
          <button
            onClick={onReply}
            className="ml-1 text-[10px] text-muted-foreground hover:text-primary"
          >
            {replyCount > 0 ? `Reply (${replyCount})` : "Reply"}
          </button>
        )}

        {isOwn && !confirmDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="ml-auto text-[10px] text-muted-foreground hover:text-destructive"
          >
            Delete
          </button>
        )}
        {isOwn && confirmDelete && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px]">
            <span className="text-muted-foreground">Delete?</span>
            <button onClick={async () => { await deleteComment(comment.id); onDelete(); }}
              className="text-destructive font-medium hover:underline">Yes</button>
            <button onClick={() => setConfirmDelete(false)}
              className="text-muted-foreground hover:underline">Cancel</button>
          </span>
        )}
      </div>
    </div>
  );
}

/* ── CommentForm ─────────────────────────────────────────────────────────────── */

function CommentForm({
  parentId,
  parentType,
  familyId,
  session,
  replyParentId,
  enableVideoUpload,
  placeholder,
  onPosted,
  onCancel,
}: {
  parentId: string;
  parentType: "event" | "story";
  familyId: string | null;
  session: any;
  replyParentId: string | null;
  enableVideoUpload: boolean;
  placeholder: string;
  onPosted: (c: Comment) => void;
  onCancel: (() => void) | null;
}) {
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      setError(`File too large — max ${maxMB}MB for ${file.type.startsWith("video/") ? "videos" : "images"}.`);
      e.target.value = "";
      return;
    }
    setError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleGenerate() {
    if (!content.trim() && !imageFile) { setError("Add some text or a photo first"); return; }
    setGenerating(true);
    setError("");
    try {
      let uploadedUrl: string | null = null;
      if (imageFile && !imageFile.type.startsWith("video/")) {
        uploadedUrl = await uploadImage(imageFile, familyId);
        setImagePreview(uploadedUrl);
        setImageFile(null);
      }
      const { description } = await callEdgeFunction("generate-description", {
        title: parentType === "event" ? "Event comment" : "Story comment",
        content: content.trim() || null,
        imageUrl: uploadedUrl,
        eventId: parentType === "event" ? parentId : undefined,
        authorId: session.user.id,
        familyId,
      });
      setContent(description);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit() {
    if (!content.trim() && !imageFile && !imagePreview) { setError("Write something or attach a photo/video"); return; }
    setSaving(true);
    setError("");
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, familyId);
      } else if (imagePreview?.startsWith("http")) {
        imageUrl = imagePreview;
      }
      const payload = parentType === "event"
        ? { event_id: parentId, story_id: null as string | null }
        : { story_id: parentId, event_id: null as string | null };
      const comment = await createComment({
        ...payload,
        author_id: session.user.id,
        content: content.trim() || null,
        image_url: imageUrl,
        parent_id: replyParentId,
      });
      setContent("");
      setImageFile(null);
      setImagePreview("");
      onPosted(comment as Comment);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-2">
      {/* Media upload */}
      <label className="block border border-dashed rounded-lg px-3 py-2 text-center cursor-pointer hover:border-primary transition">
        {imagePreview ? (
          isVideoUrl(imagePreview) || imageFile?.type.startsWith("video/") ? (
            <video src={imagePreview} className="max-h-24 mx-auto rounded pointer-events-none" />
          ) : (
            <img src={imagePreview} alt="" className="max-h-24 mx-auto rounded object-contain" />
          )
        ) : (
          <span className="text-xs text-muted-foreground">{enableVideoUpload ? "📎 Attach photo or video (optional)" : "📎 Attach photo (optional)"}</span>
        )}
        <input type="file" accept={enableVideoUpload ? "image/*,video/*" : "image/*"} className="sr-only" onChange={handleFile} />
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

      <div className="flex items-start gap-2">
        <Textarea
          rows={2}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="text-sm resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
          }}
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSubmit} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          Post
        </Button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="ml-auto flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
        >
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          {generating ? "Generating…" : "✨ Generate with AI"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/* ── CommentThread ───────────────────────────────────────────────────────────── */

export default function CommentThread({
  parentId,
  parentType,
  familyId,
  session,
  enableVideoUpload,
  onCommentCountChange,
}: {
  parentId: string;
  parentType: "event" | "story";
  familyId: string | null;
  session: any;
  enableVideoUpload: boolean;
  onCommentCountChange?: (delta: number) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  useEffect(() => {
    setLoading(true);
    const fetchArgs = parentType === "event"
      ? { eventId: parentId }
      : { storyId: parentId };
    fetchComments(fetchArgs)
      .then((data) => setComments((data as Comment[]) ?? []))
      .finally(() => setLoading(false));
  }, [parentId, parentType]);

  function handlePosted(comment: Comment) {
    setComments((prev) => [...prev, comment]);
    setReplyTo(null);
    onCommentCountChange?.(1);
  }

  function handleDeleted(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id));
    onCommentCountChange?.(-1);
  }

  function handleReacted(commentId: string, emoji: string, added: boolean) {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        const reactions = added
          ? [...c.comment_reactions, { comment_id: commentId, user_id: session.user.id, emoji }]
          : c.comment_reactions.filter(
              (r) => !(r.user_id === session.user.id && r.emoji === emoji),
            );
        return { ...c, comment_reactions: reactions };
      }),
    );
  }

  const topLevel = comments.filter((c) => !c.parent_id);
  const replies = (pid: string) => comments.filter((c) => c.parent_id === pid);

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3">
        Comments {comments.length > 0 && <span className="text-muted-foreground font-normal">({comments.length})</span>}
      </h4>

      {session && familyId && !replyTo && (
        <div className="mb-4">
          <CommentForm
            parentId={parentId}
            parentType={parentType}
            familyId={familyId}
            session={session}
            replyParentId={null}
            enableVideoUpload={enableVideoUpload}
            placeholder="Add a comment…"
            onPosted={handlePosted}
            onCancel={null}
          />
        </div>
      )}
      {!session && (
        <p className="mb-3 text-xs text-muted-foreground italic">Sign in to comment.</p>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {topLevel.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No comments yet. Be the first!</p>
          )}
          {topLevel.map((c) => (
            <div key={c.id}>
              <CommentBubble
                comment={c}
                session={session}
                onDelete={() => handleDeleted(c.id)}
                onReact={(emoji, added) => handleReacted(c.id, emoji, added)}
                onReply={() => setReplyTo(replyTo?.id === c.id ? null : c)}
                replyCount={replies(c.id).length}
              />
              {replies(c.id).map((r) => (
                <div key={r.id} className="ml-6 mt-2">
                  <CommentBubble
                    comment={r}
                    session={session}
                    onDelete={() => handleDeleted(r.id)}
                    onReact={(emoji, added) => handleReacted(r.id, emoji, added)}
                    onReply={null}
                    replyCount={0}
                  />
                </div>
              ))}
              {replyTo?.id === c.id && session && familyId && (
                <div className="ml-6 mt-2">
                  <CommentForm
                    parentId={parentId}
                    parentType={parentType}
                    familyId={familyId}
                    session={session}
                    replyParentId={c.id}
                    enableVideoUpload={enableVideoUpload}
                    placeholder={`Reply to ${c.profiles?.full_name ?? "comment"}…`}
                    onPosted={handlePosted}
                    onCancel={() => setReplyTo(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
