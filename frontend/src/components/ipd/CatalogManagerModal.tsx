import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

interface CatalogItem {
  _id: string;
  name: string;
  isActive: boolean;
}

interface CatalogManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: CatalogItem[];
  onCreate: (name: string) => Promise<void>;
  onUpdate: (id: string, name: string, isActive: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function CatalogManagerModal({
  open, onOpenChange, title, items, onCreate, onUpdate, onDelete,
}: CatalogManagerModalProps) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding]   = useState(false);
  const [editId, setEditId]   = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busyId, setBusyId]   = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await onCreate(newName.trim());
      setNewName("");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item: CatalogItem) => {
    setEditId(item._id);
    setEditName(item.name);
  };

  const saveEdit = async (item: CatalogItem) => {
    if (!editName.trim()) return;
    setBusyId(item._id);
    try {
      await onUpdate(item._id, editName.trim(), item.isActive);
      setEditId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update");
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (item: CatalogItem) => {
    setBusyId(item._id);
    try {
      await onUpdate(item._id, item.name, !item.isActive);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: CatalogItem) => {
    setBusyId(item._id);
    try {
      await onDelete(item._id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage {title}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            placeholder={`New ${title.toLowerCase()} name`}
            className="h-9 text-sm"
          />
          <Button size="sm" className="h-9 shrink-0" disabled={adding || !newName.trim()} onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-gray-400">No entries yet</div>
          ) : items.map(item => (
            <div key={item._id} className="flex items-center gap-2 px-3 py-2 text-sm">
              {editId === item._id ? (
                <>
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveEdit(item); if (e.key === "Escape") setEditId(null); }}
                    className="h-8 text-sm flex-1"
                    autoFocus
                  />
                  <button type="button" className="text-green-600 hover:text-green-700" disabled={busyId === item._id} onClick={() => saveEdit(item)}>
                    <Check className="h-4 w-4" />
                  </button>
                  <button type="button" className="text-gray-400 hover:text-gray-600" onClick={() => setEditId(null)}>
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className={`flex-1 truncate ${item.isActive ? "text-gray-900" : "text-gray-400 line-through"}`}>{item.name}</span>
                  <button
                    type="button"
                    className={`text-xs px-1.5 py-0.5 rounded border ${item.isActive ? "border-green-300 text-green-700" : "border-gray-300 text-gray-500"}`}
                    disabled={busyId === item._id}
                    onClick={() => toggleActive(item)}
                  >
                    {item.isActive ? "Active" : "Inactive"}
                  </button>
                  <button type="button" className="text-indigo-400 hover:text-indigo-600" onClick={() => startEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="text-red-400 hover:text-red-600" disabled={busyId === item._id} onClick={() => handleDelete(item)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
