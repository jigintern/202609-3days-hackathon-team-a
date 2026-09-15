export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const Errors = {
  validation: (message) => new ApiError(400, "VALIDATION_ERROR", message),
  unauthorized: (message = "認証が必要です") =>
    new ApiError(401, "UNAUTHORIZED", message),
  profileRequired: () =>
    new ApiError(403, "PROFILE_REQUIRED", "プロフィールが未作成です"),
  forbidden: (message = "権限がありません") =>
    new ApiError(403, "FORBIDDEN", message),
  suspended: () =>
    new ApiError(403, "ACCOUNT_SUSPENDED", "このアカウントは利用停止されています"),
  notFound: (message = "対象が見つかりません") =>
    new ApiError(404, "NOT_FOUND", message),
  conflict: (message) => new ApiError(409, "CONFLICT", message),
  rateLimited: (retryAfter) =>
    new ApiError(
      429,
      "RATE_LIMITED",
      `${retryAfter}秒後に投稿できます`,
      { retryAfter }
    ),
};
