import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * デモ用のアーティストを追加する。
 *
 * 何度実行しても同じ結果になるよう、既に同じ名前のアーティストがいる場合は作らない。
 * 既存データの更新・削除は一切行わない。
 *
 *   node prisma/seedDemoArtists.js
 *
 * nameKanaは検索(絞り込み)で単純な部分一致に使われるため、既存データに合わせて
 * すべてひらがなで登録する。カタカナで入れると「ひらがなで検索すると出てこない」
 * アーティストが混ざることになる。
 *
 * imageUrlはプレースホルダー画像。実在アーティストの写真は権利の都合で使えないため、
 * 見た目の確認用に色付きの画像を入れている。管理画面から差し替えられる。
 */
const DEMO_ARTISTS = [
  { name: "乃木坂46", kana: "のぎざかふぉーてぃーしっくす", label: "Nogizaka46", type: "女性アイドルグループ" },
  { name: "櫻坂46", kana: "さくらざかふぉーてぃーしっくす", label: "Sakurazaka46", type: "女性アイドルグループ" },
  { name: "日向坂46", kana: "ひなたざかふぉーてぃーしっくす", label: "Hinatazaka46", type: "女性アイドルグループ" },
  { name: "AKB48", kana: "えーけーびーふぉーてぃーえいと", label: "AKB48", type: "女性アイドルグループ" },
  { name: "SKE48", kana: "えすけーいーふぉーてぃーえいと", label: "SKE48", type: "女性アイドルグループ" },
  { name: "NMB48", kana: "えぬえむびーふぉーてぃーえいと", label: "NMB48", type: "女性アイドルグループ" },
  { name: "HKT48", kana: "えいちけーてぃーふぉーてぃーえいと", label: "HKT48", type: "女性アイドルグループ" },
  { name: "STU48", kana: "えすてぃーゆーふぉーてぃーえいと", label: "STU48", type: "女性アイドルグループ" },
  { name: "=LOVE", kana: "いこーるらぶ", label: "EQUAL LOVE", type: "女性アイドルグループ" },
  { name: "≠ME", kana: "のっといこーるみー", label: "NOT EQUAL ME", type: "女性アイドルグループ" },
  { name: "ももいろクローバーZ", kana: "ももいろくろーばーぜっと", label: "Momoclo", type: "女性アイドルグループ" },
  { name: "私立恵比寿中学", kana: "しりつえびすちゅうがく", label: "Ebichu", type: "女性アイドルグループ" },
  { name: "でんぱ組.inc", kana: "でんぱぐみいんく", label: "Dempagumi", type: "女性アイドルグループ" },
  { name: "BABYMETAL", kana: "べびーめたる", label: "BABYMETAL", type: "音楽ユニット" },
  { name: "Perfume", kana: "ぱふゅーむ", label: "Perfume", type: "テクノポップユニット" },
  { name: "Snow Man", kana: "すのーまん", label: "Snow Man", type: "男性アイドルグループ" },
  { name: "SixTONES", kana: "すとーんず", label: "SixTONES", type: "男性アイドルグループ" },
  { name: "なにわ男子", kana: "なにわだんし", label: "Naniwa Danshi", type: "男性アイドルグループ" },
  { name: "King & Prince", kana: "きんぐあんどぷりんす", label: "King and Prince", type: "男性アイドルグループ" },
  { name: "Hey! Say! JUMP", kana: "へいせいじゃんぷ", label: "Hey Say JUMP", type: "男性アイドルグループ" },
  { name: "SUPER EIGHT", kana: "すーぱーえいと", label: "SUPER EIGHT", type: "男性アイドルグループ" },
  { name: "JO1", kana: "じぇいおーわん", label: "JO1", type: "男性アイドルグループ" },
  { name: "INI", kana: "あいえぬあい", label: "INI", type: "男性アイドルグループ" },
  { name: "BE:FIRST", kana: "びーふぁーすと", label: "BE FIRST", type: "ダンス&ボーカルグループ" },
  { name: "NiziU", kana: "にじゅー", label: "NiziU", type: "女性ダンス&ボーカルグループ" },
];

function placeholderImageUrl(label) {
  return `https://placehold.co/400x400/e2001a/ffffff?text=${encodeURIComponent(label)}`;
}

async function main() {
  const existing = await prisma.artist.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((artist) => artist.name));

  const toCreate = DEMO_ARTISTS.filter((artist) => !existingNames.has(artist.name));

  if (toCreate.length === 0) {
    console.log("追加するアーティストはありません(すべて登録済み)");
    return;
  }

  await prisma.artist.createMany({
    data: toCreate.map((artist) => ({
      name: artist.name,
      nameKana: artist.kana,
      description: `${artist.type}。デモ用のサンプルデータです。`,
      imageUrl: placeholderImageUrl(artist.label),
    })),
  });

  console.log(`${toCreate.length}件を追加しました`);
  toCreate.forEach((artist) => console.log(`  + ${artist.name}`));

  const skipped = DEMO_ARTISTS.length - toCreate.length;
  if (skipped > 0) console.log(`${skipped}件は登録済みのため飛ばしました`);

  console.log(`合計 ${await prisma.artist.count()} 件のアーティストが登録されています`);
}

main()
  .catch((err) => {
    console.error("追加に失敗しました:", err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
