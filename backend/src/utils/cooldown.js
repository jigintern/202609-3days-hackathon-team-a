import { Errors } from "./errors.js";

/**
 * 直近の投稿/発言時刻からクールダウン秒数が経過しているか確認する。
 * 経過していなければ429を投げる。
 */
export function assertCooldownElapsed(lastCreatedAt, cooldownSeconds) {
  if (!lastCreatedAt) return;

  const elapsedMs = Date.now() - lastCreatedAt.getTime();
  const remainingMs = cooldownSeconds * 1000 - elapsedMs;

  if (remainingMs > 0) {
    throw Errors.rateLimited(Math.ceil(remainingMs / 1000));
  }
}
