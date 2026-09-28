import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return value;
}

/**
 * 数値の環境変数を読む。Number() の結果をそのまま使うと、設定ミスがNaNのまま
 * 各所に流れて静かに壊れる（文字数制限が無効になる、/api/config が null を返す等）ため、
 * 変数名つきで起動時に落とす。
 */
function positiveNumber(name, fallback, { integer = false } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || (integer && !Number.isInteger(parsed))) {
    const expected = integer ? "正の整数" : "正の数値";
    throw new Error(`環境変数 ${name} には${expected}を指定してください（現在の値: ${raw}）`);
  }

  return parsed;
}

// 末尾のスラッシュを残すと、Storageの公開URLの前方一致判定が常に外れて
// アップロード済み画像を投稿に添付できなくなる
const supabaseUrl = required("SUPABASE_URL").replace(/\/+$/, "");

export const env = {
  port: positiveNumber("PORT", 3000, { integer: true }),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",

  databaseUrl: required("DATABASE_URL"),
  supabaseUrl,
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "post-images",
  supabaseProfileImagesBucket: process.env.SUPABASE_PROFILE_IMAGES_BUCKET ?? "profile-images",

  postCooldownSeconds: positiveNumber("POST_COOLDOWN_SECONDS", 30),
  chatCooldownSeconds: positiveNumber("CHAT_COOLDOWN_SECONDS", 3),
  chatPollIntervalSeconds: positiveNumber("CHAT_POLL_INTERVAL_SECONDS", 3),
  postMaxLength: positiveNumber("POST_MAX_LENGTH", 280, { integer: true }),
  chatMaxLength: positiveNumber("CHAT_MAX_LENGTH", 500, { integer: true }),
  imageMaxCount: positiveNumber("IMAGE_MAX_COUNT", 4, { integer: true }),
  imageMaxSizeMb: positiveNumber("IMAGE_MAX_SIZE_MB", 5),
};
