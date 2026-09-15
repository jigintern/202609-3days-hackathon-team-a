import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Errors } from "../../utils/errors.js";
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
  imageUrls: z.array(z.string().url()).max(env.imageMaxCount).optional(),
});

adminEventsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.issues[0]?.message ?? "入力が不正です");
    }

    const artist = await prisma.artist.findUnique({ where: { id: parsed.data.artistId } });
    if (!artist) throw Errors.validation("指定されたアーティストが存在しません");

    const event = await prisma.event.create({ data: parsed.data });
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

    const event = await prisma.event.update({
      where: { id: req.params.eventId },
      data: parsed.data,
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
