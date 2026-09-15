import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",

  databaseUrl: required("DATABASE_URL"),
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "post-images",

  postCooldownSeconds: Number(process.env.POST_COOLDOWN_SECONDS ?? 30),
  chatCooldownSeconds: Number(process.env.CHAT_COOLDOWN_SECONDS ?? 3),
  postMaxLength: Number(process.env.POST_MAX_LENGTH ?? 280),
  chatMaxLength: Number(process.env.CHAT_MAX_LENGTH ?? 500),
  imageMaxCount: Number(process.env.IMAGE_MAX_COUNT ?? 4),
  imageMaxSizeMb: Number(process.env.IMAGE_MAX_SIZE_MB ?? 5),
};
