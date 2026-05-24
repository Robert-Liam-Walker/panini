import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import prisma from "../lib/prisma.js";

// Admin routes bypass session auth and are protected by a bearer token.
// They exist so external scripts / sibling projects can seed boards for
// a named user without holding a logged-in cookie. The token is read from
// the ADMIN_TOKEN env var; if unset, all admin routes return 503.

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return reply.status(503).send({ error: "Admin API disabled (ADMIN_TOKEN not set)" });
  }
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== expected) {
    return reply.status(401).send({ error: "Invalid admin token" });
  }
}

type SeedCard = {
  columnTitle: string;
  title: string;
  description?: string;
  priority?: string;
  position?: number;
};

type SeedBody = {
  username: string;
  title: string;
  color?: string;
  cards?: SeedCard[];
  reuseExisting?: boolean; // if true and a board with this title already exists for the user, use it instead of creating new
};

export async function adminRoutes(app: FastifyInstance) {
  // Move a card to a column referenced by title on the same board.
  // Idempotent: appends to the end of the target column. Pass `position`
  // to override placement.
  app.patch("/api/admin/cards/:id/move", { preHandler: requireAdmin }, async (req, reply) => {
    const id = parseInt((req.params as { id: string }).id);
    if (!Number.isFinite(id)) return reply.status(400).send({ error: "Invalid card id" });
    const { columnTitle, position } = req.body as { columnTitle: string; position?: number };
    if (!columnTitle) return reply.status(400).send({ error: "columnTitle required" });

    const card = await prisma.card.findUnique({
      where: { id },
      include: { column: { include: { board: { include: { columns: true } } } } },
    });
    if (!card) return reply.status(404).send({ error: "Card not found" });

    const targetCol = card.column.board.columns.find(
      (c) => c.title.toLowerCase() === columnTitle.toLowerCase(),
    );
    if (!targetCol) {
      return reply.status(400).send({
        error: `Column '${columnTitle}' not found on board ${card.column.board.id}`,
        availableColumns: card.column.board.columns.map((c) => c.title),
      });
    }

    const last = await prisma.card.findFirst({
      where: { columnId: targetCol.id },
      orderBy: { position: "desc" },
    });
    const newPosition = position ?? (last?.position ?? -1) + 1;
    const updated = await prisma.card.update({
      where: { id },
      data: { columnId: targetCol.id, position: newPosition },
    });
    await prisma.activity.create({
      data: { cardId: id, action: "moved", detail: `admin → ${targetCol.title}` },
    });
    return reply.send(updated);
  });

  app.get("/api/admin/users", { preHandler: requireAdmin }, async (_req, reply) => {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, createdAt: true, _count: { select: { boards: true } } },
      orderBy: { id: "asc" },
    });
    return reply.send(users);
  });

  app.get("/api/admin/users/:username/boards", { preHandler: requireAdmin }, async (req, reply) => {
    const { username } = req.params as { username: string };
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return reply.status(404).send({ error: "User not found" });
    const boards = await prisma.board.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { columns: true } } },
    });
    return reply.send(boards);
  });

  // Create a board for a named user and (optionally) populate cards in
  // columns referenced by title. Default columns ("To Do", "In Progress",
  // "Done") are created automatically. Card columnTitle is matched
  // case-insensitively against the created columns.
  app.post("/api/admin/boards/seed", { preHandler: requireAdmin }, async (req, reply) => {
    const body = req.body as SeedBody;
    if (!body?.username || !body?.title) {
      return reply.status(400).send({ error: "username and title required" });
    }
    const user = await prisma.user.findUnique({ where: { username: body.username } });
    if (!user) return reply.status(404).send({ error: `User '${body.username}' not found` });

    let board = body.reuseExisting
      ? await prisma.board.findFirst({ where: { userId: user.id, title: body.title } })
      : null;

    if (!board) {
      board = await prisma.board.create({
        data: { title: body.title, color: body.color ?? "#0052cc", userId: user.id },
      });
      await prisma.column.createMany({
        data: [
          { title: "To Do", position: 0, boardId: board.id },
          { title: "In Progress", position: 1, boardId: board.id },
          { title: "Done", position: 2, boardId: board.id },
        ],
      });
    }

    const columns = await prisma.column.findMany({ where: { boardId: board.id } });
    const byTitle = new Map(columns.map((c) => [c.title.toLowerCase(), c]));

    const createdCards: { id: number; title: string; columnId: number }[] = [];
    if (Array.isArray(body.cards)) {
      for (const c of body.cards) {
        const col = byTitle.get(c.columnTitle.toLowerCase());
        if (!col) {
          return reply
            .status(400)
            .send({ error: `Column '${c.columnTitle}' not found on board ${board.id}` });
        }
        const last = await prisma.card.findFirst({
          where: { columnId: col.id },
          orderBy: { position: "desc" },
        });
        const position = c.position ?? (last?.position ?? -1) + 1;
        const card = await prisma.card.create({
          data: {
            title: c.title,
            description: c.description,
            priority: c.priority,
            position,
            columnId: col.id,
          },
        });
        await prisma.activity.create({ data: { cardId: card.id, action: "created", detail: "admin seed" } });
        createdCards.push({ id: card.id, title: card.title, columnId: card.columnId });
      }
    }

    const fullBoard = await prisma.board.findUnique({
      where: { id: board.id },
      include: {
        columns: {
          orderBy: { position: "asc" },
          include: { cards: { orderBy: { position: "asc" } } },
        },
      },
    });
    return reply.status(201).send({ board: fullBoard, createdCards });
  });
}
