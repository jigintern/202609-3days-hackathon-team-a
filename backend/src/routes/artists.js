import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Errors } from "../utils/errors.js";

export const artistsRouter = Router();

function serializeArtist(artist, isFollowing, isOshi) {
  return {
    id: artist.id,
    name: artist.name,
    nameKana: artist.nameKana,
    description: artist.description,
    imageUrl: artist.imageUrl,
    isFollowing,
    isOshi,
  };
}

function serializeEvent(event) {
  return {
    id: event.id,
    artistId: event.artistId,
    title: event.title,
    venue: event.venue,
    prefecture: event.prefecture,
    startsAt: event.startsAt,
  };
}

artistsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const [artists, follows] = await Promise.all([
      prisma.artist.findMany({ orderBy: { name: "asc" } }),
      prisma.follow.findMany({ where: { userId: req.user.id }, select: { artistId: true } }),
    ]);

    const followedIds = new Set(follows.map((f) => f.artistId));

    res.json({
      artists: artists.map((artist) =>
        serializeArtist(artist, followedIds.has(artist.id), artist.id === req.user.oshiArtistId)
      ),
    });
  })
);

artistsRouter.get(
  "/:artistId",
  asyncHandler(async (req, res) => {
    const artist = await prisma.artist.findUnique({ where: { id: req.params.artistId } });
    if (!artist) throw Errors.notFound("アーティストが見つかりません");

    const follow = await prisma.follow.findUnique({
      where: { userId_artistId: { userId: req.user.id, artistId: artist.id } },
    });

    res.json({ artist: serializeArtist(artist, Boolean(follow), artist.id === req.user.oshiArtistId) });
  })
);

artistsRouter.get(
  "/:artistId/events",
  asyncHandler(async (req, res) => {
    const artist = await prisma.artist.findUnique({ where: { id: req.params.artistId } });
    if (!artist) throw Errors.notFound("アーティストが見つかりません");

    const scope = req.query.scope === "past" ? "past" : "upcoming";
    const now = new Date();

    const events = await prisma.event.findMany({
      where: {
        artistId: artist.id,
        startsAt: scope === "upcoming" ? { gte: now } : { lt: now },
      },
      orderBy: { startsAt: scope === "upcoming" ? "asc" : "desc" },
    });

    res.json({ events: events.map(serializeEvent) });
  })
);

artistsRouter.post(
  "/:artistId/follow",
  asyncHandler(async (req, res) => {
    const artist = await prisma.artist.findUnique({ where: { id: req.params.artistId } });
    if (!artist) throw Errors.notFound("アーティストが見つかりません");

    await prisma.follow.upsert({
      where: { userId_artistId: { userId: req.user.id, artistId: artist.id } },
      update: {},
      create: { userId: req.user.id, artistId: artist.id },
    });

    res.status(204).end();
  })
);

artistsRouter.post(
  "/:artistId/oshi",
  asyncHandler(async (req, res) => {
    const artist = await prisma.artist.findUnique({ where: { id: req.params.artistId } });
    if (!artist) throw Errors.notFound("アーティストが見つかりません");

    const follow = await prisma.follow.findUnique({
      where: { userId_artistId: { userId: req.user.id, artistId: artist.id } },
    });
    if (!follow) throw Errors.validation("フォロー中のアーティストのみ最推しに設定できます");

    await prisma.user.update({
      where: { id: req.user.id },
      data: { oshiArtistId: artist.id },
    });

    res.status(204).end();
  })
);

artistsRouter.delete(
  "/:artistId/oshi",
  asyncHandler(async (req, res) => {
    await prisma.user.updateMany({
      where: { id: req.user.id, oshiArtistId: req.params.artistId },
      data: { oshiArtistId: null },
    });

    res.status(204).end();
  })
);

artistsRouter.delete(
  "/:artistId/follow",
  asyncHandler(async (req, res) => {
    await prisma.follow.deleteMany({
      where: { userId: req.user.id, artistId: req.params.artistId },
    });

    await prisma.user.updateMany({
      where: { id: req.user.id, oshiArtistId: req.params.artistId },
      data: { oshiArtistId: null },
    });

    res.status(204).end();
  })
);
