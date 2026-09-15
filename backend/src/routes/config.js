import { Router } from "express";
import { env } from "../lib/env.js";
import { ALLOWED_IMAGE_MIME_TYPES } from "../lib/supabaseStorage.js";

export const configRouter = Router();

/**
 * クライアント向けの設定値。SPEC_1.md 4.5 の制限はすべて暫定値で今後調整されるため、
 * フロントに直書きさせず、envを変えれば画面の表示もそのまま追従するようにしている。
 *
 * 秘密情報を含まず、ログイン前の画面でも参照できるよう認証は不要にしている。
 */
configRouter.get("/", (req, res) => {
  res.json({
    post: {
      maxLength: env.postMaxLength,
      cooldownSeconds: env.postCooldownSeconds,
    },
    chat: {
      maxLength: env.chatMaxLength,
      cooldownSeconds: env.chatCooldownSeconds,
      pollIntervalSeconds: env.chatPollIntervalSeconds,
    },
    image: {
      maxCount: env.imageMaxCount,
      maxSizeMb: env.imageMaxSizeMb,
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
    },
  });
});
