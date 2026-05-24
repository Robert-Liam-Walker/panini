# Simple Kanban Service — Codex Handoff Document

This document gives any AI agent (Codex, Claude, etc.) full context to continue development from any point.

---

## What This Is

Simple Kanban Service is a local-first Kanban board web app. Single user, runs locally on macOS, deployable to EC2.

**Stack:** Fastify (TypeScript) backend + React/Vite (TypeScript) frontend + MySQL via Prisma ORM + Tailwind CSS + @dnd-kit drag-and-drop.

**Repo:** https://github.com/Robert-Liam-Walker/simple-kanban-service

---

## Directory Structure

```
simple-kanban-service/
  server/                    # Fastify API server
    src/
      index.ts               # App entry, registers all plugins + routes
      middleware/auth.ts     # requireAuth hook (checks req.session.userId)
      lib/prisma.ts          # Singleton PrismaClient
      routes/
        auth.ts              # /api/auth/* (register, login, logout, me)
        boards.ts            # /api/boards/* CRUD
        columns.ts           # /api/columns/* CRUD + reorder
        cards.ts             # /api/cards/* CRUD + move + archive + labels
        labels.ts            # /api/boards/:id/labels + /api/labels/:id
        comments.ts          # /api/cards/:id/comments + /api/comments/:id
        search.ts            # /api/search?q=
        admin.ts             # /api/admin/* token-protected (ADMIN_TOKEN); used by sibling projects to seed boards/cards for a named user
    prisma/
      schema.prisma          # DB schema — User, Board, Column, Card, Label, CardLabel, Comment, Activity
      migrations/            # Prisma migrations (applied, do not edit)
    package.json             # type: "module", NodeNext module resolution
    tsconfig.json            # target ES2022, module NodeNext
  client/                    # React + Vite app
    src/
      main.tsx               # Entry point, renders <App />
      index.css              # Tailwind directives only
      App.tsx                # Routes: / → BoardsPage, /boards/:id → BoardPage; login gate
      api/
        client.ts            # fetch wrapper: api.get/post/patch/delete
        types.ts             # TS interfaces: User, Board, Column, Card, Label, Comment, etc.
      hooks/
        useAuth.ts           # Fetches /api/auth/me on mount; provides user, logout
      pages/
        LoginPage.tsx        # Login + register tabs, light mode
        BoardsPage.tsx       # Grid of boards, create board modal with color picker
        BoardPage.tsx        # Full board: SortableColumn + SortableCard + DragOverlay + search
      components/
        CardModal.tsx        # Card detail: title, description, due date, labels, comments, archive
    vite.config.ts           # Proxy /api → http://localhost:3000
    tailwind.config.js       # Content: src/**/*.{ts,tsx}
  package.json               # npm workspaces root; "dev" uses concurrently
  .env                       # DATABASE_URL, SESSION_SECRET, PORT — NOT committed
  .env.example               # Template for .env
  FEATURES.md                # Feature checklist with [ ]/[~]/[x] status
  CODEX.md                   # This file
  README.md                  # Setup + run instructions
```

---

## Database

- **Engine:** MySQL (two MySQL instances on this machine — use the Homebrew one)
- **Port:** 3307 (Homebrew MySQL, to avoid conflict with Oracle MySQL on 3306)
- **DB name:** `simple_kanban_service`
- **User:** `simple_kanban_service` / `simple_kanban_service`
- **Socket:** `/tmp/mysql_brew.sock`
- **Root password:** `root` (Homebrew MySQL only)

The Homebrew MySQL is started with:
```bash
mysqld --defaults-file=/opt/homebrew/etc/my.cnf --datadir=/opt/homebrew/var/mysql --user=liamwalker --daemonize
```

`/opt/homebrew/etc/my.cnf` contains:
```
[mysqld]
port = 3307
socket = /tmp/mysql_brew.sock

[client]
port = 3307
socket = /tmp/mysql_brew.sock
```

To check if it's running: `mysql --socket=/tmp/mysql_brew.sock -u simple_kanban_service -psimple_kanban_service simple_kanban_service -e "SELECT 1"`

If not running, start it: `mysqld --defaults-file=/opt/homebrew/etc/my.cnf --datadir=/opt/homebrew/var/mysql --user=liamwalker --daemonize`

---

## Running the App

