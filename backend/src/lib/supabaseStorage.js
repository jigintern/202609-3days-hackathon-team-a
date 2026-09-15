import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey);

const EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * 実際のバイト列から画像形式を判定する。multipartのContent-Typeはクライアントが
 * 自由に名乗れる値なので、それを信用すると画像以外を保存できてしまう。
 */
export function detectImageMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

const publicUrlPrefix = `${env.supabaseUrl}/storage/v1/object/public/${env.supabaseStorageBucket}/`;

/**
 * 投稿に紐づけてよい画像URLか。自分のStorageに保存したものだけを許可する。
 * これが無いと javascript: スキームや外部のトラッキング画像を投稿に埋め込める。
 */
export function isUploadedImageUrl(value) {
  return typeof value === "string" && value.startsWith(publicUrlPrefix);
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
