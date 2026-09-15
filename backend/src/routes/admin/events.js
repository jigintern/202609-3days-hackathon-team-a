import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Errors } from "../../utils/errors.js";
import { isUploadedImageUrl } from "../../lib/supabaseStorage.js";
import { normalizeOptional } from "../../utils/normalizeOptional.js";
import { decodeCursor, encodeCursor, parseLimit } from "../../utils/pagination.js";
import { env } from "../../lib/env.js";

export const adminEventsRouter = Router();

const eventSchema = z.object({
  artistId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  venue: z.string().trim().min(1).max(200),
  prefecture: z.string().trim().max(50).optional(),
  startsAt: z.coerce.date(),
});

const updateEventSchema = eventSchema.partial();

const officialPostSchema = z.object({
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

adminEventsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const limit = parseLimit(req.query.limit, { fallback: 50, max: 100 });
    const cursor = decodeCursor(req.query.cursor);

    // 単に件数で打ち切ると上限を超えた分に管理画面から到達できなくなるため、
    // (startsAt, id) の複合キーで続きを取れるようにする
    const rows = await prisma.event.findMany({
      where: cursor
        ? {
            OR: [
              { startsAt: { lt: new Date(cursor.startsAt) } },
              { startsAt: new Date(cursor.startsAt), id: { lt: cursor.id } },
            ],
          }
        : {},
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        artist: { select: { id: true, name: true } },
        _count: { select: { posts: true, messages: true } },
      },
    });

    const hasMore = rows.length > limit;
    const events = hasMore ? rows.slice(0, limit) : rows;
    const last = events[events.length - 1];

    res.json({
      nextCursor:
        hasMore && last
          ? encodeCursor({ startsAt: last.startsAt.toISOString(), id: last.id })
          : null,
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        venue: event.venue,
        prefecture: event.prefecture,
        startsAt: event.startsAt,
        artist: event.artist,
        postCount: event._count.posts,
        messageCount: event._count.messages,
      })),
    });
  })
);

adminEventsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.issues[0]?.message ?? "入力が不正です");
    }

    const artist = await prisma.artist.findUnique({ where: { id: parsed.data.artistId } });
    if (!artist) throw Errors.validation("指定されたアーティストが存在しません");

    const event = await prisma.event.create({ data: normalizeOptional(parsed.data) });
    res.status(201).json({ event });
  })
);

adminEventsRouter.patch(
  "/:eventId",
  asyncHandler(async (req, res) => {
    const parsed = updateEventSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.issues[0]?.message ?? "入力が不正です");
    }

    const existing = await prisma.event.findUnique({ where: { id: req.params.eventId } });
    if (!existing) throw Errors.notFound("イベントが見つかりません");

    // POST側と同じく、外部キー制約違反が500になる前に弾く
    if (parsed.data.artistId) {
      const artist = await prisma.artist.findUnique({ where: { id: parsed.data.artistId } });
      if (!artist) throw Errors.validation("指定されたアーティストが存在しません");
    }

    const event = await prisma.event.update({
      where: { id: req.params.eventId },
      data: normalizeOptional(parsed.data),
    });

    res.json({ event });
  })
);

adminEventsRouter.post(
  "/:eventId/official-posts",
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
    if (!event) throw Errors.notFound("イベントが見つかりません");

    const parsed = officialPostSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.issues[0]?.message ?? "入力が不正です");
    }

    const post = await prisma.post.create({
      data: {
        eventId: event.id,
        userId: req.user.id,
        type: "official",
        body: parsed.data.body,
        images: {
          create: (parsed.data.imageUrls ?? []).map((url, position) => ({ url, position })),
        },
      },
      include: { images: true },
    });

    res.status(201).json({
      post: {
        id: post.id,
        eventId: post.eventId,
        type: post.type,
        body: post.body,
        imageUrls: post.images.sort((a, b) => a.position - b.position).map((i) => i.url),
        createdAt: post.createdAt,
      },
    });
  })
);
