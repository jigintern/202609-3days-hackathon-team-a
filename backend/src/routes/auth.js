import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireProfile } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Errors } from "../utils/errors.js";

export const authRouter = Router();

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(50),
});

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    isSuspended: user.isSuspended,
    createdAt: user.createdAt,
  };
}

authRouter.post(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.issues[0]?.message ?? "入力が不正です");
    }

    const existing = await prisma.user.findUnique({ where: { id: req.auth.id } });
    if (existing) {
      throw Errors.conflict("プロフィールは既に作成されています");
    }

    const user = await prisma.user.create({
      data: {
        id: req.auth.id,
        email: req.auth.email,
        displayName: parsed.data.displayName,
      },
    });

    res.status(201).json({ user: serializeUser(user) });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  requireProfile,
  asyncHandler(async (req, res) => {
    res.json({ user: serializeUser(req.user) });
  })
);

authRouter.patch(
  "/profile",
  requireAuth,
  requireProfile,
  asyncHandler(async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.issues[0]?.message ?? "入力が不正です");
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { displayName: parsed.data.displayName },
    });

    res.json({ user: serializeUser(user) });
  })
);
