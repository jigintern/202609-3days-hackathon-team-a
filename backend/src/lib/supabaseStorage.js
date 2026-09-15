import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);

const EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isAllowedImageMime(mimetype) {
  return mimetype in EXTENSION_BY_MIME;
}

/**
 * 画像バッファをSupabase Storageにアップロードし、公開URLを返す。
 */
export async function uploadImage({ buffer, mimetype, userId }) {
  const ext = EXTENSION_BY_MIME[mimetype];
  const path = `${userId}/${Date.now()}-${randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(env.supabaseStorageBucket)
    .upload(path, buffer, { contentType: mimetype, upsert: false });

  if (error) {
    throw new Error(`画像のアップロードに失敗しました: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(env.supabaseStorageBucket)
    .getPublicUrl(path);

  return data.publicUrl;
}
