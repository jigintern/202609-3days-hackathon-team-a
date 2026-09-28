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

    const rankedEvents = events.map((event) => {
      const isOshi = event.artistId === req.user.oshiArtistId;
      const isFollowing = followedArtistIds.has(event.artistId);
      return { event, isOshi, isFollowing, rank: isOshi ? 0 : isFollowing ? 1 : 2 };
    });
    rankedEvents.sort((a, b) => a.rank - b.rank || a.event.startsAt - b.event.startsAt);

    res.json({
      events: rankedEvents.map(({ event, isOshi, isFollowing }) => ({
        id: event.id,
        title: event.title,
        venue: event.venue,
        prefecture: event.prefecture,
        startsAt: event.startsAt,
        artist: {
          ...event.artist,
          isOshi,
          isFollowing,
        },
      })),
    });
  })
);
