import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Errors } from "../../utils/errors.js";

export const adminArtistsRouter = Router();

const artistSchema = z.object({
  name: z.string().trim().min(1).max(100),
  nameKana: z.string().trim().max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  imageUrl: z.string().url().optional(),
});

const updateArtistSchema = artistSchema.partial();

adminArtistsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const artists = await prisma.artist.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { events: true, follows: true } } },
    });

    res.json({
      artists: artists.map((artist) => ({
        id: artist.id,
        name: artist.name,
        nameKana: artist.nameKana,
        description: artist.description,
        imageUrl: artist.imageUrl,
        eventCount: artist._count.events,
        followerCount: artist._count.follows,
        createdAt: artist.createdAt,
      })),
    });
  })
);

adminArtistsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = artistSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.issues[0]?.message ?? "入力が不正です");
    }

    const artist = await prisma.artist.create({ data: parsed.data });
    res.status(201).json({ artist });
  })
);

adminArtistsRouter.patch(
  "/:artistId",
  asyncHandler(async (req, res) => {
    const parsed = updateArtistSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.issues[0]?.message ?? "入力が不正です");
    }

    const existing = await prisma.artist.findUnique({ where: { id: req.params.artistId } });
    if (!existing) throw Errors.notFound("アーティストが見つかりません");

    const artist = await prisma.artist.update({
      where: { id: req.params.artistId },
      data: parsed.data,
    });

    res.json({ artist });
  })
);
