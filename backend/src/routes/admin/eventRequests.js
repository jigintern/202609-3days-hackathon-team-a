import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Errors } from "../../utils/errors.js";

export const adminEventRequestsRouter = Router();

const statusSchema = z.enum(["pending", "approved", "rejected"]);

const updateStatusSchema = z.object({
  status: statusSchema,
});

const listQuerySchema = z.object({
  status: statusSchema.optional(),
});

adminEventRequestsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    // 未検証のクエリをそのままPrismaに渡すと、enumに無い値で500になる
    const parsedQuery = listQuerySchema.safeParse({
      status: req.query.status === "" ? undefined : req.query.status,
    });
    if (!parsedQuery.success) {
      throw Errors.validation("statusは pending / approved / rejected のいずれかです");
    }

    const { status } = parsedQuery.data;
    const where = status ? { status } : {};

    const requests = await prisma.eventRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, displayName: true } } },
    });

    res.json({ eventRequests: requests });
  })
);

adminEventRequestsRouter.patch(
  "/:requestId",
  asyncHandler(async (req, res) => {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.issues[0]?.message ?? "入力が不正です");
    }

    const existing = await prisma.eventRequest.findUnique({ where: { id: req.params.requestId } });
    if (!existing) throw Errors.notFound("申請が見つかりません");

    // 却下する場合と、既に承認済みのものを触る場合は状態を変えるだけ。
    // 承認済みを再度承認してもイベントが二重に作られないようにしている。
    if (parsed.data.status !== "approved" || existing.status === "approved") {
      const request = await prisma.eventRequest.update({
        where: { id: existing.id },
        data: { status: parsed.data.status },
      });
      return res.json({ eventRequest: request });
    }

    // Eventは会場と開催日時が必須。申請では任意入力のため、欠けていると自動では作れない。
    // ここで弾くと申請がpendingのまま詰まるので、状態だけ承認にして運営に知らせる。
    if (!existing.venue || !existing.startsAt) {
      const request = await prisma.eventRequest.update({
        where: { id: existing.id },
        data: { status: "approved" },
      });
      return res.json({ eventRequest: request, event: null });
    }

    const { request, event } = await prisma.$transaction(async (tx) => {
      // 二人の運営が同時に承認してもイベントが二重に作られないよう、
      // 「まだ承認されていない」ことを条件に状態を先に取りに行く
      const claimed = await tx.eventRequest.updateMany({
        where: { id: existing.id, status: { not: "approved" } },
        data: { status: "approved" },
      });
      if (claimed.count === 0) {
        const current = await tx.eventRequest.findUnique({ where: { id: existing.id } });
        return { request: current, event: null };
      }

      let artistId = existing.artistId;

      // 「その他」で自由入力された場合はアーティストも作る。同名が既にいればそれを使う。
      // 同名が複数いる場合に毎回同じ相手を選ぶよう、古い順で確定させる。
      if (!artistId) {
        const found = await tx.artist.findFirst({
          where: { name: existing.artistName },
          orderBy: { createdAt: "asc" },
        });
        artistId = found
          ? found.id
          : (await tx.artist.create({ data: { name: existing.artistName } })).id;
      }

      const created = await tx.event.create({
        data: {
          artistId,
          title: existing.title,
          venue: existing.venue,
          startsAt: existing.startsAt,
        },
      });

      const updated = await tx.eventRequest.update({
        where: { id: existing.id },
        data: { artistId },
      });

      return { request: updated, event: created };
    });

    res.json({ eventRequest: request, event });
  })
);
