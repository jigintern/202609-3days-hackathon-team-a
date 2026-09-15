import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Errors } from "../../utils/errors.js";
import { normalizeOptional } from "../../utils/normalizeOptional.js";

export const adminArtistsRouter = Router();

// z.string().url() は new URL() で検証するため javascript: なども通ってしまう。
// 画面にそのまま出す値なので http/https に限定する（空文字は「消す」の意味で許可）。
function isHttpUrlOrEmpty(value) {
  if (value === "") return true;

  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const artistSchema = z.object({
  name: z.string().trim().min(1).max(100),
  nameKana: z.string().trim().max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  // 空文字は「値を消す」の意味で受け取る（管理画面で入力欄を空にしたとき）
  imageUrl: z
    .string()
    .refine(isHttpUrlOrEmpty, "imageUrlはhttp/httpsのURLを指定してください")
    .optional(),
});

const updateArtistSchema = artistSchema.partial();

adminArtistsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const artists = await prisma.artist.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
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

    const artist = await prisma.artist.create({ data: normalizeOptional(parsed.data) });
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
      data: normalizeOptional(parsed.data),
    });

    res.json({ artist });
  })
);
