/**
 * Family Tree page — ADR-012
 * Uses flat family_tree_nodes rows (not JSONB blob).
 * Supports 200-1000+ nodes via collapse-by-default + member search.
 */

import FamilyTree, { Member } from "@/components/FamilyTree";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFamily } from "@/contexts/FamilyContext";
import { useAuth } from "@/contexts/AuthContext";
import { UserCheck, Search, ChevronsDownUp, ChevronsUpDown, X, Trash2 } from "lucide-react";
import {
  fetchFamilyTreeNodes, upsertTreeNode, deleteTreeNode, updateTreeNodeParent,
  type FlatTreeNode,
} from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

// ── Flat ↔ Nested conversion ─────────────────────────────────────────────────

export function flatToMember(n: FlatTreeNode): Member {
  return {
    id: n.id,
    name: n.name,
    born: n.born ?? undefined,
    avatar: n.avatar ?? undefined,
    userId: n.user_id ?? undefined,
    partner: n.partner_name ? { name: n.partner_name, born: n.partner_born ?? undefined } : undefined,
    email: n.email ?? undefined,
    phone: n.phone ?? undefined,
    address: n.address ?? undefined,
  };
}

export function buildTree(nodes: FlatTreeNode[]): Member | null {
  if (!nodes.length) return null;
  const map = new Map(nodes.map(n => [n.id, { ...flatToMember(n), children: [] as Member[] }]));
  let root: Member | null = null;
  const extraRoots: Member[] = []; // additional roots due to data anomaly
  const orphans: Member[] = [];
  const sorted = [...nodes].sort((a, b) => a.sort_order - b.sort_order);
  for (const n of sorted) {
    if (!n.parent_id) {
      if (!root) root = map.get(n.id)!;
      else extraRoots.push(map.get(n.id)!); // subsequent roots attach under primary
    } else {
      const parent = map.get(n.parent_id);
      if (parent) parent.children!.push(map.get(n.id)!);
      else orphans.push(map.get(n.id)!); // parent was deleted — collect for rescue
    }
  }
  // Attach extra roots and orphans directly under primary root so nothing is hidden
  if (root) root.children!.push(...extraRoots, ...orphans);
  return root;
}

// ── Search helpers ───────────────────────────────────────────────────────────

