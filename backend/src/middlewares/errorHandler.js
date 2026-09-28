import { ApiError } from "../utils/errors.js";

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "対象が見つかりません" },
  });
}

export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...err.extra },
    });
    return;
  }

  if (err.name === "MulterError") {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: err.message },
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" },
  });
}
