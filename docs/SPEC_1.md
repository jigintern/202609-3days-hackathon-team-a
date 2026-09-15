# 推し活アプリ MVP 仕様書

- プロジェクト名: 未定（本書では `[プロジェクト名]` と表記）
- 最終更新: 2026-09-15（認証をSupabase Authに変更）
- 出典: Slackでのブレスト（2026-09-14）および以降の検討

---

## 1. プロダクト概要

### バリュープロポジション

> 詳細なイベントの情報を望んでいる、イベントに参加するファンにとって、[プロジェクト名]は、SNSに属しており、簡単に関係する情報を閲覧でき、Xと違って、我々のプロジェクトは、関連した情報のみを表示する。

### ターゲット

- 推される対象: 国内アイドル
- 推す側: 国内アイドルが好きな人（性別・年齢問わず）

### 解決したい課題

| 区分 | 内容 | MVPで扱うか |
| --- | --- | --- |
| 情報 | ライブの詳細をSNS頼りで探している。告知方法が運営ごとにバラバラ | 扱う（メイン機能） |
| 手間 | 応募のたびに再ログイン・クレジットカード入力を求められる | 扱う（サブ機能） |
| 出費 | 抽選という不確定要素の中で出費の管理が難しい | 扱わない |
| 遠征 | 遠征先の情報や注意点がわからない | 扱わない |

---

## 2. 技術スタックとリポジトリ構成

### スタック

| レイヤ | 採用 |
| --- | --- |
| フロントエンド | React（JavaScript / Vite） |
| バックエンド | Express + Prisma |
| データベース | Supabase（PostgreSQL） |
| 認証 | Supabase Auth |
| ファイル保存 | Supabase Storage |
| API形式 | REST（JSON） |

### ディレクトリ構成

npm workspaces によるmonorepo構成とする。

```
oshikatsu-app/
├── package.json              # workspaces 定義
├── docs/
│   └── SPEC.md               # 本書
├── apps/
│   ├── web/                  # React（Vite）
│   │   ├── src/
│   │   │   ├── pages/        # 画面単位のコンポーネント
│   │   │   ├── components/   # 共通UI
│   │   │   ├── api/          # fetchラッパ、エンドポイント定義
│   │   │   ├── hooks/
│   │   │   ├── lib/supabase.js  # Supabaseクライアント（認証のみに使う）
│   │   │   └── vault/        # パスワード管理（暗号化・IndexedDB）
│   │   └── vite.config.js
│   └── api/                  # Express
│       ├── src/
│       │   ├── index.js      # エントリポイント
│       │   ├── routes/       # ルーティング
│       │   ├── middlewares/  # 認証・エラーハンドリング
│       │   └── lib/
│       │       ├── prisma.js
│       │       └── verifyToken.js  # Supabase JWT の検証
│       └── prisma/
│           └── schema.prisma
└── packages/
    └── shared/               # 定数・バリデーション規則の共有（任意）
```

ルートの `package.json` は次のようにする。

```json
{
  "private": true,
  "workspaces": ["apps/*", "packages/*"]
}
```

### 環境変数

| 変数名 | 置き場所 | 用途 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | apps/web | SupabaseプロジェクトのURL |
| `VITE_SUPABASE_ANON_KEY` | apps/web | 認証用の公開キー |
| `DATABASE_URL` | apps/api | PrismaからSupabaseのPostgresへ接続する文字列 |
| `SUPABASE_URL` | apps/api | JWKSの取得、Storageへのアップロードに使う |
| `SUPABASE_SERVICE_ROLE_KEY` | apps/api | Storageへのアップロードに使う。**フロントには絶対に置かない** |

### 認証方式

認証にはSupabase Authを使う。フロントは `@supabase/supabase-js` でサインアップ・ログインを行い、Supabaseが発行したアクセストークン（JWT）を `Authorization: Bearer <token>` としてExpressに送る。Expressはそのトークンを検証してユーザーを特定する。

