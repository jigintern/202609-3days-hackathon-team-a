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

    // 存在確認してから作成すると二重送信で競合する（React StrictModeの二重実行でも踏む）。
    // 一意制約違反を409に読み替えることで、競合しても正しいステータスを返す。
    let user;
    try {
      user = await prisma.user.create({
        data: {
          id: req.auth.id,
          email: req.auth.email,
          displayName: parsed.data.displayName,
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        throw Errors.conflict("プロフィールは既に作成されています");
      }
      throw err;
    }

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
