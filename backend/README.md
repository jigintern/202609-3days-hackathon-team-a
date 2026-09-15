# backend

Express + Prisma によるAPIサーバー。仕様は [docs/SPEC_1.md](../docs/SPEC_1.md) を参照。

## セットアップ

```bash
cd backend
npm install
cp .env.example .env
```

`.env` の各値をSupabaseプロジェクトのものに書き換える。

| 変数名 | 用途 |
| --- | --- |
| `DATABASE_URL` | PrismaからSupabaseのPostgresへの接続文字列 |
| `SUPABASE_URL` | JWKS取得・Storageアップロードに使用 |
| `SUPABASE_SERVICE_ROLE_KEY` | Storageアップロードに使用（フロントには絶対置かない） |
| `SUPABASE_STORAGE_BUCKET` | 画像アップロード先のバケット名（事前に作成しておく） |

Supabaseダッシュボードで開発中はメール確認を無効にしておくこと（SPEC_1.md 2章参照）。

## DBスキーマの反映とシード投入

```bash
npm run prisma:migrate
npm run prisma:seed
```

## 起動

```bash
npm run dev
```

`http://localhost:3000/api/health` が `{ "ok": true }` を返せば起動確認OK。

## ディレクトリ構成

```
backend/
├── prisma/
│   ├── schema.prisma   # DBスキーマ（SPEC_1.md 6章）
│   └── seed.js         # シードデータ
└── src/
    ├── index.js         # エントリポイント・ルーティングの組み立て
    ├── lib/             # Prisma / Supabase(認証・Storage) / 環境変数
    ├── middlewares/      # 認証(requireAuth/requireProfile/requireAdmin)・エラーハンドラ
    ├── routes/           # エンドポイント（admin/ 配下は管理画面用）
    └── utils/            # エラー定義・ページネーション・クールダウン判定
```

## 認証の流れ

1. フロントが `supabase-js` でサインアップ/ログインし、アクセストークンを得る
2. `Authorization: Bearer <token>` を付けて `POST /api/auth/profile` を呼び、表示名を登録する
3. 以降のリクエストは `requireAuth`（JWT検証）→ `requireProfile`（`User`レコード読み込み。未作成なら403 `PROFILE_REQUIRED`）を通す

admin限定のエンドポイントは `role = admin` のユーザーのみ通す `requireAdmin` を追加で通す。
