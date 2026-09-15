import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Errors } from "../utils/errors.js";

export const eventRequestsRouter = Router();

const createEventRequestSchema = z.object({
  artistName: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(100),
  venue: z.string().trim().max(200).optional(),
  startsAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
});

function serializeEventRequest(request) {
  return {
    id: request.id,
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

    const request = await prisma.eventRequest.create({
      data: { userId: req.user.id, ...parsed.data },
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
