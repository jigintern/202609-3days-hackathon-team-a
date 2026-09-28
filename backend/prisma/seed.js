import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function main() {
  const artistA = await prisma.artist.create({
    data: {
      name: "サンプルアイドルA",
      nameKana: "さんぷるあいどるA",
      description: "シードデータのアーティストです。",
      imageUrl: null,
    },
  });

  const artistB = await prisma.artist.create({
    data: {
      name: "サンプルアイドルB",
      nameKana: "さんぷるあいどるB",
      description: "シードデータのアーティストです。",
      imageUrl: null,
    },
  });

  await prisma.event.createMany({
    data: [
      {
        artistId: artistA.id,
        title: "サンプルツアー 東京公演",
        venue: "東京ドーム",
        prefecture: "東京都",
        startsAt: daysFromNow(14),
      },
      {
        artistId: artistA.id,
        title: "サンプルツアー 大阪公演",
        venue: "大阪城ホール",
        prefecture: "大阪府",
        startsAt: daysFromNow(21),
      },
      {
        artistId: artistA.id,
        title: "サンプルツアー 福岡公演（終了）",
        venue: "福岡国際センター",
        prefecture: "福岡県",
        startsAt: daysFromNow(-30),
      },
      {
        artistId: artistB.id,
        title: "サンプルワンマンライブ",
        venue: "Zepp Tokyo",
        prefecture: "東京都",
        startsAt: daysFromNow(7),
      },
    ],
  });

  console.log("シードデータを投入しました。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
