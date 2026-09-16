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
    const followedArtistIds = new Set(follows.map((f) => f.artistId));

    const events = await prisma.event.findMany({
      where: { startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      include: { artist: { select: { id: true, name: true, imageUrl: true } } },
    });

    events.sort((a, b) =>
      Number(followedArtistIds.has(b.artistId)) - Number(followedArtistIds.has(a.artistId)) ||
      a.startsAt - b.startsAt
    );

    res.json({
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        venue: event.venue,
        prefecture: event.prefecture,
        startsAt: event.startsAt,
        artist: {
          ...event.artist,
          isOshi: event.artist.id === req.user.oshiArtistId,
          isFollowing: followedArtistIds.has(event.artistId),
        },
      })),
    });
  })
);
