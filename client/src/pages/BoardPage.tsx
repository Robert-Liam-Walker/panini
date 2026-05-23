import { useEffect, useState, type KeyboardEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "../api/client";
import type { Board, Card, Column, User } from "../api/types";
import CardModal from "../components/CardModal";

// ---------- Draggable Card ----------
function SortableCard({
  card,
  onClick,
}: {
  card: Card;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${card.id}`,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const todayStr = new Date().toISOString().slice(0, 10);
  const isOverdue = card.dueDate && card.dueDate.slice(0, 10) < todayStr;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-white rounded-lg px-3 py-2.5 shadow-sm border border-gray-200 cursor-pointer hover:border-blue-400 transition select-none ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {card.labels.map((cl) => (
            <span
              key={cl.label.id}
              className="px-1.5 py-0.5 rounded-full text-xs text-white font-medium"
              style={{ backgroundColor: cl.label.color }}
            >
              {cl.label.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm text-gray-800 font-medium leading-snug">{card.title}</p>
        {card.priority && (
          <span
            className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white leading-none mt-0.5 ${
              card.priority === "LOW"
                ? "bg-gray-400"
                : card.priority === "MED"
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
          >
            {card.priority}
          </span>
        )}
      </div>
      {card.dueDate && (
        <p className={`text-xs mt-1 ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
          {isOverdue ? "⚠ " : ""}
          {new Date(card.dueDate).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

// ---------- Draggable Column ----------
function SortableColumn({
  column,
  onCardClick,
  onAddCard,
  onRenameColumn,
  onDeleteColumn,
  activeCardId,
}: {
  column: Column;
  onCardClick: (id: number) => void;
  onAddCard: (columnId: number, title: string) => void;
  onRenameColumn: (id: number, title: string) => void;
  onDeleteColumn: (id: number) => void;
  activeCardId: number | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `col-${column.id}`,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const [editing, setEditing] = useState(false);
  const [colTitle, setColTitle] = useState(column.title);
  const [addingCard, setAddingCard] = useState(false);
  const [cardTitle, setCardTitle] = useState("");

  const submitRename = () => {
    if (colTitle.trim() && colTitle !== column.title) {
      onRenameColumn(column.id, colTitle.trim());
    }
    setEditing(false);
  };

  const submitAdd = () => {
    if (cardTitle.trim()) {
      onAddCard(column.id, cardTitle.trim());
      setCardTitle("");
    }
    setAddingCard(false);
  };

  const handleAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") submitAdd();
    if (e.key === "Escape") { setAddingCard(false); setCardTitle(""); }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-64 flex-shrink-0 flex flex-col ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="bg-gray-100 rounded-xl flex flex-col max-h-[calc(100vh-160px)]">
        {/* Column header */}
        <div
          className="flex items-center justify-between px-3 py-2 cursor-grab"
          {...attributes}
          {...listeners}
        >
          {editing ? (
            <input
              autoFocus
              className="flex-1 text-sm font-semibold bg-white border border-blue-400 rounded px-2 py-0.5 outline-none"
              value={colTitle}
              onChange={(e) => setColTitle(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => e.key === "Enter" && submitRename()}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="text-sm font-semibold text-gray-700 truncate"
              onDoubleClick={() => setEditing(true)}
            >
              {column.title}
            </span>
          )}
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-gray-400 bg-gray-200 rounded px-1.5">
              {column.cards.length}
            </span>
            <button
              onClick={() => onDeleteColumn(column.id)}
              className="text-gray-400 hover:text-red-500 text-sm leading-none transition px-1"
              title="Delete column"
            >
              ×
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
          <SortableContext
            items={column.cards.map((c) => `card-${c.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {column.cards.map((card) =>
              activeCardId === card.id ? (
                <div key={card.id} className="h-12 rounded-lg bg-blue-100 border border-blue-300 border-dashed" />
              ) : (
                <SortableCard
                  key={card.id}
                  card={card}
                  onClick={() => onCardClick(card.id)}
                />
              )
            )}
          </SortableContext>
        </div>

        {/* Add card */}
        <div className="px-2 pb-2">
          {addingCard ? (
            <div>
              <input
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                placeholder="Card title"
                value={cardTitle}
                onChange={(e) => setCardTitle(e.target.value)}
                onKeyDown={handleAddKey}
              />
              <div className="flex gap-1">
                <button
                  onClick={submitAdd}
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition"
                >
                  Add
                </button>
                <button
                  onClick={() => { setAddingCard(false); setCardTitle(""); }}
                  className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingCard(true)}
              className="w-full text-left text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-200 px-2 py-1.5 rounded-lg transition"
            >
              + Add card
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Board Page ----------
export default function BoardPage({ user }: { user: User }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Board | null>(null);
  const [openCardId, setOpenCardId] = useState<number | null>(null);
  const [activeCardId, setActiveCardId] = useState<number | null>(null);
  const [, setActiveColId] = useState<number | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (!id) return;
    api.get<Board>(`/boards/${id}`).then(setBoard);
  }, [id]);

  // Keyboard shortcut: N to add card (focused column not tracked — opens first column)
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpenCardId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!board) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading board...</p>
      </div>
    );
  }

  // --- Handlers ---
  const addColumn = async () => {
    if (!newColTitle.trim()) return;
    const col = await api.post<Column>(`/boards/${board.id}/columns`, { title: newColTitle.trim() });
    setBoard({ ...board, columns: [...board.columns, { ...col, cards: [] }] });
    setNewColTitle("");
    setAddingCol(false);
  };

  const renameColumn = async (colId: number, title: string) => {
    await api.patch(`/columns/${colId}`, { title });
    setBoard({ ...board, columns: board.columns.map((c) => (c.id === colId ? { ...c, title } : c)) });
  };

  const deleteColumn = async (colId: number) => {
    if (!confirm("Delete this column and all its cards?")) return;
    await api.delete(`/columns/${colId}`);
    setBoard({ ...board, columns: board.columns.filter((c) => c.id !== colId) });
  };

  const addCard = async (colId: number, title: string) => {
    const card = await api.post<Card>(`/columns/${colId}/cards`, { title });
    setBoard({
      ...board,
      columns: board.columns.map((c) =>
        c.id === colId ? { ...c, cards: [...c.cards, { ...card, labels: [] }] } : c
      ),
    });
  };

  const updateCard = (updated: Card) => {
    setBoard({
      ...board,
      columns: board.columns.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
      })),
    });
  };

  // Remove archived card from view
  const handleModalClose = () => {
    setOpenCardId(null);
    // Re-fetch board to pick up any archive/move changes
    api.get<Board>(`/boards/${board.id}`).then(setBoard);
  };

  // --- DnD ---
  const onDragStart = (e: DragStartEvent) => {
    const idStr = String(e.active.id);
    if (idStr.startsWith("card-")) setActiveCardId(parseInt(idStr.replace("card-", "")));
    if (idStr.startsWith("col-")) setActiveColId(parseInt(idStr.replace("col-", "")));
  };

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || !board) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith("card-")) return;

    const cardId = parseInt(activeId.replace("card-", ""));
    let targetColId: number | null = null;

    if (overId.startsWith("col-")) {
      targetColId = parseInt(overId.replace("col-", ""));
    } else if (overId.startsWith("card-")) {
      const overCardId = parseInt(overId.replace("card-", ""));
      for (const col of board.columns) {
        if (col.cards.some((c) => c.id === overCardId)) {
          targetColId = col.id;
          break;
        }
      }
    }

    if (!targetColId) return;
    const sourceCol = board.columns.find((col) => col.cards.some((c) => c.id === cardId));
    if (!sourceCol || sourceCol.id === targetColId) return;

    // Move card between columns visually
    const movingCard = sourceCol.cards.find((c) => c.id === cardId)!;
    setBoard({
      ...board,
      columns: board.columns.map((col) => {
        if (col.id === sourceCol.id) return { ...col, cards: col.cards.filter((c) => c.id !== cardId) };
        if (col.id === targetColId) return { ...col, cards: [...col.cards, movingCard] };
        return col;
      }),
    });
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveCardId(null);
    setActiveColId(null);
    if (!over || !board) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Column reorder
    if (activeId.startsWith("col-") && overId.startsWith("col-")) {
      const fromIdx = board.columns.findIndex((c) => `col-${c.id}` === activeId);
      const toIdx = board.columns.findIndex((c) => `col-${c.id}` === overId);
      if (fromIdx === toIdx) return;
      const newCols = arrayMove(board.columns, fromIdx, toIdx).map((c, i) => ({ ...c, position: i }));
      setBoard({ ...board, columns: newCols });
      await Promise.all(newCols.map((c) => api.patch(`/columns/${c.id}`, { position: c.position })));
      return;
    }

    // Card reorder / move
    if (activeId.startsWith("card-")) {
      const cardId = parseInt(activeId.replace("card-", ""));
      const targetCol = board.columns.find((col) => col.cards.some((c) => c.id === cardId))!;
      const newPosition = targetCol.cards.findIndex((c) => c.id === cardId);
      await api.patch(`/cards/${cardId}/move`, { columnId: targetCol.id, position: newPosition });
      // Update positions of remaining cards in affected columns
      await Promise.all(
        board.columns.map((col) =>
          Promise.all(col.cards.map((c, i) => (c.position !== i ? api.patch(`/cards/${c.id}/move`, { columnId: col.id, position: i }) : Promise.resolve())))
        )
      );
    }
  };

  const activeCard = activeCardId
    ? board.columns.flatMap((c) => c.cards).find((c) => c.id === activeCardId)
    : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: board.color + "22" }}>
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <button onClick={() => navigate("/")} className="text-gray-400 hover:text-gray-700 text-sm transition">
          ← Boards
        </button>
        <span className="font-bold text-gray-900">{board.title}</span>
        <span className="ml-auto text-sm text-gray-400">{user.username}</span>
      </nav>

      {/* Board */}
      <div className="flex-1 overflow-x-auto px-6 py-6 flex justify-center">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="flex items-start gap-4 min-w-max mx-auto w-fit">
          <SortableContext
            items={board.columns.map((c) => `col-${c.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-4 items-start">
              {board.columns.map((col) => {
                  return (
                    <SortableColumn
                      key={col.id}
                      column={col}
                      onCardClick={setOpenCardId}
                      onAddCard={addCard}
                      onRenameColumn={renameColumn}
                      onDeleteColumn={deleteColumn}
                      activeCardId={activeCardId}
                    />
                  );
                })}

            </div>
          </SortableContext>

          {/* Add column — outside centered group, sits to the right */}
          <div className="w-64 flex-shrink-0">
            {addingCol ? (
              <div className="bg-gray-100 rounded-xl p-3">
                <input
                  autoFocus
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  placeholder="Column title"
                  value={newColTitle}
                  onChange={(e) => setNewColTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addColumn();
                    if (e.key === "Escape") { setAddingCol(false); setNewColTitle(""); }
                  }}
                />
                <div className="flex gap-1">
                  <button
                    onClick={addColumn}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition"
                  >
                    Add Column
                  </button>
                  <button
                    onClick={() => { setAddingCol(false); setNewColTitle(""); }}
                    className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingCol(true)}
                className="w-full bg-white/60 hover:bg-white/90 text-gray-600 text-sm font-medium py-3 rounded-xl transition border border-dashed border-gray-300"
              >
                + Add column
              </button>
            )}
          </div>
          </div>

          <DragOverlay>
            {activeCard && (
              <div className="bg-white rounded-lg px-3 py-2.5 shadow-lg border border-blue-400 w-60">
                <p className="text-sm text-gray-800 font-medium">{activeCard.title}</p>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Card Modal */}
      {openCardId !== null && (
        <CardModal
          cardId={openCardId}
          boardLabels={board.labels}
          onClose={handleModalClose}
          onUpdated={updateCard}
        />
      )}
    </div>
  );
}
