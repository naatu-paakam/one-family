import { useState } from "react";
import { Menu, X, Check, Plus, LogIn, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useFamily } from "@/contexts/FamilyContext";
import { createFamily, joinFamilyByCode } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export default function FamilyMenu() {
  const { families, activeFamilyId, setActiveFamilyId, reload } = useFamily();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [saving, setSaving] = useState(false);

  if (families.length === 0) return null;

  const activeFamily = families.find((f) => f.id === activeFamilyId);

  const handleCreate = async () => {
    if (!familyName.trim()) return;
    setSaving(true);
    try {
      const f = await createFamily(familyName.trim());
      await reload();
      setActiveFamilyId(f.id);
      setShowCreate(false);
      setFamilyName("");
      setOpen(false);
      toast({ title: `"${f.name}" created!`, description: "You're now viewing this family." });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setSaving(true);
    try {
      const f = await joinFamilyByCode(inviteCode.trim());
      await reload();
      setActiveFamilyId(f.id);
      setShowJoin(false);
      setInviteCode("");
      setOpen(false);
      toast({ title: `Joined "${f.name}"!`, description: "You're now viewing this family." });
    } catch (e: any) {
      toast({ title: "Invalid code", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Invite code copied!", description: code });
  };

  return (
    <>
      {/* Hamburger trigger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="relative"
        aria-label="Family menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Slide-in panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <div className="relative z-10 flex h-screen w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-4">
              <span className="font-semibold text-gray-900">My Families</span>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Family list */}
            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              {families.map((fam) => {
                const isActive = fam.id === activeFamilyId;
                return (
                  <div
                    key={fam.id}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 cursor-pointer ${isActive ? "bg-rose-50" : ""}`}
                    onClick={() => { setActiveFamilyId(fam.id); setOpen(false); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && (setActiveFamilyId(fam.id), setOpen(false))}
                  >
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                      {isActive ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                      ) : (
                        <span className="h-2.5 w-2.5 rounded-full border border-gray-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-medium ${isActive ? "text-rose-700" : "text-gray-800"}`}>
                        {fam.name}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">{fam.role}</p>
                    </div>
                    {fam.role === "admin" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); copyCode(fam.invite_code); }}
                        className="ml-1 shrink-0 rounded p-1 text-gray-400 hover:text-gray-600"
                        title="Copy invite code"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="border-t">
              <button
                onClick={() => { setShowCreate(true); setOpen(false); }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4 text-rose-500" />
                Create a new family
              </button>
              <button
                onClick={() => { setShowJoin(true); setOpen(false); }}
                className="flex w-full items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
              >
                <LogIn className="h-4 w-4 text-rose-500" />
                Join another family
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create family modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create a New Family</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="e.g. Sharma Family"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving || !familyName.trim()}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join family modal */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Join a Family</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Ask a family admin to share their invite code (tap the copy icon next to their family name).
            </p>
            <Input
              placeholder="e.g. naatu-001"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowJoin(false)}>Cancel</Button>
              <Button onClick={handleJoin} disabled={saving || !inviteCode.trim()}>
                {saving ? "Joining…" : "Join"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
