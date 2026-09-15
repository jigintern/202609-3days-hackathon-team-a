import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Errors } from "../utils/errors.js";
import { decodeCursor, paginateByKey, parseLimit } from "../utils/pagination.js";
import { assertCooldownElapsed } from "../utils/cooldown.js";
import { isUploadedImageUrl } from "../lib/supabaseStorage.js";
import { env } from "../lib/env.js";

export const eventPostsRouter = Router({ mergeParams: true });
export const postsRouter = Router();

const createPostSchema = z.object({
  body: z.string().trim().min(1).max(env.postMaxLength),
  imageUrls: z
    .array(
      z
        .string()
        .refine(isUploadedImageUrl, "画像URLは POST /api/uploads/images が返したものだけを指定できます")
    )
    .max(env.imageMaxCount)
    .optional(),
});

// 並び順のキー。カーソルにこれを入れることで、ページ取得の合間に投稿が
// 増減しても境界がずれない（降順なので比較結果は反転させる）
function buildSortKey(post, sort) {
  return {
    reactionCount: sort === "reactions" ? post.reactions.length : 0,
    createdAt: post.createdAt.toISOString(),
    id: post.id,
  };
}

function compareSortKeys(a, b) {
  if (a.reactionCount !== b.reactionCount) return b.reactionCount - a.reactionCount;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

function serializePost(post, viewerId) {
  return {
    id: post.id,
    eventId: post.eventId,
    type: post.type,
    body: post.body,
    imageUrls: post.images
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((image) => image.url),
    authorId: post.userId,
    authorDisplayName: post.user.displayName,
    isMine: post.userId === viewerId,
    reactionCount: post.reactions.length,
    reactedByMe: post.reactions.some((r) => r.userId === viewerId),
    createdAt: post.createdAt,
  };
}

async function readReactionState(postId, userId) {
  const [reactionCount, mine] = await Promise.all([
    prisma.reaction.count({ where: { postId } }),
    prisma.reaction.findUnique({ where: { postId_userId: { postId, userId } } }),
  ]);

  return { reactionCount, reactedByMe: Boolean(mine) };
}

eventPostsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const type = req.query.type === "official" ? "official" : "fan";
    const sort = type === "official"
      ? "latest"
      : req.query.sort === "latest"
        ? "latest"
        : "reactions";
    const limit = parseLimit(req.query.limit);

    const posts = await prisma.post.findMany({
      where: { eventId: req.params.eventId, type, deletedAt: null },
      include: { images: true, reactions: true, user: { select: { displayName: true } } },
    });

    const sorted = posts
      .map((post) => ({ value: post, key: buildSortKey(post, sort) }))
      .sort((a, b) => compareSortKeys(a.key, b.key));

    const { items, nextCursor } = paginateByKey(sorted, {
      cursor: decodeCursor(req.query.cursor),
      limit,
      compareKeys: compareSortKeys,
    });

    res.json({
      posts: items.map((post) => serializePost(post, req.user.id)),
      nextCursor,
    });
  })
);

eventPostsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
    if (!event) throw Errors.notFound("イベントが見つかりません");

    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.issues[0]?.message ?? "入力が不正です");
    }

    const lastPost = await prisma.post.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    assertCooldownElapsed(lastPost?.createdAt, env.postCooldownSeconds);

    const post = await prisma.post.create({
      data: {
        eventId: event.id,
        userId: req.user.id,
        type: "fan",
        body: parsed.data.body,
        images: {
          create: (parsed.data.imageUrls ?? []).map((url, position) => ({ url, position })),
        },
      },
      include: { images: true, reactions: true, user: { select: { displayName: true } } },
    });

    res.status(201).json({ post: serializePost(post, req.user.id) });
  })
);

postsRouter.delete(
  "/:postId",
  asyncHandler(async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (!post || post.deletedAt) throw Errors.notFound("投稿が見つかりません");
    if (post.userId !== req.user.id) throw Errors.forbidden();

    await prisma.post.update({
      where: { id: post.id },
      data: { deletedAt: new Date() },
    });

    res.status(204).end();
  })
);

postsRouter.post(
  "/:postId/reactions",
  asyncHandler(async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (!post || post.deletedAt) throw Errors.notFound("投稿が見つかりません");

    await prisma.reaction.upsert({
      where: { postId_userId: { postId: post.id, userId: req.user.id } },
      update: {},
      create: { postId: post.id, userId: req.user.id },
    });

    res.json(await readReactionState(post.id, req.user.id));
  })
);

postsRouter.delete(
  "/:postId/reactions",
  asyncHandler(async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.postId } });
    if (!post || post.deletedAt) throw Errors.notFound("投稿が見つかりません");

    await prisma.reaction.deleteMany({
      where: { postId: post.id, userId: req.user.id },
    });

    res.json(await readReactionState(post.id, req.user.id));
  })
);
