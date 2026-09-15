import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Errors } from "../utils/errors.js";
import { env } from "../lib/env.js";
import { isAllowedImageMime, uploadImage } from "../lib/supabaseStorage.js";

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

    for (const file of files) {
      if (!isAllowedImageMime(file.mimetype)) {
        throw Errors.validation("対応していない画像形式です（jpeg / png / webp のみ）");
      }
    }

    const urls = await Promise.all(
      files.map((file) =>
        uploadImage({ buffer: file.buffer, mimetype: file.mimetype, userId: req.user.id })
      )
    );

    res.status(201).json({ urls });
  })
);
