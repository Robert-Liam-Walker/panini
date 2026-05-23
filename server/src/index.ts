import Fastify from "fastify";
import cookie from "@fastify/cookie";
import session from "@fastify/session";
import cors from "@fastify/cors";
import path from "path";
import { fileURLToPath } from "url";

import { authRoutes } from "./routes/auth.js";
import { boardRoutes } from "./routes/boards.js";
import { columnRoutes } from "./routes/columns.js";
import { cardRoutes } from "./routes/cards.js";
import { labelRoutes } from "./routes/labels.js";
import { commentRoutes } from "./routes/comments.js";

declare module "@fastify/session" {
  interface FastifySessionObject {
    userId?: number;
  }
}

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.NODE_ENV === "production" ? false : "http://localhost:5173",
  credentials: true,
});

await app.register(cookie);
await app.register(session, {
  secret: process.env.SESSION_SECRET ?? "panini-dev-secret-changeme-32chars!",
  cookie: {
    secure: process.env.COOKIE_SECURE === "true",
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});

// Serve built client in production
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  await app.register(import("@fastify/static"), {
    root: path.join(__dirname, "../../client/dist"),
    prefix: "/",
  });
  app.setNotFoundHandler((_req, reply) => {
    reply.sendFile("index.html");
  });
}

await app.register(authRoutes);
await app.register(boardRoutes);
await app.register(columnRoutes);
await app.register(cardRoutes);
await app.register(labelRoutes);
await app.register(commentRoutes);

const port = parseInt(process.env.PORT ?? "3000");
try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
