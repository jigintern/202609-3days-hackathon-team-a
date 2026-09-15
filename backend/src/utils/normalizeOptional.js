/**
 * 管理画面のフォームは「値を消す」を空文字で表現する。
 * そのまま保存すると未設定（null）と区別が付かなくなるため、nullに寄せる。
 */
export function normalizeOptional(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, value === "" ? null : value])
  );
}
