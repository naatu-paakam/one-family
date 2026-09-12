import { useMemo, useState, useEffect } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Member = {
  id: string;
  name: string;
  born?: string;
  avatar?: string;
  userId?: string;
  partner?: { name: string; born?: string };
  email?: string;
  phone?: string;
  address?: string;
  children?: Member[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAncestorIds(root: Member, targetId: string): Set<string> {
  const result = new Set<string>();
  const walk = (node: Member, path: string[]): boolean => {
    const next = [...path, node.id];
    if (node.id === targetId) { next.forEach(id => result.add(id)); return true; }
    for (const c of node.children ?? []) { if (walk(c, next)) return true; }
    return false;
  };
  walk(root, []);
  return result; // includes the target itself + all ancestors
}

function Avatar({ name, src, size = "md" }: { name: string; src?: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const cls = size === "sm" ? "size-7 text-[10px]" : "size-8 text-xs";
  if (src) return <img src={src} alt={name} className={cn("rounded-full object-cover shrink-0", cls)} />;
  return (
    <div className={cn("rounded-full bg-gradient-to-tr from-primary to-rose-400 text-white grid place-items-center font-bold shrink-0", cls)}>
      {initials}
    </div>
  );
}

function PersonCard({ name, born, avatar }: { name: string; born?: string; avatar?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar name={name} src={avatar} />
      <div>
        <div className="text-sm font-semibold leading-none">{name}</div>
        {born && <div className="text-[11px] text-muted-foreground leading-none mt-1">b. {born}</div>}
      </div>
    </div>
  );
}

// ── TreeNode ──────────────────────────────────────────────────────────────────

function TreeNode({
  node,
  depth = 0,
  selectedId,
  onSelect,
  currentUserId,
  ancestorPath,   // IDs to expand (path from root to focusNode + focusNode itself)
  focusNodeId,
  searchMatches,
  defaultExpanded,
}: {
  node: Member;
  depth?: number;
  selectedId?: string;
  onSelect?: (node: Member) => void;
  currentUserId?: string;
  ancestorPath?: Set<string>;
  focusNodeId?: string;
  searchMatches?: Set<string>;
  defaultExpanded?: boolean | null;
}) {
  const initExpanded = (() => {
    // Explicit expand/collapse-all overrides everything else
    if (defaultExpanded !== null && defaultExpanded !== undefined) return defaultExpanded;
    if (searchMatches) return searchMatches.has(node.id);
    return true; // default: fully expanded (collapse-by-depth deferred post-MVP)
  })();

  const [expanded, setExpanded] = useState(initExpanded);

  // When ancestorPath arrives after data loads, open any node on the path
  // without collapsing the rest of the tree (no full remount needed).
  useEffect(() => {
    if (ancestorPath?.has(node.id)) setExpanded(true);
  }, [ancestorPath, node.id]);
  const hasChildren = (node.children?.length ?? 0) > 0;
  const selected = selectedId === node.id;
  const isMe = !!currentUserId && node.userId === currentUserId;
  const isFocus = focusNodeId === node.id;

  // When searching, hide nodes not in matches
  if (searchMatches && !searchMatches.has(node.id)) {
    // Still render children (they might match)
    const visibleChildren = node.children?.filter(c => searchMatches.has(c.id)) ?? [];
    if (visibleChildren.length === 0) return null;
    return (
      <div className="relative">
        <div className="ml-8 pl-6 border-l-2 border-slate-300 dark:border-slate-600">
          <div className="absolute -left-[6px] top-3 size-3 rounded-full bg-slate-300" />
          <div className="grid gap-4">
            {node.children!.map(child => (
              <TreeNode key={child.id} node={child} depth={depth + 1}
                selectedId={selectedId} onSelect={onSelect} currentUserId={currentUserId}
                ancestorPath={ancestorPath} focusNodeId={focusNodeId}
                searchMatches={searchMatches} defaultExpanded={defaultExpanded} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "group inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-sm transition hover:shadow-md cursor-pointer",
          depth === 0 && "ring-1 ring-primary/10",
          selected && "border-primary/60 ring-2 ring-primary/20",
          isMe && "border-emerald-400/60 ring-1 ring-emerald-300/40",
          isFocus && !selected && "border-amber-400/60 ring-1 ring-amber-200/40",
        )}
        onClick={() => onSelect?.(node)}
        role="button"
        aria-label={node.name}
      >
        <div className="relative">
          <PersonCard name={node.name} born={node.born} avatar={node.avatar} />
          {isMe && (
            <span className="absolute -top-1 -right-1 text-[9px] bg-emerald-500 text-white rounded-full px-1 leading-4 font-bold select-none">me</span>
          )}
        </div>

        {node.partner && (
          <>
            <span className="text-rose-400 text-xs px-1 select-none">♥</span>
            <PersonCard name={node.partner.name} born={node.partner.born} />
          </>
        )}

        {hasChildren && (
          <button
            className="ml-2 rounded-full bg-muted p-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors shrink-0"
            title={expanded ? "Collapse" : `Expand ${node.children!.length} children`}
            onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="relative ml-8 pl-6 mt-4 border-l-2 border-slate-300 dark:border-slate-600">
          <div className="absolute -left-[6px] top-3 size-3 rounded-full bg-slate-300 dark:bg-slate-600" />
          <div className="grid gap-4">
            {node.children!.map(child => (
              <TreeNode key={child.id} node={child} depth={depth + 1}
                selectedId={selectedId} onSelect={onSelect} currentUserId={currentUserId}
                ancestorPath={ancestorPath} focusNodeId={focusNodeId}
                searchMatches={searchMatches} defaultExpanded={defaultExpanded} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── FamilyTree export ─────────────────────────────────────────────────────────

export default function FamilyTree({
  data,
  selectedId,
  onSelect,
  currentUserId,
  defaultExpanded = null,   // null = depth-0 only; true = all; false = none
  focusNodeId,              // auto-expand path to this node (+ its children)
  searchMatches,
}: {
  data?: Member;
  selectedId?: string;
  onSelect?: (node: Member) => void;
  currentUserId?: string;
  defaultExpanded?: boolean | null;
  focusNodeId?: string;
  searchMatches?: Set<string>;
}) {
  const sample = useMemo<Member>(
    () =>
      data ?? ({
        id: "root",
        name: "Grandparent", born: "1940s",
        partner: { name: "Grandmother", born: "1942" },
        children: [
          {
            id: "a1", name: "Parent", born: "1970s",
            partner: { name: "Spouse", born: "1972" },
            children: [
              { id: "a1a", name: "Child", born: "2000s" },
              { id: "a1b", name: "Child", born: "2000s" },
            ],
          },
          {
            id: "b1", name: "Parent", born: "1970s",
            partner: { name: "Spouse", born: "1973" },
            children: [{ id: "b1a", name: "Child", born: "2010s" }],
          },
          { id: "c1", name: "Sibling", born: "1975" },
        ],
      } as Member),
    [data],
  );

  // Compute ancestor path for focus-node auto-expansion
  const ancestorPath = useMemo(() => {
    if (!focusNodeId || !data) return undefined;
    return getAncestorIds(data, focusNodeId);
  }, [focusNodeId, data]);

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[560px]">
        <TreeNode node={sample} selectedId={selectedId} onSelect={onSelect}
          currentUserId={currentUserId} ancestorPath={ancestorPath}
          focusNodeId={focusNodeId} searchMatches={searchMatches}
          defaultExpanded={defaultExpanded} />
      </div>
    </div>
  );
}