- パスワードのハッシュ化、セッション管理、トークンの更新、パスワードリセットはSupabase側が持つ。自前で `bcrypt` を扱わない
- **フロントからSupabaseのテーブルを直接読み書きしない。** Supabaseは認証とファイル保存にのみ使い、データの読み書きは必ずExpress経由とする
- 開発中はメール確認を無効にしておく（Supabaseのダッシュボードで設定）。有効なままだと確認メールを踏むまでログインできず、開発が止まる

**トークンの検証**

SupabaseのJWKSエンドポイント `https://<project-id>.supabase.co/auth/v1/.well-known/jwks.json` から公開鍵を取得し、`jose` などのライブラリで検証する。これがSupabaseの推奨方式。共有シークレット（HS256）を使う古い方式もあるが、公式には非推奨とされている。

検証に成功したら、JWTの `sub` クレームがユーザーID、`email` がメールアドレスになる。これを認証ミドルウェアで `req.user` に載せる。

**アプリ側のユーザー情報**

表示名・権限（一般／運営）・利用停止フラグはSupabase Authが持たないため、Prisma側に `User` テーブルを持つ。このテーブルの `id` にはSupabase Authのユーザーid（JWTの `sub`）をそのまま入れて1対1で対応させる。パスワードは保存しない。

登録の流れは次のとおり。

1. フロントで `supabase.auth.signUp({ email, password })` を実行し、セッションを得る
2. そのトークンを付けて `POST /api/auth/profile` を呼び、表示名を登録する（Express側で `User` レコードを作成）
3. 以降は通常のリクエストと同じ

手順1と2の間で離脱すると「認証は通っているがプロフィールが無い」状態になり得る。認証ミドルウェアは `User` レコードが見つからない場合に `403` と `{ code: "PROFILE_REQUIRED" }` を返し、フロントはそれを受けたら表示名の入力画面へ誘導する。

---

## 3. ドメインモデル

### 主要な概念

| 概念 | 説明 |
| --- | --- |
| Artist | アーティスト（グループまたは個人） |
| Event | **公演単位**。「◯◯ツアー 東京公演」と「◯◯ツアー 大阪公演」は別のEventとして扱う |
| Post | イベントに紐づく投稿。公式（運営）とファン（一般ユーザー）の2種類 |
| ChatMessage | イベントに紐づくチャットの発言。1イベントにつき1部屋 |
| Reaction | 投稿への「いいね」。1種類のみ |
| EventRequest | ユーザーからのイベント追加申請 |

### Post と ChatMessage の役割分担

投稿には返信機能を持たせず、フラットな一覧として表示する。会話はチャットタブが担う。

- **Post（ユーザータブ）**: 残しておきたい情報。「物販は東ゲート、11時で30分待ち」など。リアクションが付き、リアクション数順で並ぶので、有用な情報が上に来る
- **ChatMessage（チャットタブ）**: その場の会話。時系列で流れる。流れて構わない内容

この分担により、返信ツリーを実装せずに会話ニーズを満たす。

---

## 4. 機能仕様

### 4.1 認証

Supabase Authを利用する。認証そのものの処理はフロント側の `supabase-js` が担い、Expressはトークンの検証とプロフィールの管理を行う。

**新規登録**
- 入力: メールアドレス、パスワード、表示名
- `supabase.auth.signUp` を実行したのち、`POST /api/auth/profile` で表示名を登録する
- メールアドレスの重複チェックとパスワードの強度チェックはSupabase側に任せる
- メール確認はMVPでは行わない

**ログイン**
- 入力: メールアドレス、パスワード
- `supabase.auth.signInWithPassword` を使う。セッションの保持とトークンの更新は `supabase-js` が自動で行う

**ログアウト**
- `supabase.auth.signOut` を呼ぶ

**パスワードリセット**
- Supabase Authの機能をそのまま使えるため、実装コストが低い。`supabase.auth.resetPasswordForEmail` とリセット用の画面を2枚追加すれば済むので、MVPに含めてよい（任意）

