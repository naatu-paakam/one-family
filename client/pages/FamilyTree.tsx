import FamilyTree, { Member } from "@/components/FamilyTree";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFamily } from "@/contexts/FamilyContext";
import { fetchFamilyTree, saveFamilyTree } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function updateNode(root: Member, id: string, mutator: (node: Member) => void): Member {
  if (root.id === id) {
    const next = { ...root, children: root.children ? [...root.children] : undefined } as Member;
    mutator(next);
    return next;
  }
  if (!root.children) return root;
  let changed = false;
  const nextChildren = root.children.map((c) => {
    const updated = updateNode(c, id, mutator);
    if (updated !== c) changed = true;
    return updated;
  });
  if (!changed) return root;
  return { ...root, children: nextChildren };
}

function insertSibling(root: Member, id: string, create: () => Member): Member {
  if (!root.children) return root;
  const idx = root.children.findIndex((c) => c.id === id);
  if (idx !== -1) {
    const next = [...root.children];
    next.splice(idx + 1, 0, create());
    return { ...root, children: next };
  }
  let changed = false;
  const nextChildren = root.children.map((c) => {
    const updated = insertSibling(c, id, create);
    if (updated !== c) changed = true;
    return updated;
  });
  if (!changed) return root;
  return { ...root, children: nextChildren };
}

function insertChild(root: Member, id: string, create: () => Member): Member {
  return updateNode(root, id, (n) => {
    const children = n.children ? [...n.children] : [];
    children.push(create());
    n.children = children;
  });
}

function findParentId(root: Member, id: string, parentId: string | null = null): string | null {
  if (root.id === id) return parentId;
  for (const c of root.children ?? []) {
    const res = findParentId(c, id, root.id);
    if (res) return res;
  }
  return null;
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

const EMPTY_ROOT: Member = { id: "root", name: "Root Member", born: undefined };

export default function FamilyTreePage() {
  const { activeFamilyId, activeFamily } = useFamily();
  const { toast } = useToast();

  const [tree, setTree] = useState<Member | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("root");

  // Load tree whenever active family changes
  useEffect(() => {
    if (!activeFamilyId) { setTree(null); return; }
    setLoading(true);
    setTree(null);
    fetchFamilyTree(activeFamilyId)
      .then((data) => {
        setTree(data as Member | null);
        setSelectedId(data ? (data as Member).id : "root");
      })
      .catch((e) => toast({ title: "Failed to load tree", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [activeFamilyId]);

  // Auto-save with debounce whenever tree changes
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeFamilyId || !tree) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try { await saveFamilyTree(activeFamilyId, tree); }
      catch (e: any) { toast({ title: "Save failed", description: e.message, variant: "destructive" }); }
      finally { setSaving(false); }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [tree, activeFamilyId]);

  const selected = useMemo(() => {
    if (!tree) return null;
    let found: Member | null = null;
    const walk = (n: Member) => {
      if (n.id === selectedId) { found = n; return; }
      for (const c of n.children ?? []) if (!found) walk(c);
    };
    walk(tree);
    return found ?? tree;
  }, [selectedId, tree]);

  const [name, setName] = useState("");
  const [born, setBorn] = useState("");
  useEffect(() => {
    setName(selected?.name ?? "");
    setBorn(selected?.born ?? "");
  }, [selectedId, selected]);

  const canAddSibling = tree ? findParentId(tree, selectedId) !== null : false;

  const saveDetails = () => {
    if (!tree) return;
    setTree((prev) => updateNode(prev!, selectedId, (n) => {
      n.name = name;
      n.born = born || undefined;
    }));
  };

  const addChild = () => {
    if (!tree) return;
    const id = newId();
    setTree((prev) => insertChild(prev!, selectedId, () => ({ id, name: "New Member", born: undefined })));
    setSelectedId(id);
  };

  const addSibling = () => {
    if (!tree) return;
    const parentId = findParentId(tree, selectedId);
    if (!parentId) return;
    const id = newId();
    setTree((prev) => insertSibling(prev!, selectedId, () => ({ id, name: "New Sibling", born: undefined })));
    setSelectedId(id);
  };

  const startTree = () => {
    const root: Member = { id: newId(), name: `${activeFamily?.name ?? "Family"} Root`, born: undefined };
    setTree(root);
    setSelectedId(root.id);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!activeFamilyId) {
    return (
      <div className="container py-16 text-center text-muted-foreground">
        Select a family from the menu to view its tree.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container py-16 text-center text-muted-foreground">
        Loading family tree…
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="container py-16 flex flex-col items-center gap-4 text-center">
        <p className="text-lg font-semibold">No family tree yet for <span className="text-rose-600">{activeFamily?.name}</span></p>
        <p className="text-muted-foreground text-sm max-w-sm">
          Start building your family tree by adding the first member.
        </p>
        <Button onClick={startTree}>Start Family Tree</Button>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex flex-col gap-8 md:grid md:grid-cols-[1fr_360px]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Family Tree</h1>
            {saving && <span className="text-xs text-muted-foreground animate-pulse">Saving…</span>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeFamily?.name} · Click a person to edit details.
          </p>
          <div className="mt-6 rounded-xl border bg-card p-4">
            <FamilyTree
              data={tree}
              selectedId={selectedId}
              onSelect={(n) => setSelectedId(n.id)}
            />
          </div>
        </div>

        <aside className="md:sticky md:top-20 h-max rounded-xl border bg-card p-5 shadow-sm">
          <div className="text-sm text-muted-foreground">Selected member</div>
          <div className="mt-1 text-lg font-semibold">{selected?.name}</div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Name</span>
              <input
                className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">Born (YYYY or range)</span>
              <input
                className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={born}
                onChange={(e) => setBorn(e.target.value)}
              />
            </label>
            <div className="flex gap-2 pt-2">
              <Button onClick={saveDetails}>Save</Button>
              <Button variant="outline" onClick={addChild}>Add Child</Button>
              <Button variant="outline" disabled={!canAddSibling} onClick={addSibling}>Add Sibling</Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
