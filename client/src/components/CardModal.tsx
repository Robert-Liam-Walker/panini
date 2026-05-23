import { useEffect, useState, type KeyboardEvent } from "react";
import { api } from "../api/client";
import type { Card, Comment, Label } from "../api/types";

interface Props {
  cardId: number;
  boardLabels: Label[];
  onClose: () => void;
  onUpdated: (card: Card) => void;
}

export default function CardModal({ cardId, boardLabels, onClose, onUpdated }: Props) {
  const [card, setCard] = useState<Card | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MED" | "HIGH" | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Card>(`/cards/${cardId}`).then((c) => {
      setCard(c);
      setTitle(c.title);
      setDescription(c.description ?? "");
      setDueDate(c.dueDate ? c.dueDate.slice(0, 10) : "");
      setPriority(c.priority ?? null);
    });
  }, [cardId]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.patch<Card>(`/cards/${cardId}`, {
        title,
        description: description || null,
        dueDate: dueDate || null,
        priority,
      });
      onUpdated(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const setPriorityAndSave = async (next: "LOW" | "MED" | "HIGH" | null) => {
    setPriority(next);
    const updated = await api.patch<Card>(`/cards/${cardId}`, { priority: next });
    setCard((c) => (c ? { ...c, priority: updated.priority } : c));
    onUpdated(updated);
  };

  const toggleLabel = async (labelId: number) => {
    if (!card) return;
    const has = card.labels.some((cl) => cl.label.id === labelId);
    if (has) {
      await api.delete(`/cards/${cardId}/labels/${labelId}`);
      setCard({ ...card, labels: card.labels.filter((cl) => cl.label.id !== labelId) });
    } else {
      await api.post(`/cards/${cardId}/labels`, { labelId });
      const label = boardLabels.find((l) => l.id === labelId)!;
      setCard({ ...card, labels: [...card.labels, { label }] });
    }
  };

  const addComment = async () => {
    if (!commentBody.trim() || !card) return;
    const comment = await api.post<Comment>(`/cards/${cardId}/comments`, { body: commentBody.trim() });
    setCard({ ...card, comments: [...(card.comments ?? []), comment] });
    setCommentBody("");
  };

  const handleCommentKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment();
  };

  const deleteComment = async (id: number) => {
    if (!card) return;
    await api.delete(`/comments/${id}`);
    setCard({ ...card, comments: (card.comments ?? []).filter((c) => c.id !== id) });
  };

  const archiveCard = async () => {
    await api.patch(`/cards/${cardId}/archive`, {});
    onClose();
  };

  const deleteCard = async () => {
    if (!confirm("Delete this card? This can't be undone.")) return;
    await api.delete(`/cards/${cardId}`);
    onClose();
  };

  if (!card) {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const isOverdue = card.dueDate && card.dueDate.slice(0, 10) < todayStr && !card.archived;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Title */}
          <div className="flex items-start justify-between mb-4">
            <input
              className="flex-1 text-lg font-semibold text-gray-900 border-b border-transparent hover:border-gray-300 focus:border-blue-500 outline-none pb-1 pr-4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none ml-2">
              ×
            </button>
          </div>

          {/* Due date */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Due Date</label>
            <input
              type="date"
              className={`border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
                isOverdue ? "border-red-400 text-red-600" : "border-gray-300 text-gray-700"
              }`}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            {isOverdue && <span className="ml-2 text-xs text-red-500">Overdue</span>}
          </div>

          {/* Priority */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Priority</label>
            <div className="flex gap-1.5">
              {(["LOW", "MED", "HIGH"] as const).map((p) => {
                const active = priority === p;
                const color =
                  p === "LOW" ? "bg-gray-400" : p === "MED" ? "bg-yellow-500" : "bg-red-500";
                return (
                  <button
                    key={p}
                    onClick={() => setPriorityAndSave(active ? null : p)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium text-white transition ${color} ${
                      active ? "" : "opacity-40"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Labels */}
          {boardLabels.length > 0 && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Labels</label>
              <div className="flex flex-wrap gap-1.5">
                {boardLabels.map((label) => {
                  const active = card.labels.some((cl) => cl.label.id === label.id);
                  return (
                    <button
                      key={label.id}
                      onClick={() => toggleLabel(label.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
                        active ? "text-white" : "opacity-40"
                      }`}
                      style={{ backgroundColor: label.color }}
                    >
                      {label.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Description</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={4}
              placeholder="Add a description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Comments */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
              Comments ({(card.comments ?? []).length})
            </label>
            <div className="space-y-2 mb-2">
              {(card.comments ?? []).map((c) => (
                <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">{c.user.username}</span>
                    <button
                      onClick={() => deleteComment(c.id)}
                      className="text-xs text-gray-400 hover:text-red-500 transition"
                    >
                      delete
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={2}
              placeholder="Write a comment... (Cmd+Enter to submit)"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              onKeyDown={handleCommentKey}
            />
            <button
              onClick={addComment}
              disabled={!commentBody.trim()}
              className="mt-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition"
            >
              Add Comment
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <button
              onClick={save}
              disabled={saving}
              className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={archiveCard}
              className="text-sm text-gray-400 hover:text-red-500 transition"
            >
              Archive card
            </button>
            <button
              onClick={deleteCard}
              className="text-sm text-gray-400 hover:text-red-500 transition"
            >
              Delete card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