投稿は記名制とする。表示名は登録時のユーザー名を用いる。

### 4.2 ホーム

フォロー中のアーティストの、これから開催されるイベントを開催日が近い順に表示する。

- 未ログイン時はログイン画面へリダイレクト
- フォローが0件のときは、アーティスト一覧への導線を表示する

### 4.3 アーティスト

**アーティスト一覧**
- 登録されている全アーティストを表示
- 各行にフォローボタンを置く

**アーティスト詳細**
- プロフィール（名前、説明、画像）
- そのアーティストのイベント一覧（開催予定を上、過去のものを下）
- フォロー／フォロー解除

### 4.4 イベント詳細

MVPの中心となる画面。イベント情報の表示と、3つのタブで構成する。

**イベント情報（タブの上に常に表示）**
- タイトル、アーティスト名、開催日時、会場

**タブ1: 公式アカウント**
- 運営が管理画面から入稿した情報を表示
- 並び順は新着順（固定）
- 一般ユーザーは投稿できない

**タブ2: ユーザー**
- ログインユーザーの投稿を表示
- 並び順はリアクション数の多い順（デフォルト）／最新順（切替可能）
- 返信はできない
- リアクションは「いいね」1種類のみ。1ユーザーにつき1投稿1回、押し直しで取り消し可能
- 自分の投稿は削除できる

**タブ3: チャット**
- 1イベントにつき1部屋。参加者が時系列で発言する
- LINEのオープンチャットに近い形式
- 新着は数秒おきのポーリングで取得する（WebSocketはMVPでは使わない）
- 自分の発言は削除できる

### 4.5 投稿とチャットの制限

連投防止のため、投稿とチャットの両方にクールダウンを設ける。サーバー側で直近の投稿時刻を確認し、規定秒数を経過していない場合は `429` を返す。フロントは残り秒数を表示して送信ボタンを無効化する。

| 項目 | 暫定値 | 備考 |
| --- | --- | --- |
| 投稿のクールダウン | 30秒 | 未決。運用しながら調整 |
| チャットのクールダウン | 3秒 | 未決。会話を妨げない程度に |
| 投稿の最大文字数 | 280文字 | 未決。Xと同等を想定 |
| チャットの最大文字数 | 500文字 | 未決 |
| 画像の形式 | jpeg / png / webp | 未決 |
| 画像の枚数 | 1投稿あたり最大4枚 | 未決 |
| 画像1枚のサイズ上限 | 5MB | 未決 |
| チャットのポーリング間隔 | 3秒 | 未決 |

画像の保存先にはSupabase Storageを使う。フロントから直接アップロードせず、APIを経由して保存し、返ってきたURLを投稿に紐づける。チャットへの画像添付はMVPでは行わない（テキストのみ）。

### 4.6 イベント追加申請

イベントの登録は運営が管理画面から行う。ユーザーが追加してほしいイベントがある場合は、申請フォームから運営に依頼する。

- ユーザーは、アーティスト名・イベント名・開催日・会場・備考を入力して申請する
- 申請は管理画面の一覧に溜まり、運営が内容を確認してイベントとして登録する
- 申請の状態は `pending` / `approved` / `rejected` の3つ
- 申請結果の通知機能はMVPでは実装しない（通知一覧がスコープ外のため）

将来的にはイベント情報をAIで自動収集することを想定しているが、MVPでは行わない。

### 4.7 パスワード管理（サブ機能）

推し活に使うサイトの認証情報を保管する。サイトによって必要な項目が異なるため、認証情報の種別を選べるようにする。

- 保存項目: サイト名、認証情報の種別（会員番号／メールアドレス／電話番号）、その値、パスワード
- 一覧に入る前にマスターパスワードによる再認証を挟む。ログイン中であっても必須とする
- パスワードは一覧・詳細ではマスク表示とし、コピーボタンで取り出す

