import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Errors } from "../../utils/errors.js";

export const adminUsersRouter = Router();

const updateUserSchema = z.object({
  isSuspended: z.boolean(),
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

adminUsersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ users: users.map(serializeUser) });
  })
);

adminUsersRouter.patch(
  "/:userId",
  asyncHandler(async (req, res) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw Errors.validation(parsed.error.issues[0]?.message ?? "入力が不正です");
    }

    const existing = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!existing) throw Errors.notFound("ユーザーが見つかりません");

    const user = await prisma.user.update({
      where: { id: req.params.userId },
      data: { isSuspended: parsed.data.isSuspended },
    });

    res.json({ user: serializeUser(user) });
  })
);
