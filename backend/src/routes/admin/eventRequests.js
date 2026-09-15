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

    const request = await prisma.eventRequest.update({
      where: { id: req.params.requestId },
      data: { status: parsed.data.status },
    });

    res.json({ eventRequest: request });
  })
);
