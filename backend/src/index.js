import express from "express";
import cors from "cors";
import { env } from "./lib/env.js";
import { requireAuth, requireProfile } from "./middlewares/auth.js";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler.js";

import { authRouter } from "./routes/auth.js";
import { artistsRouter } from "./routes/artists.js";
import { homeRouter } from "./routes/home.js";
import { eventsRouter } from "./routes/events.js";
import { eventPostsRouter, postsRouter } from "./routes/posts.js";
import { eventMessagesRouter, messagesRouter } from "./routes/messages.js";
import { uploadsRouter } from "./routes/uploads.js";
import { eventRequestsRouter } from "./routes/eventRequests.js";
import { vaultRouter } from "./routes/vault.js";
import { configRouter } from "./routes/config.js";
import { adminRouter } from "./routes/admin/index.js";

const app = express();

app.use(cors({ origin: env.frontendOrigin }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

// 制限値をフロントと共有するための設定配信。秘密情報を含まないため認証不要。
app.use("/api/config", configRouter);

// サインアップ/ログインはフロントがSupabaseに直接行う。ここは検証とプロフィール管理のみ。
app.use("/api/auth", authRouter);

const authed = [requireAuth, requireProfile];

app.use("/api/artists", ...authed, artistsRouter);
app.use("/api/home", ...authed, homeRouter);
app.use("/api/events/:eventId/posts", ...authed, eventPostsRouter);
app.use("/api/events/:eventId/messages", ...authed, eventMessagesRouter);
app.use("/api/events", ...authed, eventsRouter);
app.use("/api/posts", ...authed, postsRouter);
app.use("/api/messages", ...authed, messagesRouter);
app.use("/api/uploads", ...authed, uploadsRouter);
app.use("/api/event-requests", ...authed, eventRequestsRouter);
app.use("/api/vault", ...authed, vaultRouter);
app.use("/api/admin", ...authed, adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`API server listening on http://localhost:${env.port}`);
});
