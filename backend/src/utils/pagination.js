/**
 * カーソル方式のページネーション用ヘルパー。
 *
 * カーソルには配列上の位置ではなく「並び順のキー」を入れる。位置を入れると、
 * ページを取得する合間に投稿が増減したときに境界がずれ、同じ投稿が二度出たり
 * 未読の投稿が飛ばされたりする。
 */
export function encodeCursor(key) {
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

export function decodeCursor(cursor) {
  if (!cursor) return null;

  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
    return typeof parsed?.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function parseLimit(value, { fallback = 20, max = 50 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

/**
 * compareKeys で整列済みの配列から、cursor の次の要素以降を limit 件返す。
 * 位置ではなくキーの比較で境界を決めるため、前回取得時から件数が変わっていてもずれない。
 */
export function paginateByKey(entries, { cursor, limit, compareKeys }) {
  const start = cursor ? entries.findIndex((entry) => compareKeys(entry.key, cursor) > 0) : 0;

  if (start === -1) {
    return { items: [], nextCursor: null };
  }

  const page = entries.slice(start, start + limit);
  const hasMore = entries.length > start + limit;

  return {
    items: page.map((entry) => entry.value),
    nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1].key) : null,
  };
}