function searchMatchIds(root: Member, q: string): Set<string> {
  const matches = new Set<string>();
  const lq = q.toLowerCase();
  const walk = (node: Member, ancestors: string[]) => {
    const hit = node.name.toLowerCase().includes(lq)
      || (node.partner?.name ?? "").toLowerCase().includes(lq);
    const path = [...ancestors, node.id];
    if (hit) path.forEach(id => matches.add(id));
    for (const c of node.children ?? []) walk(c, path);
  };
  walk(root, []);
  return matches;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FamilyTreePage() {
  const { activeFamilyId, activeFamily, families, loading: familiesLoading } = useFamily();
  const { session, profile, openAuthModal, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [nodes, setNodes]       = useState<FlatTreeNode[]>([]);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  // treeKey forces FamilyTree remount on expand/collapse all
  const [treeKey, setTreeKey]   = useState(0);
  const [allExpanded, setAllExpanded] = useState<boolean | null>(null); // null = fully expanded by default
  const [deleteConfirmName, setDeleteConfirmName] = useState<string | null>(null);

  // ── Load flat nodes ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!activeFamilyId) { setNodes([]); return; }
    setLoading(true);
    try {
      const data = await fetchFamilyTreeNodes(activeFamilyId);
      setNodes(data);
      if (data.length > 0 && !selectedId) {
        const root = data.find(n => !n.parent_id);
        if (root) setSelectedId(root.id);
      }
    } catch (e: any) {
      toast({ title: "Failed to load tree", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [activeFamilyId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived tree ───────────────────────────────────────────────────────────

  const tree = useMemo(() => buildTree(nodes), [nodes]);

  const searchMatches = useMemo(() => {
    if (!search.trim() || !tree) return null;
    return searchMatchIds(tree, search.trim());
  }, [search, tree]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return nodes.find(n => n.id === selectedId) ?? null;
  }, [selectedId, nodes]);

  // ── Sidebar form state ─────────────────────────────────────────────────────

  const [name, setName]               = useState("");
  const [born, setBorn]               = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerBorn, setPartnerBorn] = useState("");
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("");
  const [address, setAddress]         = useState("");

  useEffect(() => {
    setName(selected?.name ?? "");
    setBorn(selected?.born ?? "");
    setPartnerName(selected?.partner_name ?? "");
    setPartnerBorn(selected?.partner_born ?? "");
    setEmail(selected?.email ?? "");
    setPhone(selected?.phone ?? "");
    setAddress(selected?.address ?? "");
  }, [selectedId, selected]);

  // ── Save / Add ─────────────────────────────────────────────────────────────

  const saveDetails = async () => {
    if (!selected || !activeFamilyId) return;
    setSaving(true);
    try {
      const updated = await upsertTreeNode({
        id: selected.id,
        family_id: activeFamilyId,
        parent_id: selected.parent_id,
        name: name.trim() || "Member",
        born: born.trim() || null,
        partner_name: partnerName.trim() || null,
        partner_born: partnerBorn.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        avatar: selected.avatar,
        user_id: selected.user_id,
        sort_order: selected.sort_order,
      });
      setNodes(prev => prev.map(n => n.id === updated.id ? updated : n));
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const addChild = async () => {
    if (!selectedId || !activeFamilyId) return;
    setSaving(true);
    try {
      const siblings = nodes.filter(n => n.parent_id === selectedId);
      const newNode = await upsertTreeNode({
        id: crypto.randomUUID(),
        family_id: activeFamilyId,
        parent_id: selectedId,
        name: "New Member",
        sort_order: siblings.length,
      });
      setNodes(prev => [...prev, newNode]);
      setSelectedId(newNode.id);
      setTreeKey(k => k + 1); // remount so new child is visible in expanded parent
    } catch (e: any) {
      toast({ title: "Failed to add child", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const addParent = async () => {
    if (!selected || !activeFamilyId) return;
    if (selected.parent_id !== null) return; // only for root nodes
    setSaving(true);
    try {
      // Step 1: create new node as the new root (parent_id = null)
      const newRoot = await upsertTreeNode({
        id: crypto.randomUUID(),
        family_id: activeFamilyId,
        parent_id: null,
        name: "New Parent",
        sort_order: 0,
      });
      // Step 2: make the current root a child of the new root
      await updateTreeNodeParent(selected.id, newRoot.id, 0);
      // Step 3: update local state
      setNodes(prev => [
        ...prev.filter(n => n.id !== selected.id),
        { ...prev.find(n => n.id === selected.id)!, parent_id: newRoot.id },
        newRoot,
      ]);
      setSelectedId(newRoot.id);
      setTreeKey(k => k + 1); // remount so new root is rendered at top
      toast({ title: "Parent added", description: "New parent node added above the root." });
    } catch (e: any) {
      toast({ title: "Failed to add parent", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const addSibling = async () => {
    if (!selected || !activeFamilyId) return;
    const parentId = selected.parent_id;
    if (!parentId) return;
    setSaving(true);
    try {
      const siblings = nodes.filter(n => n.parent_id === parentId);
      const newNode = await upsertTreeNode({
        id: crypto.randomUUID(),
        family_id: activeFamilyId,
        parent_id: parentId,
        name: "New Sibling",
        sort_order: siblings.length,
      });
      setNodes(prev => [...prev, newNode]);
      setSelectedId(newNode.id);
      setTreeKey(k => k + 1);
    } catch (e: any) {
      toast({ title: "Failed to add sibling", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const startTree = async () => {
    if (!activeFamilyId) return;
    setSaving(true);
    try {
      const root = await upsertTreeNode({
        id: crypto.randomUUID(),
        family_id: activeFamilyId,
        parent_id: null,
        name: `${activeFamily?.name ?? "Family"} Root`,
        sort_order: 0,
      });
      setNodes([root]);
      setSelectedId(root.id);
    } catch (e: any) {
      toast({ title: "Failed to create tree", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ── "This is me" ───────────────────────────────────────────────────────────

  const isSelectedMe        = !!selected && !!session && selected.user_id === session.user.id;
  const isPartnerMe         = !!selected && !!session && selected.partner_user_id === session.user.id;

  const toggleFlagAsMe = async () => {
    if (!selected || !session || !activeFamilyId) return;
    setSaving(true);
    try {
      let patch: Partial<FlatTreeNode>;
      if (isSelectedMe) {
        patch = { user_id: null, avatar: null };
      } else {
        const avatar = profile?.avatar_url
          ?? session.user.user_metadata?.avatar_url
          ?? session.user.user_metadata?.picture ?? null;
        const fullName = profile?.full_name
          ?? session.user.user_metadata?.full_name
          ?? session.user.user_metadata?.name ?? name;
        patch = { user_id: session.user.id, avatar, name: fullName, email: session.user.email ?? null };
        setName(fullName);
        setEmail(session.user.email ?? email);
      }
      const updated = await upsertTreeNode({ ...selected, ...patch });
      setNodes(prev => prev.map(n => n.id === updated.id ? updated : n));
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const toggleFlagPartnerAsMe = async () => {
    if (!selected || !session || !activeFamilyId) return;
    setSaving(true);
    try {
      const patch: Partial<FlatTreeNode> = isPartnerMe
        ? { partner_user_id: null }
        : { partner_user_id: session.user.id };
      const updated = await upsertTreeNode({ ...selected, ...patch });
      setNodes(prev => prev.map(n => n.id === updated.id ? updated : n));
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ── Focus node: the node flagged as "me" ─────────────────────────────────
  // Auto-expands the path from root → me → children (ADR-012)
  const meNodeId = useMemo(() => {
    if (!session) return undefined;
    return nodes.find(n => n.user_id === session.user.id)?.id;
  }, [nodes, session]);


  // ── Cancel edit ───────────────────────────────────────────────────────────

  const cancelEdit = () => {
    setName(selected?.name ?? "");
    setBorn(selected?.born ?? "");
    setPartnerName(selected?.partner_name ?? "");
    setPartnerBorn(selected?.partner_born ?? "");
    setEmail(selected?.email ?? "");
    setPhone(selected?.phone ?? "");
    setAddress(selected?.address ?? "");
  };

  // ── Delete node ───────────────────────────────────────────────────────────

  const deleteNode = () => {
    if (!selected || !activeFamilyId) return;
    setDeleteConfirmName(selected.name);
  };

  const confirmDelete = async () => {
    if (!selected || !activeFamilyId) return;
    setDeleteConfirmName(null);
    setSaving(true);
    try {
      await deleteTreeNode(selected.id);
      // Remove the node and all its descendants from local state
      // (DB cascade-deletes them; local state must match to avoid orphan display)
      const toRemove = new Set<string>();
      const collect = (id: string) => {
        toRemove.add(id);
        nodes.filter(n => n.parent_id === id).forEach(c => collect(c.id));
      };
      collect(selected.id);
      const remaining = nodes.filter(n => !toRemove.has(n.id));
      setNodes(remaining);
      const newRoot = remaining.find(n => !n.parent_id);
      setSelectedId(newRoot?.id ?? null);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ── Expand / Collapse all ──────────────────────────────────────────────────

  const expandAll  = () => { setAllExpanded(true);  setTreeKey(k => k + 1); };
  const collapseAll = () => { setAllExpanded(false); setTreeKey(k => k + 1); };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isPreview = !session || !activeFamilyId;

  // No-family guard (ADR-006)
  if (session && !familiesLoading && families.length === 0) {
    return <Navigate to="/" replace />;
  }

  if (authLoading) {
    return <div className="container py-16 text-center text-muted-foreground">Loading…</div>;
  }

  if (loading && !isPreview) {
    return <div className="container py-16 text-center text-muted-foreground">Loading family tree…</div>;
  }

  if (!tree && !isPreview) {
    return (
      <div className="container py-16 flex flex-col items-center gap-4 text-center">
        <p className="text-lg font-semibold">
          No family tree yet for <span className="text-rose-600">{activeFamily?.name}</span>
        </p>
        <p className="text-muted-foreground text-sm max-w-sm">
          Start by adding the first member — you can build the full tree from there.
        </p>
        <Button onClick={startTree} disabled={saving}>{saving ? "Creating…" : "Start Family Tree"}</Button>
      </div>
    );
  }

  function requireAuth(action: () => void) {
    if (isPreview) openAuthModal({ defaultTab: 'signup', redirectTo: '/family-tree' });
    else action();
  }

  const canAddSibling = !isPreview && !!selected?.parent_id;
  // Add Parent only on root nodes (no parent) — grows the tree upward
  const canAddParent  = !isPreview && selected?.parent_id === null;

  // Member to display in sidebar (uses Member type for partner display)
  const selectedMember = tree ? (() => {
    const walk = (n: Member): Member | null => {
      if (n.id === selectedId) return n;
      for (const c of n.children ?? []) { const r = walk(c); if (r) return r; }
      return null;
    };
    return walk(tree);
  })() : null;

  return (
    <div className="container py-8">
      <div className="flex flex-col gap-8 md:grid md:grid-cols-[1fr_360px]">
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Family Tree</h1>
                {saving && <span className="text-xs text-muted-foreground animate-pulse">Saving…</span>}
              </div>
              <p className="mt-1 text-muted-foreground">
                Build and explore your family tree together. Add members, connect generations, and watch your family grow across branches.
              </p>
              {activeFamily && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {activeFamily.name} · {nodes.length} member{nodes.length !== 1 ? "s" : ""} · Click a person to edit.
                </p>
              )}
            </div>
            {/* Expand / Collapse all — only for real (non-preview) trees */}
            {!isPreview && tree && (
              <div className="flex gap-1 shrink-0 mt-1">
                <button onClick={expandAll}
                  title="Expand all branches"
                  className="rounded-lg border p-1.5 text-muted-foreground hover:bg-slate-50 hover:text-foreground transition-colors">
                  <ChevronsUpDown className="h-4 w-4" />
                </button>
                <button onClick={collapseAll}
                  title="Collapse all branches"
                  className="rounded-lg border p-1.5 text-muted-foreground hover:bg-slate-50 hover:text-foreground transition-colors">
                  <ChevronsDownUp className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Search — only for real trees with > 5 nodes */}
          {!isPreview && nodes.length > 5 && (
            <div className="mt-4 relative max-w-sm">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </span>
              <Input
                className="pl-9 pr-8"
                placeholder="Search members by name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <span className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <button onClick={() => setSearch("")}
                    className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </span>
              )}
              {search && searchMatches && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {searchMatches.size === 0 ? "No matches" : `${searchMatches.size} match${searchMatches.size !== 1 ? "es" : ""}`}
                </p>
              )}
            </div>
          )}

          {/* Tree */}
          <div className="mt-6 rounded-xl border bg-card p-4">
            <FamilyTree
              key={treeKey}
              data={isPreview ? undefined : tree ?? undefined}
              selectedId={selectedId ?? undefined}
              onSelect={(n) => setSelectedId(n.id)}
              currentUserId={session?.user.id}
              defaultExpanded={allExpanded}
              focusNodeId={meNodeId}
              searchMatches={searchMatches ?? undefined}
            />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="md:sticky md:top-20 h-max rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Selected member</div>
            {!isPreview && selectedMember && (
              <button onClick={toggleFlagAsMe}
                title={isSelectedMe ? "Unlink my profile" : "This is me — link my profile"}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
                  isSelectedMe
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                }`}>
                <UserCheck className="h-3.5 w-3.5" />
                {isSelectedMe ? "That's me" : "This is me"}
              </button>
            )}
          </div>
          <div className="mt-1 text-lg font-semibold">
            {isPreview ? "Grandparent"
              : selectedMember?.partner
              ? `${selectedMember.name} ♥ ${selectedMember.partner.name}`
              : selectedMember?.name ?? "—"}
          </div>

          <div className="mt-4 grid gap-3">
            <input className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              placeholder="Name"
              value={isPreview ? "Grandparent" : name}
              onChange={e => !isPreview && setName(e.target.value)} readOnly={isPreview} />
            <input className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              placeholder="Born (YYYY or Date of Birth)"
              value={isPreview ? "1940s" : born}
              onChange={e => !isPreview && setBorn(e.target.value)} readOnly={isPreview} />

            <div className="border-t pt-3 grid gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <span className="text-rose-400">♥</span> Partner / Spouse
                </span>
                {!isPreview && selectedMember && (
                  <button onClick={toggleFlagPartnerAsMe}
                    title={isPartnerMe ? "Unlink my profile from partner" : "This is me — link as partner"}
                    className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors ${
                      isPartnerMe
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                    }`}>
                    <UserCheck className="h-3.5 w-3.5" />
                    {isPartnerMe ? "That's me" : "This is me"}
                  </button>
                )}
              </div>
              <input className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                placeholder="Partner name (optional)"
                value={isPreview ? "Grandmother" : partnerName}
                onChange={e => !isPreview && setPartnerName(e.target.value)} readOnly={isPreview} />
              <input className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                placeholder="Born (YYYY or Date of Birth)"
                value={isPreview ? "1942" : partnerBorn}
                onChange={e => !isPreview && setPartnerBorn(e.target.value)} readOnly={isPreview} />
              {!isPreview && <p className="text-[11px] text-muted-foreground">Leave blank to remove partner.</p>}
            </div>

            {!isPreview && (
              <div className="border-t pt-3 grid gap-1.5">
                <input className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Email (private)" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                <input className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Phone (private)" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                <textarea className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  placeholder="Address (private)" rows={2} value={address} onChange={e => setAddress(e.target.value)} />
              </div>
            )}

            {/* Record-level actions — Save left, Cancel + Delete icons right */}
            <div className="flex items-center gap-2">
              <Button disabled={saving} onClick={() => requireAuth(saveDetails)}>
                {saving ? "Saving…" : "Save"}
              </Button>
              {!isPreview && (
                <div className="ml-auto flex gap-1">
                  <button onClick={cancelEdit} title="Cancel changes"
                    className="rounded-md border p-2 text-muted-foreground hover:text-foreground hover:bg-slate-50 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                  <button onClick={() => requireAuth(deleteNode)} title="Delete member"
                    disabled={saving}
                    className="rounded-md border p-2 text-muted-foreground hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Inline delete confirmation — replaces browser confirm() */}
            {deleteConfirmName && (
              <div className="border-t pt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm">
                <p className="text-red-800 font-medium mb-2">
                  Delete "{deleteConfirmName}"? This will also remove all their descendants.
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={confirmDelete} disabled={saving}>
                    Delete
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDeleteConfirmName(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Tree-mutation actions — below Save row */}
            {!isPreview && !deleteConfirmName && (
              <div className="border-t pt-3 flex flex-wrap gap-2">
                {canAddParent && (
                  <Button variant="outline" size="sm" disabled={saving} onClick={() => requireAuth(addParent)}>
                    Add Parent
                  </Button>
                )}
                <Button variant="outline" size="sm" disabled={saving} onClick={() => requireAuth(addChild)}>
                  Add Child
                </Button>
                <Button variant="outline" size="sm" disabled={(!isPreview && !canAddSibling) || saving}
                  onClick={() => requireAuth(addSibling)}>
                  Add Sibling
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
