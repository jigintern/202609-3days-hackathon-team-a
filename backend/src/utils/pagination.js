/**
 * カーソル方式のページネーション用ヘルパー。
 * カーソルは配列上のオフセットをbase64エンコードしたもの。
 */
export function decodeCursor(cursor) {
  if (!cursor) return 0;
  try {
    const offset = Number(Buffer.from(String(cursor), "base64url").toString("utf8"));
    return Number.isFinite(offset) && offset >= 0 ? offset : 0;
  } catch {
    return 0;
  }
}

export function encodeCursor(offset) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

export function paginateArray(items, cursor, limit) {
  const offset = decodeCursor(cursor);
  const page = items.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  const nextCursor = nextOffset < items.length ? encodeCursor(nextOffset) : null;
  return { items: page, nextCursor };
}
