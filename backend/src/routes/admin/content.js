import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Errors } from "../../utils/errors.js";

export const adminContentRouter = Router();

adminContentRouter.get(
  "/posts",
  asyncHandler(async (req, res) => {
    const posts = await prisma.post.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        images: true,
        event: { select: { id: true, title: true } },
        user: { select: { id: true, displayName: true } },
      },
    });

    res.json({
      posts: posts.map((post) => ({
        id: post.id,
        type: post.type,
        body: post.body,
        imageUrls: post.images.sort((a, b) => a.position - b.position).map((i) => i.url),
        event: post.event,
        author: post.user,
        createdAt: post.createdAt,
      })),
    });
  })
);

adminContentRouter.delete(
  "/posts/:postId",
  asyncHandler(async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (!post || post.deletedAt) throw Errors.notFound("投稿が見つかりません");

    await prisma.post.update({ where: { id: post.id }, data: { deletedAt: new Date() } });
    res.status(204).end();
  })
);

adminContentRouter.get(
  "/messages",
  asyncHandler(async (req, res) => {
    const messages = await prisma.chatMessage.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        event: { select: { id: true, title: true } },
        user: { select: { id: true, displayName: true } },
      },
    });

    res.json({
      messages: messages.map((message) => ({
        id: message.id,
        body: message.body,
        event: message.event,
        author: message.user,
        createdAt: message.createdAt,
      })),
    });
  })
);

adminContentRouter.delete(
  "/messages/:messageId",
  asyncHandler(async (req, res) => {
    const message = await prisma.chatMessage.findUnique({ where: { id: req.params.messageId } });
    if (!message || message.deletedAt) throw Errors.notFound("発言が見つかりません");

    await prisma.chatMessage.update({ where: { id: message.id }, data: { deletedAt: new Date() } });
    res.status(204).end();
  })
);
