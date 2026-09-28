import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Errors } from "../utils/errors.js";

export const eventRequestsRouter = Router();

const createEventRequestSchema = z.object({
  // 一覧から選ばれた場合のみ入る。「その他」で自由入力された場合は付かない
  artistId: z.string().uuid().optional(),
  artistName: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(100),
  venue: z.string().trim().max(200).optional(),
  startsAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
});

function serializeEventRequest(request) {
  return {
    id: request.id,
    artistId: request.artistId,
    artistName: request.artistName,
    title: request.title,
    venue: request.venue,
    startsAt: request.startsAt,
    note: request.note,
    status: request.status,
    createdAt: request.createdAt,
  };
}

eventRequestsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createEventRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.issues[0]?.message ?? "入力が不正です");
    }

    // 存在しないIDをそのまま入れると外部キー違反で500になるため、先に確かめる
    const data = { ...parsed.data };
    if (data.artistId) {
      const artist = await prisma.artist.findUnique({ where: { id: data.artistId } });
      if (!artist) throw Errors.validation("選択されたアーティストが見つかりません");
      // 送られてきた名前は古い可能性があるため、選ばれたアーティストの現在の名前で保存する
      data.artistName = artist.name;
    }

    const request = await prisma.eventRequest.create({
      data: { userId: req.user.id, ...data },
    });

    res.status(201).json({ eventRequest: serializeEventRequest(request) });
  })
);

eventRequestsRouter.get(
  "/mine",
  asyncHandler(async (req, res) => {
    const requests = await prisma.eventRequest.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    res.json({ eventRequests: requests.map(serializeEventRequest) });
  })
);