**保管方式は案Bに決定（2026-09-15）。** API仕様と暗号仕様は [VAULT_API.md](./VAULT_API.md) を参照。

案Aでも暗号化の実装は同じく必要であり、案Bとの差は「暗号文の置き場所がIndexedDBかAPIか」だけである。サーバーには暗号文しか渡らないため案Aと安全性はほぼ同等のまま、端末間同期とブラウザのデータ削除への耐性が得られるため案Bを採った。

以下、検討時の2案を記録として残す。

**案A: ローカル保存（検討したが不採用）**

> この案は採用していない。実装するのは案Bであり、実装内容は [VAULT_API.md](./VAULT_API.md) に従うこと。

認証情報は端末から出さない。ブラウザのIndexedDBに暗号化して保存する。

- マスターパスワードをPBKDF2（またはArgon2）で鍵導出し、AES-GCMで暗号化する。WebCryptoのSubtleCryptoで実装できる
- 暗号鍵は保存せず、アンロック中のみメモリに持つ
- サーバーには一切送らないため、**APIエンドポイントもDBテーブルも不要**

利点は、サーバーが破られても漏れるものが無いこと。実在するチケットサイトの認証情報を扱う以上、この責任を負わない設計は大きい。

欠点は、端末間で同期できないこと、ブラウザのサイトデータ削除で消えること、マスターパスワードを忘れると復旧できないこと。そのため暗号化ファイルとしてエクスポートする機能を用意し、登録画面で「この端末にのみ保存される」「忘れると復旧できない」旨を明示する。

**案B: サーバー保存（クライアント暗号化）← 採用**

暗号化はクライアントで行い、暗号化済みのデータのみをサーバーに保存する。同期でき、データも消えない。サーバーは復号鍵を持たないため、漏えいしても内容は読めない。実装は一段複雑になる。

いずれの案でも、**デモの段階では実在のアカウント情報を入力させず、ダミーデータで見せる運用とする。**

### 4.8 管理画面

運営（`role = admin`）のみアクセスできる。

- ユーザー一覧: 登録ユーザーの確認、利用停止
- ポスト管理: 投稿およびチャットメッセージの確認と削除
- アーティスト管理: 登録・編集
- イベント管理: 登録・編集
- 公式情報の入稿: イベントに紐づく公式投稿の作成
- イベント追加申請の一覧: 申請の確認と、承認／却下

---

## 5. 画面一覧とルーティング

| パス | 画面 | 認証 |
| --- | --- | --- |
| `/login` | ログイン | 不要 |
| `/register` | 新規登録 | 不要 |
| `/register/profile` | 表示名の登録（signUp直後） | 必要 |
| `/password/reset` | パスワードリセット申請（任意） | 不要 |
| `/password/update` | 新しいパスワードの設定（任意） | 不要 |
| `/` | ホーム（フォロー中のイベント） | 必要 |
| `/artists` | アーティスト一覧 | 必要 |
| `/artists/:artistId` | アーティスト詳細 | 必要 |
| `/events/:eventId` | イベント詳細（3タブ） | 必要 |
| `/events/:eventId/posts/new` | 投稿作成 | 必要 |
| `/event-requests/new` | イベント追加申請 | 必要 |
| `/vault/unlock` | マスターパスワード入力 | 必要 |
| `/vault` | パスワード一覧 | 必要 |
| `/vault/new`, `/vault/:id/edit` | パスワード登録・編集 | 必要 |
| `/admin/users` | ユーザー一覧 | admin |
| `/admin/posts` | ポスト管理 | admin |
| `/admin/artists` | アーティスト管理 | admin |
| `/admin/events` | イベント管理 | admin |
| `/admin/event-requests` | イベント追加申請の一覧 | admin |

投稿作成はモーダルで実装してもよい。その場合は上記のパスを設けなくてよい。

---

## 6. データベース設計

Prismaのスキーマとして記述する。パスワード管理は案Bを採ったため `VaultProfile` / `VaultEntry` を持つ（4.7および [VAULT_API.md](./VAULT_API.md) を参照）。

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  user
  admin
}

