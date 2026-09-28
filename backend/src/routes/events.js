import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Errors } from "../utils/errors.js";

export const eventsRouter = Router();

eventsRouter.get(
  "/:eventId",
  asyncHandler(async (req, res) => {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      include: { artist: { select: { id: true, name: true, imageUrl: true } } },
    });
    if (!event) throw Errors.notFound("イベントが見つかりません");

    res.json({
      event: {
        id: event.id,
        title: event.title,
        venue: event.venue,
        prefecture: event.prefecture,
        startsAt: event.startsAt,
        artist: event.artist,
      },
    });
  })
);