```bash
cd ~/Documents/Development/simple-kanban-service

# 1. Make sure Homebrew MySQL is running (check above)

# 2. Start dev server
npm run dev
# → server: http://localhost:3000
# → client: http://localhost:5173

# OR run individually:
npm run dev --workspace=server    # port 3000
npm run dev --workspace=client    # port 5173 (proxies /api to 3000)
```

---

## Environment

`.env` (in project root, loaded by server via `process.env`):
```
DATABASE_URL=mysql://simple_kanban_service:simple_kanban_service@localhost:3307/simple_kanban_service
SESSION_SECRET=<generated-random-string>
PORT=3000
NODE_ENV=development
```

The server reads `.env` via `tsx` (which auto-loads .env). For migrations:
```bash
cd server
DATABASE_URL=mysql://simple_kanban_service:simple_kanban_service@localhost:3307/simple_kanban_service npx prisma migrate dev --name <name>
```

---

## Key Design Decisions

- **ESM throughout:** Both server and client use ES modules. Server `package.json` has `"type": "module"`, `tsconfig.json` uses `"module": "NodeNext"`.
- **Session auth:** `@fastify/session` with `@fastify/cookie`. Session stores `userId`. All routes behind `requireAuth` middleware.
- **Light mode only:** No dark mode. UI is white/gray/blue.
- **Drag-and-drop:** Uses `@dnd-kit/core` + `@dnd-kit/sortable`. Columns use `horizontalListSortingStrategy`, cards use `verticalListSortingStrategy`. Card moves are persisted on `dragEnd` via `PATCH /api/cards/:id/move`.
- **Default columns:** When a new board is created, the server automatically creates "To Do", "In Progress", "Done" columns.
- **Soft delete:** Cards have `archived: boolean`. Archived cards are filtered from board queries.

---

## What Still Needs Building

See `FEATURES.md` for the full checklist. Priority items:

1. **Create Label UI** — There's no UI to create labels for a board. The API exists at `POST /api/boards/:id/labels`. Add a "Manage Labels" section in the board header or card modal.
2. **Markdown in card description** — Currently plain text. Add a markdown renderer (e.g., `react-markdown`).
3. **Activity feed** — `Activity` model and API exist, not rendered in `CardModal.tsx` yet.
4. **Toast notifications** — Currently no user feedback on errors. Add a simple toast system.
5. **Archived cards view** — No way to see/restore archived cards yet.
6. **Global search** — Search is per-board (filters columns inline). Add a global search bar in `BoardsPage.tsx` using `GET /api/search?q=`.
7. **Loading skeletons** — No loading states in `BoardPage.tsx` while fetching board data.

---

## Testing the API Manually

```bash
# Register
curl -c cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Create board
curl -b cookies.txt -X POST http://localhost:3000/api/boards \
  -H "Content-Type: application/json" \
  -d '{"title":"My Board","color":"#0052cc"}'

# List boards
curl -b cookies.txt http://localhost:3000/api/boards
```

---

## Admin API

The admin routes in `server/src/routes/admin.ts` bypass session auth and are
protected by a bearer token. They exist so external scripts and sibling
projects can seed boards for a named user without managing a logged-in
cookie. When `ADMIN_TOKEN` is unset in the env, every admin route returns
503 — there is no insecure fallback.

Endpoints:

- `GET /api/admin/users` — list users (id, username, createdAt, board count).
- `GET /api/admin/users/:username/boards` — list boards for a named user.
- `PATCH /api/admin/cards/:id/move` — move a card to a column referenced
  by title on the same board. Body: `{ columnTitle, position? }`. Appends
  to the end of the target column unless `position` is supplied.
- `POST /api/admin/boards/seed` — create a board for a named user and
  (optionally) populate cards into columns referenced by title. Default
  columns ("To Do", "In Progress", "Done") are created automatically.
  Set `reuseExisting: true` to append cards to a board with the same
  title instead of creating a duplicate.

```bash
# Set ADMIN_TOKEN=<long-random-string> in .env, restart the server, then:
curl -X POST http://localhost:3000/api/admin/boards/seed \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "panini",
    "title": "My Project",
    "color": "#1d4ed8",
    "cards": [
      { "columnTitle": "To Do", "title": "First task", "description": "..." }
    ]
  }'
```