enum PostType {
  official
  fan
}

enum RequestStatus {
  pending
  approved
  rejected
}

/// Supabase Auth のユーザーと1対1。id には auth 側のユーザーid（JWTの sub）をそのまま入れる。
/// パスワードは Supabase Auth が持つため、ここには保存しない。
model User {
  id           String        @id
  email        String        @unique
  displayName  String
  role         Role          @default(user)
  isSuspended  Boolean       @default(false)
  createdAt    DateTime      @default(now())

  follows      Follow[]
  posts        Post[]
  reactions    Reaction[]
  messages     ChatMessage[]
  eventRequests EventRequest[]
}

model Artist {
  id          String   @id @default(uuid())
  name        String
  nameKana    String?
  description String?
  imageUrl    String?
  createdAt   DateTime @default(now())

  events      Event[]
  follows     Follow[]
}

model Follow {
  userId    String
  artistId  String
  createdAt DateTime @default(now())

  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  artist    Artist @relation(fields: [artistId], references: [id], onDelete: Cascade)

  @@id([userId, artistId])
}

/// 公演単位。同一ツアーの各公演は別レコードとして扱う
model Event {
  id         String   @id @default(uuid())
  artistId   String
  title      String
  venue      String
  prefecture String?
  startsAt   DateTime
  createdAt  DateTime @default(now())

  artist     Artist        @relation(fields: [artistId], references: [id], onDelete: Cascade)
  posts      Post[]
  messages   ChatMessage[]

  @@index([artistId, startsAt])
}

model Post {
  id        String    @id @default(uuid())
  eventId   String
  userId    String
  type      PostType  @default(fan)
  body      String
  createdAt DateTime  @default(now())
  deletedAt DateTime?

  event     Event       @relation(fields: [eventId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id])
  images    PostImage[]
  reactions Reaction[]

  @@index([eventId, type, createdAt])
}

model PostImage {
  id       String @id @default(uuid())
  postId   String
  url      String
  position Int    @default(0)

  post     Post   @relation(fields: [postId], references: [id], onDelete: Cascade)
}

/// いいね。1ユーザーにつき1投稿1件
model Reaction {
  postId    String
  userId    String
  createdAt DateTime @default(now())

  post      Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([postId, userId])
}

model ChatMessage {
  id        String    @id @default(uuid())
  eventId   String
  userId    String
  body      String
  createdAt DateTime  @default(now())
  deletedAt DateTime?

  event     Event @relation(fields: [eventId], references: [id], onDelete: Cascade)
  user      User  @relation(fields: [userId], references: [id])

  @@index([eventId, createdAt])
}

