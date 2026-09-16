import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const homeRouter = Router();

homeRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const follows = await prisma.follow.findMany({
      where: { userId: req.user.id },
      select: { artistId: true },
    });
    const artistIds = follows.map((f) => f.artistId);

    if (artistIds.length === 0) {
      res.json({ events: [] });
      return;
    }

    const events = await prisma.event.findMany({
      where: { artistId: { in: artistIds }, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      include: { artist: { select: { id: true, name: true, imageUrl: true } } },
    });

    res.json({
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        venue: event.venue,
        prefecture: event.prefecture,
        startsAt: event.startsAt,
        artist: { ...event.artist, isOshi: event.artist.id === req.user.oshiArtistId },
      })),
    });
  })
);
