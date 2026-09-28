import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Errors } from "../utils/errors.js";
import { env } from "../lib/env.js";
import { detectImageMime, uploadImage } from "../lib/supabaseStorage.js";

export const uploadsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.imageMaxSizeMb * 1024 * 1024, files: env.imageMaxCount },
});

uploadsRouter.post(
  "/images",
  upload.array("images", env.imageMaxCount),
  asyncHandler(async (req, res) => {
    const files = req.files ?? [];
    if (files.length === 0) {
      throw Errors.validation("画像が指定されていません");
    }

    // クライアントが名乗るmimetypeではなく、実際のバイト列で判定する
    const detected = files.map((file) => detectImageMime(file.buffer));
    if (detected.some((mimetype) => mimetype === null)) {
      throw Errors.validation("対応していない画像形式です（jpeg / png / webp のみ）");
    }

    const urls = await Promise.all(
      files.map((file, index) =>
        uploadImage({ buffer: file.buffer, mimetype: detected[index], userId: req.user.id })
      )
    );

    res.status(201).json({ urls });
  })
);