model EventRequest {
  id         String        @id @default(uuid())
  userId     String
  artistName String
  title      String
  venue      String?
  startsAt   DateTime?
  note       String?
  status     RequestStatus @default(pending)
  createdAt  DateTime      @default(now())

  user       User @relation(fields: [userId], references: [id])

  @@index([status, createdAt])
}
```

### 補足

- `User.id` は `uuid()` で自動生成しない。Supabase Authが払い出したidを入れる
- `User.email` はSupabase Authからのコピー。管理画面での表示・検索のために持つ
- 投稿とチャットは論理削除とする。`deletedAt` が入っているものは一覧から除外する
- リアクション数はMVPでは都度カウントする。件数が増えて重くなったら `Post` に集計カラムを持たせる
- 削除された投稿の抜け殻表示は不要（返信構造が無いため）
- Prismaは接続文字列で直接Postgresに繋ぐため、SupabaseのRLSは適用されない。権限チェックはExpress側のミドルウェアで行う

---

## 7. API仕様

### 共通事項

- ベースパス: `/api`
- 認証が必要なエンドポイントは `Authorization: Bearer <Supabaseのアクセストークン>` を要求する
- リクエスト・レスポンスともJSON
- 一覧系のページネーションはカーソル方式とする。レスポンスに `nextCursor` を含め、次の取得時に `cursor` として渡す

エラーレスポンスは次の形式で統一する。

```json
{ "error": { "code": "RATE_LIMITED", "message": "30秒後に投稿できます", "retryAfter": 30 } }
```

| ステータス | 用途 |
| --- | --- |
| 400 | バリデーションエラー |
| 401 | 未認証、トークン不正・期限切れ |
| 403 | 権限不足（admin専用への一般アクセス）、プロフィール未作成（`PROFILE_REQUIRED`） |
| 404 | 対象が存在しない |
| 409 | 重複（メールアドレスなど） |
| 429 | クールダウン中 |

### 認証・プロフィール

サインアップとログインはフロントがSupabaseに対して直接行うため、Express側にエンドポイントは無い。

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| POST | `/api/auth/profile` | 必要 | 初回のプロフィール作成。`{ displayName }` を受け取り、トークンの `sub` と `email` から `User` を作成して `{ user }` を返す。既に存在する場合は409 |
| GET | `/api/auth/me` | 必要 | ログイン中のユーザー情報を返す。プロフィール未作成なら403（`PROFILE_REQUIRED`） |
| PATCH | `/api/auth/profile` | 必要 | 表示名の変更（任意） |

### アーティスト

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/api/artists` | 必要 | アーティスト一覧。各件に `isFollowing` を含める |
| GET | `/api/artists/:artistId` | 必要 | アーティスト詳細 |
| GET | `/api/artists/:artistId/events` | 必要 | そのアーティストのイベント一覧。`?scope=upcoming\|past` |
| POST | `/api/artists/:artistId/follow` | 必要 | フォローする |
| DELETE | `/api/artists/:artistId/follow` | 必要 | フォローを外す |

### イベント

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/api/home` | 必要 | フォロー中アーティストの開催予定イベントを開催日昇順で返す |
| GET | `/api/events/:eventId` | 必要 | イベント詳細（タイトル、会場、日時、アーティスト） |

### 投稿

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/api/events/:eventId/posts` | 必要 | 投稿一覧。`?type=official\|fan`、`?sort=reactions\|latest`、`?cursor=`。各件に `reactionCount` と `reactedByMe` を含める |
| POST | `/api/events/:eventId/posts` | 必要 | 投稿を作成。`{ body, imageUrls? }`。クールダウン中は429 |
| DELETE | `/api/posts/:postId` | 必要 | 自分の投稿を削除（論理削除） |
| POST | `/api/posts/:postId/reactions` | 必要 | いいねを付ける |
| DELETE | `/api/posts/:postId/reactions` | 必要 | いいねを外す |
| POST | `/api/uploads/images` | 必要 | 画像をSupabase Storageへ保存し、URLを返す |

`type=official` の一覧は `sort` を受け付けず、常に新着順で返す。

