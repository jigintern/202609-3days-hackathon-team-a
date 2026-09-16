/**
 * コードレビューで見つかった不具合の回帰テスト。
 *
 * 実行方法:
 *   1. backend/.env を用意する（Supabaseに接続できる状態にしておく）
 *   2. PORT=3999 npm start でAPIサーバーを起動しておく
 *   3. node tests/regression.mjs
 *
 * 使い捨てのユーザー・投稿はテストの最後に削除する。
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const API_BASE = process.env.TEST_API_BASE ?? "http://localhost:3999/api";
const prisma = new PrismaClient();

let failures = 0;
function check(label, ok, extra) {
  if (ok) {
    console.log(`OK   ${label}`);
  } else {
    failures++;
    console.log(`FAIL ${label}`, extra ?? "");
  }
}

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // 204などボディ無し
  }
  return { status: res.status, json };
}

async function createSupabaseUser() {
  const email = `regression-${Date.now()}-${Math.random().toString(36).slice(2)}@gmail.com`;
  const password = "TestPassword123!";

  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const created = await createRes.json();
  if (!createRes.ok) throw new Error(`create user failed: ${JSON.stringify(created)}`);

  const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const tokenBody = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`sign-in failed: ${JSON.stringify(tokenBody)}`);

  return { userId: created.id, token: tokenBody.access_token };
}

async function createAuthedUser(displayName) {
  const user = await createSupabaseUser();
  const profile = await req("/auth/profile", {
    method: "POST",
    token: user.token,
    body: { displayName },
  });
  if (profile.status !== 201) throw new Error(`profile failed: ${JSON.stringify(profile)}`);
  return user;
}

// 1x1の透明PNG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

async function main() {
  const createdUserIds = [];
  const createdPostIds = [];
  const createdArtistIds = [];
  const createdEventIds = [];
  const uploadedPaths = [];

  try {
    const user = await createAuthedUser("回帰テスト");
    createdUserIds.push(user.userId);
    const admin = await createAuthedUser("回帰テスト管理者");
    createdUserIds.push(admin.userId);
    await prisma.user.update({ where: { id: admin.userId }, data: { role: "admin" } });

    const artist = await prisma.artist.findFirst();
    const event = await prisma.event.findFirst({ where: { artistId: artist.id } });
    if (!artist || !event) throw new Error("シードデータが必要です（npm run prisma:seed）");

    console.log("\n--- ホームの全イベント表示・フォロー優先順 ---");
    const homeArtists = [];
    for (const name of ["ホーム回帰フォロー対象", "ホーム回帰フォロー対象外", "ホーム回帰フォローのみ"]) {
      const homeArtist = await prisma.artist.create({ data: { name } });
      createdArtistIds.push(homeArtist.id);
      homeArtists.push(homeArtist);
    }
    // 挿入順と開催順を逆にし、フォロー対象外のイベントをより早く開催する。
    const homeEvents = [];
    const homeNow = Date.now();
    for (const [artistIndex, days] of [[0, 4], [1, 2], [0, 3], [1, 1], [2, 5], [0, -1]]) {
      const homeEvent = await prisma.event.create({
        data: {
          artistId: homeArtists[artistIndex].id,
          title: `ホーム回帰イベント${days}`,
          venue: "回帰テスト会場",
          startsAt: new Date(homeNow + days * 86400000),
        },
      });
      createdEventIds.push(homeEvent.id);
      homeEvents.push(homeEvent);
    }
    const upcomingIds = homeEvents.slice(0, 5).map((e) => e.id);
    const noFollows = await req("/home", { token: user.token });
    const noFollowEvents = noFollows.json?.events ?? [];
    check(
      "フォローがなくても他のアーティストの開催予定イベントがすべて返る",
      noFollows.status === 200 && upcomingIds.every((id) => noFollowEvents.some((e) => e.id === id)),
      noFollows
    );
    check(
      "フォローがない場合は全イベントのisFollowingがfalseで開催日時昇順",
      noFollowEvents.length > 0 && noFollowEvents.every((e, i) =>
        e.artist.isFollowing === false &&
        (i === 0 || Date.parse(noFollowEvents[i - 1].startsAt) <= Date.parse(e.startsAt))
      ),
      noFollowEvents
    );
    check(
      "過去のイベントはホームに表示されない",
      noFollows.status === 200 && !noFollowEvents.some((e) => e.id === homeEvents[5].id),
      noFollowEvents
    );

    await prisma.follow.create({ data: { userId: user.userId, artistId: homeArtists[0].id } });
    await prisma.follow.create({ data: { userId: user.userId, artistId: homeArtists[2].id } });
    await prisma.user.update({ where: { id: user.userId }, data: { oshiArtistId: homeArtists[0].id } });
    const following = await req("/home", { token: user.token });
    const followingEvents = following.json?.events ?? [];
    const fixtureIds = followingEvents.filter((e) => upcomingIds.includes(e.id)).map((e) => e.id);
    check(
      "開催日が遅くてもフォロー中を優先し、各グループ内は開催日時昇順",
      following.status === 200 &&
        fixtureIds.join(",") === [homeEvents[2], homeEvents[0], homeEvents[4], homeEvents[3], homeEvents[1]].map((e) => e.id).join(","),
      fixtureIds
    );
    check(
      "各イベントのisFollowingと既存のisOshiが正しい",
      followingEvents.length > 0 && followingEvents.every((e) =>
        e.artist.isFollowing === (e.artist.id === homeArtists[0].id || e.artist.id === homeArtists[2].id) &&
        e.artist.isOshi === (e.artist.id === homeArtists[0].id)
      ),
      followingEvents
    );
    check(
      "フォロー中でも最推しでないアーティストはisFollowingのみtrue",
      followingEvents.some((e) =>
        e.id === homeEvents[4].id && e.artist.isFollowing === true && e.artist.isOshi === false
      ),
      followingEvents
    );

    console.log("\n--- プロフィール作成の競合（500にならないこと） ---");
    const raw = await createSupabaseUser();
    createdUserIds.push(raw.userId);
    const post = () =>
      req("/auth/profile", { method: "POST", token: raw.token, body: { displayName: "競合" } });
    const raced = (await Promise.all([post(), post(), post()])).map((r) => r.status);
    check(
      "POST /auth/profile を3並列で呼んでも500にならない",
      !raced.includes(500) && raced.includes(201) && raced.includes(409),
      raced
    );

    console.log("\n--- 画像URLの検証 ---");
    const jsScheme = await req(`/events/${event.id}/posts`, {
      method: "POST",
      token: user.token,
      body: { body: "スキーム検証", imageUrls: ["javascript:alert(1)"] },
    });
    check("imageUrlsのjavascript:スキームを400で弾く", jsScheme.status === 400, jsScheme);
    if (jsScheme.json?.post?.id) createdPostIds.push(jsScheme.json.post.id);

    const external = await req(`/events/${event.id}/posts`, {
      method: "POST",
      token: user.token,
      body: { body: "外部URL検証", imageUrls: ["https://example.com/tracking.png"] },
    });
    check("自分のStorage以外の画像URLを400で弾く", external.status === 400, external);
    if (external.json?.post?.id) createdPostIds.push(external.json.post.id);

    console.log("\n--- アップロードの形式判定 ---");
    const fakeForm = new FormData();
    fakeForm.append(
      "images",
      new Blob([Buffer.from("<html><script>alert(1)</script></html>")], { type: "image/png" }),
      "fake.png"
    );
    const fake = await req("/uploads/images", { method: "POST", token: user.token, body: fakeForm });
    check("画像でないファイルをimage/pngと名乗っても400で弾く", fake.status === 400, fake);

    const realForm = new FormData();
    realForm.append("images", new Blob([TINY_PNG], { type: "application/octet-stream" }), "real.png");
    const real = await req("/uploads/images", { method: "POST", token: user.token, body: realForm });
    check(
      "実体がPNGなら名乗るmimetypeに関わらず受け付ける",
      real.status === 201 && real.json?.urls?.length === 1,
      real
    );
    const uploadedUrl = real.json?.urls?.[0];
    if (uploadedUrl) uploadedPaths.push(uploadedUrl);

    check(
      "アップロードしたURLは投稿に紐づけられる",
      Boolean(uploadedUrl),
      uploadedUrl
    );
    const withImage = await req(`/events/${event.id}/posts`, {
      method: "POST",
      token: user.token,
      body: { body: "アップロード画像つき投稿", imageUrls: [uploadedUrl] },
    });
    check("アップロード済みURLなら投稿を作成できる", withImage.status === 201, withImage);
    if (withImage.json?.post?.id) createdPostIds.push(withImage.json.post.id);

    console.log("\n--- ページネーションの安定性 ---");
    // クールダウンを避けるためDBへ直接投入する
    const seeded = [];
    for (let i = 0; i < 5; i++) {
      const p = await prisma.post.create({
        data: {
          eventId: event.id,
          userId: user.userId,
          type: "fan",
          body: `ページング${i}`,
          createdAt: new Date(Date.now() + i * 1000),
        },
      });
      seeded.push(p.id);
      createdPostIds.push(p.id);
    }

    const page1 = await req(`/events/${event.id}/posts?type=fan&sort=latest&limit=2`, {
      token: user.token,
    });
    // ページ取得の合間に新しい投稿が入る状況を作る
    const interrupting = await prisma.post.create({
      data: {
        eventId: event.id,
        userId: user.userId,
        type: "fan",
        body: "割り込み投稿",
        createdAt: new Date(Date.now() + 10000),
      },
    });
    createdPostIds.push(interrupting.id);

    const page2 = await req(
      `/events/${event.id}/posts?type=fan&sort=latest&limit=2&cursor=${page1.json.nextCursor}`,
      { token: user.token }
    );
    const page1Ids = page1.json.posts.map((p) => p.id);
    const page2Ids = page2.json.posts.map((p) => p.id);
    check(
      "ページ取得の合間に投稿が増えても重複しない",
      page1Ids.every((id) => !page2Ids.includes(id)),
      { page1: page1.json.posts.map((p) => p.body), page2: page2.json.posts.map((p) => p.body) }
    );
    check(
      "2ページ目が1ページ目の続きになっている",
      page2.json.posts.map((p) => p.body).join(",") === "ページング2,ページング1",
      page2.json.posts.map((p) => p.body)
    );

    const negative = await req(`/events/${event.id}/posts?type=fan&limit=-5`, { token: user.token });
    check(
      "負のlimitでも件数が返り、カーソルが逆走しない",
      negative.status === 200 && negative.json.posts.length > 0,
      { count: negative.json?.posts?.length, nextCursor: negative.json?.nextCursor }
    );

    console.log("\n--- いいね順のページ送り（順位が動いても飛ばさない） ---");
    // 専用のイベントを作り、A=5,B=4,C=3,D=2,E=1 のいいねを付ける
    const rankEvent = await prisma.event.create({
      data: {
        artistId: artist.id,
        title: "回帰テスト用イベント",
        venue: "V",
        startsAt: new Date(Date.now() + 86400000),
      },
    });
    const likers = [];
    for (let i = 0; i < 12; i++) {
      const liker = await createSupabaseUser();
      createdUserIds.push(liker.userId);
      await prisma.user.create({
        data: { id: liker.userId, email: `liker-${i}-${Date.now()}@example.invalid`, displayName: `L${i}` },
      });
      likers.push(liker);
    }

    const labels = ["A", "B", "C", "D", "E"];
    const rankPosts = [];
    for (let i = 0; i < labels.length; i++) {
      const p = await prisma.post.create({
        data: {
          eventId: rankEvent.id,
          userId: user.userId,
          type: "fan",
          body: `順位${labels[i]}`,
          createdAt: new Date(Date.now() - i * 1000),
        },
      });
      rankPosts.push(p);
      createdPostIds.push(p.id);
      await prisma.reaction.createMany({
        data: likers.slice(0, 5 - i).map((l) => ({ postId: p.id, userId: l.userId })),
      });
    }

    async function walkAllPages(eventId) {
      const seen = [];
      let cursor = null;
      let guard = 0;
      do {
        const query = `type=fan&limit=2${cursor ? `&cursor=${cursor}` : ""}`;
        const page = await req(`/events/${eventId}/posts?${query}`, { token: user.token });
        seen.push(...page.json.posts.map((p) => p.body));
        cursor = page.json.nextCursor;
        // 1ページ目を取り終えた直後に順位を動かす
        if (guard === 0) await onFirstPage();
      } while (cursor && ++guard < 10);
      return seen;
    }

    // ケース1: 下位の投稿にいいねが集中し、カーソルより上位へ移動する
    let onFirstPage = async () => {
      await prisma.reaction.createMany({
        data: likers.slice(1, 11).map((l) => ({ postId: rankPosts[4].id, userId: l.userId })),
      });
    };
    const seenWhenPromoted = await walkAllPages(rankEvent.id);
    check(
      "ページ送り中に順位が上がった投稿も必ず表示される",
      labels.every((l) => seenWhenPromoted.includes(`順位${l}`)),
      { 表示された: seenWhenPromoted }
    );
    check(
      "同じ投稿が重複しない（順位上昇時）",
      new Set(seenWhenPromoted).size === seenWhenPromoted.length,
      seenWhenPromoted
    );

    // ケース2: 上位の投稿からいいねが取り消され、順位が下がる
    await prisma.reaction.deleteMany({ where: { postId: rankPosts[4].id } });
    await prisma.reaction.createMany({
      data: likers.slice(0, 1).map((l) => ({ postId: rankPosts[4].id, userId: l.userId })),
    });
    onFirstPage = async () => {
      await prisma.reaction.deleteMany({ where: { postId: rankPosts[0].id } });
    };
    const seenWhenDemoted = await walkAllPages(rankEvent.id);
    check(
      "ページ送り中に順位が下がっても欠落しない",
      labels.every((l) => seenWhenDemoted.includes(`順位${l}`)),
      { 表示された: seenWhenDemoted }
    );
    // いいねの取り消しは行そのものを消すため、スナップショット時点の集計値も下がる。
    // この場合に限り同じ投稿が二度返ることがある（欠落はしない）。
    // 表示側は投稿idで重複を除くこと。詳細は SPEC_1.md 7章。
    const demotedDuplicates = seenWhenDemoted.length - new Set(seenWhenDemoted).size;
    console.log(
      `     ※ 既知の制限: いいね取り消し時の重複 ${demotedDuplicates} 件（欠落は無し。表示側でid重複除去が必要）`
    );

    await prisma.event.deleteMany({ where: { id: rankEvent.id } });

    console.log("\n--- いいねの取り消し ---");
    const ghost = await req("/posts/00000000-0000-0000-0000-000000000000/reactions", {
      method: "DELETE",
      token: user.token,
    });
    check("存在しない投稿へのいいね取り消しは404", ghost.status === 404, ghost);

    console.log("\n--- 管理APIの入力検証 ---");
    const badStatus = await req("/admin/event-requests?status=bogus", { token: admin.token });
    check("不正なstatusは400（500にしない）", badStatus.status === 400, badStatus);

    const okStatus = await req("/admin/event-requests?status=pending", { token: admin.token });
    check("正しいstatusは今まで通り200", okStatus.status === 200, okStatus);

    const noStatus = await req("/admin/event-requests", { token: admin.token });
    check("status未指定も今まで通り200", noStatus.status === 200, noStatus);

    const badFk = await req(`/admin/events/${event.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { artistId: "00000000-0000-0000-0000-000000000000" },
    });
    check("存在しないartistIdへの更新は400（500にしない）", badFk.status === 400, badFk);

    const badArtistUrl = await req("/admin/artists", {
      method: "POST",
      token: admin.token,
      body: { name: "検証用アーティスト", imageUrl: "javascript:alert(1)" },
    });
    check("アーティスト画像のjavascript:スキームを400で弾く", badArtistUrl.status === 400, badArtistUrl);
    if (badArtistUrl.json?.artist?.id) {
      await prisma.artist.deleteMany({ where: { id: badArtistUrl.json.artist.id } });
    }

    console.log("\n--- 設定値の配信 ---");
    const config = await req("/config");
    check("GET /api/config は認証なしで200", config.status === 200, config);
    check(
      "設定値がすべて数値で返る（NaN由来のnullが混ざらない）",
      [
        config.json?.post?.maxLength,
        config.json?.post?.cooldownSeconds,
        config.json?.chat?.maxLength,
        config.json?.chat?.cooldownSeconds,
        config.json?.chat?.pollIntervalSeconds,
        config.json?.image?.maxCount,
        config.json?.image?.maxSizeMb,
      ].every((v) => typeof v === "number" && Number.isFinite(v)),
      config.json
    );
    check(
      "許可する画像形式が返る",
      Array.isArray(config.json?.image?.allowedMimeTypes) &&
        config.json.image.allowedMimeTypes.includes("image/png"),
      config.json?.image
    );

    console.log(`\n完了: ${failures === 0 ? "全項目パス" : `${failures}件失敗`}`);
  } finally {
    await prisma.post.deleteMany({ where: { id: { in: createdPostIds } } }).catch(() => {});
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } }).catch(() => {});
    await prisma.artist.deleteMany({ where: { id: { in: createdArtistIds } } }).catch(() => {});
    for (const id of createdUserIds) {
      await prisma.reaction.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.chatMessage.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.post.deleteMany({ where: { userId: id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id } }).catch(() => {});
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      }).catch(() => {});
    }
    if (uploadedPaths.length > 0) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "post-images";
      const prefix = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/`;
      await supabase.storage
        .from(bucket)
        .remove(uploadedPaths.map((url) => url.replace(prefix, "")))
        .catch(() => {});
    }
    await prisma.$disconnect();
  }

  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error("テスト実行エラー:", err);
  process.exitCode = 1;
});
