import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Errors } from "../utils/errors.js";
import { assertCooldownElapsed } from "../utils/cooldown.js";
import { env } from "../lib/env.js";

export const eventMessagesRouter = Router({ mergeParams: true });
export const messagesRouter = Router();

const INITIAL_MESSAGE_LIMIT = 50;

const createMessageSchema = z.object({
  body: z.string().trim().min(1).max(env.chatMaxLength),
});

function serializeMessage(message, viewerId) {
  return {
    id: message.id,
    eventId: message.eventId,
    body: message.body,
    authorDisplayName: message.user.displayName,
    authorId: message.userId,
    isMine: message.userId === viewerId,
    createdAt: message.createdAt,
  };
}

/// ポーリングでは新着しか届かないため、削除された発言のidも併せて返す。
/// これが無いと他人が消した発言が各クライアントに残り続ける。
async function findDeletedIds(eventId, deletedSince) {
  if (!deletedSince) return [];

  const since = new Date(String(deletedSince));
  if (Number.isNaN(since.getTime())) {
    throw Errors.validation("deletedSinceの形式が不正です");
  }

  const deleted = await prisma.chatMessage.findMany({
    where: { eventId, deletedAt: { gt: since } },
    select: { id: true },
  });

  return deleted.map((message) => message.id);
}

eventMessagesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const include = { user: { select: { displayName: true } } };
    // 取得処理の前の時刻を返す。取りこぼしを防ぐため、この後に起きた削除は次回に回す
    const polledAt = new Date();
    const deletedIds = await findDeletedIds(req.params.eventId, req.query.deletedSince);

    if (req.query.after) {
      const anchor = await prisma.chatMessage.findUnique({
        where: { id: String(req.query.after) },
        select: { id: true, createdAt: true },
      });
      if (!anchor) throw Errors.notFound("発言が見つかりません");

      // createdAt だけで比較すると同一ミリ秒の発言を取りこぼすため、(createdAt, id) の複合キーで送る
      const messages = await prisma.chatMessage.findMany({
        where: {
          eventId: req.params.eventId,
          deletedAt: null,
          OR: [
            { createdAt: { gt: anchor.createdAt } },
            { createdAt: anchor.createdAt, id: { gt: anchor.id } },
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include,
      });

      res.json({
        messages: messages.map((m) => serializeMessage(m, req.user.id)),
        deletedIds,
        polledAt,
      });
      return;
    }

    const latest = await prisma.chatMessage.findMany({
      where: { eventId: req.params.eventId, deletedAt: null },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: INITIAL_MESSAGE_LIMIT,
      include,
    });

    res.json({
      messages: latest.reverse().map((m) => serializeMessage(m, req.user.id)),
      deletedIds,
      polledAt,
    });
  })
);

eventMessagesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
    if (!event) throw Errors.notFound("イベントが見つかりません");

    const parsed = createMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.issues[0]?.message ?? "入力が不正です");
    }

    const lastMessage = await prisma.chatMessage.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    assertCooldownElapsed(lastMessage?.createdAt, env.chatCooldownSeconds);

    const message = await prisma.chatMessage.create({
      data: { eventId: event.id, userId: req.user.id, body: parsed.data.body },
      include: { user: { select: { displayName: true } } },
    });

    res.status(201).json({ message: serializeMessage(message, req.user.id) });
  })
);

messagesRouter.delete(
  "/:messageId",
  asyncHandler(async (req, res) => {
    const message = await prisma.chatMessage.findUnique({ where: { id: req.params.messageId } });
    if (!message || message.deletedAt) throw Errors.notFound("発言が見つかりません");
    if (message.userId !== req.user.id) throw Errors.forbidden();

    await prisma.chatMessage.update({
      where: { id: message.id },
      data: { deletedAt: new Date() },
    });

    res.status(204).end();
  })
);