### チャット

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/api/events/:eventId/messages` | 必要 | 発言一覧。初回は最新N件、以降は `?after=<messageId>` で差分のみを取得する（ポーリング用） |
| POST | `/api/events/:eventId/messages` | 必要 | 発言を作成。`{ body }`。クールダウン中は429 |
| DELETE | `/api/messages/:messageId` | 必要 | 自分の発言を削除（論理削除） |

### イベント追加申請

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| POST | `/api/event-requests` | 必要 | 申請を作成。`{ artistName, title, venue?, startsAt?, note? }` |
| GET | `/api/event-requests/mine` | 必要 | 自分の申請一覧と状態 |

### パスワード管理（Vault）

リクエスト・レスポンスの詳細と暗号仕様は [VAULT_API.md](./VAULT_API.md) を参照。サーバーは暗号文のみを保持し、中身を読めない。

| メソッド | パス | 認証 | 説明 |
| --- | --- | --- | --- |
| GET | `/api/vault/profile` | 必要 | 鍵導出パラメータとverifierを取得。未設定なら404 |
| POST | `/api/vault/profile` | 必要 | 初回セットアップ。既に存在する場合は409 |
| GET | `/api/vault/entries` | 必要 | 保管項目を全件取得（暗号文のまま） |
| POST | `/api/vault/entries` | 必要 | 項目を追加。`{ iv, cipherText }` |
| PATCH | `/api/vault/entries/:entryId` | 必要 | 項目を更新（新しいIVで暗号化し直す） |
| DELETE | `/api/vault/entries/:entryId` | 必要 | 項目を削除 |
| DELETE | `/api/vault` | 必要 | 保管庫ごと削除。マスターパスワードを忘れた場合の作り直し用 |

### 管理（すべて admin 限定）

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/api/admin/users` | ユーザー一覧 |
| PATCH | `/api/admin/users/:userId` | 利用停止・解除（`{ isSuspended }`） |
| GET | `/api/admin/posts` | 投稿一覧（イベント横断） |
| DELETE | `/api/admin/posts/:postId` | 投稿を削除 |
| GET | `/api/admin/messages` | チャット発言一覧（イベント横断） |
| DELETE | `/api/admin/messages/:messageId` | 発言を削除 |
| POST | `/api/admin/artists` | アーティストを登録 |
| PATCH | `/api/admin/artists/:artistId` | アーティストを編集 |
| POST | `/api/admin/events` | イベントを登録 |
| PATCH | `/api/admin/events/:eventId` | イベントを編集 |
| POST | `/api/admin/events/:eventId/official-posts` | 公式情報を入稿（`type=official` の投稿として作成） |
| GET | `/api/admin/event-requests` | 申請一覧（`?status=pending`） |
| PATCH | `/api/admin/event-requests/:requestId` | 申請の承認・却下（`{ status }`） |

---

## 8. MVPに入れないもの

**画面**: 通知一覧、検索、マイページ、他ユーザーのプロフィール、設定、通報・モデレーション、管理ダッシュボード

**機能**: 投稿への返信（ツリー構造）、チャットのリアルタイム通信（WebSocket）、出費シミュレーション、AIによるスケジュール管理、AIによるイベント情報の自動収集、遠征先情報、推しの過去発言まとめ、ハッシュタグ絞り込み

パスワードリセットは、Supabase Authを使うことで実装コストが下がったためスコープ外から外した（4.1を参照）。入れるかどうかは任意。

---

## 9. 未決事項

- [x] パスワードの保管方式 → 案B（サーバー保存・クライアント暗号化）に決定。[VAULT_API.md](./VAULT_API.md) を参照
- [ ] 投稿の最大文字数（暫定280文字）
- [ ] 投稿・チャットのクールダウン秒数（暫定30秒／3秒）
- [ ] 画像の形式・枚数・サイズ上限（暫定 jpeg/png/webp、4枚、5MB）
- [ ] チャットのポーリング間隔（暫定3秒）
- [ ] 投稿にカテゴリ（グッズ／会場・周辺／座席／その他）を持たせるか
- [ ] チャットの過去ログの扱い（公演終了後も残すか、書き込みを閉じるか）
- [ ] プロジェクト名

---

## 10. 実装の進め方（推奨順）

1. monorepoの土台を作る（workspaces、Vite、Express、Prisma、Supabase接続、メール確認の無効化）
2. Prismaのスキーマを流し、シードデータ（アーティスト2件、イベント数件）を入れる
3. 認証（フロントのサインアップ・ログイン、ExpressのJWT検証ミドルウェア、プロフィール作成）
4. アーティスト一覧／詳細、フォロー、ホーム
5. イベント詳細の公式タブとユーザータブ、投稿作成、リアクション
6. チャットタブ（ポーリング）
7. 管理画面
8. パスワード管理（フロント完結。他と独立しているため最後でよい）
9. イベント追加申請

3から6までが動けば、このアプリの価値は確認できる。7以降は必要に応じて順序を入れ替えてよい。
