import { verifySupabaseAccessToken } from "../lib/supabaseAuth.js";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Errors } from "../utils/errors.js";

/**
 * Authorization: Bearer <token> を検証し、req.auth = { id, email } を載せる。
 */
export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw Errors.unauthorized();
  }

  try {
    req.auth = await verifySupabaseAccessToken(token);
  } catch {
    throw Errors.unauthorized("トークンが不正、または期限切れです");
  }

  next();
});

/**
 * requireAuthの後段で使う。Userレコードを読み込みreq.userに載せる。
 * プロフィール未作成なら403 PROFILE_REQUIRED、利用停止中なら403 ACCOUNT_SUSPENDEDを返す。
 */
export const requireProfile = asyncHandler(async (req, res, next) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth.id } });

  if (!user) {
    throw Errors.profileRequired();
  }
  if (user.isSuspended) {
    throw Errors.suspended();
  }

  req.user = user;
  next();
});

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    throw Errors.forbidden();
  }
  next();
};
